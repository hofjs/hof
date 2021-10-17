// https://github.com/prateek3255/typescript-react-demo-library

interface PropertyMap {
    [propertyName: string]: Object & Partial<{ bind(thisArg: Object, ...args: Object[]): Object }>
}

interface BindVariableExpressionsMap {
    [bindVariableName: string]: string[]
}

interface ObjectObservable {
    lastActionMethod: string;
    lastActionIndex: number;
    lastActionObject: Object;
    lastActionPropertyPath: string;

    _observableUniqueName: string;
    _observers: Map<HofHtmlElement, string[]>;
}

interface ArrayObservable<T> extends ObjectObservable { 
    _emit: (index: number, items: T[], deletedItems: T[]) => Array<T>;

    edit: (index: number, element: T) => T[];
    delete: (index: number) => T[];
}

// Extend Object and Array<T> within the framework (not global, because extensions 
// are only usable within the context of an HofHtmlElement).
type Object = globalThis.Object & Partial<ObjectObservable>;
type Array<T> = globalThis.Array<T> & Partial<ArrayObservable<T>>;

type DOMElement = HTMLElement | Text | Node | HofHtmlElement;

type TemplateStringFunction = (listItemParameter?: Object) => string;

class AttributeExpression {
    public constructor(public execute: Function,
        public bindVariableNames: string[], public template: string) {}
}

// Base class for all Web components created by this framework
export abstract class HofHtmlElement extends HTMLElement  {
  _tagName: string;
  _root: HTMLElement;
  _shadow: ShadowRoot;

  _properties: PropertyMap = {}; // Global properties (of component)
  _locals: PropertyMap = {}; // Local variables (of render function), including list iteration variables such as person0, person1, ...
  
  _allBindVariables: PropertyMap = null; // All bind variables, derived from properties and locals
  _allBindExpressions: BindVariableExpressionsMap = {}; // All bind variable expressions used in templates

  _observersForBindVariable: Map<string, Map<DOMElement, string[]>> = new Map(); // Map<BindVariableName, Map<DOMElement, AttributeName[]>>
  _observerExpressions: Map<DOMElement, Map<string, AttributeExpression>> = new Map(); // Map<DOMElement, Map<AttributeName, AttributeExpression>>

  _renderIteration: number = -1; // Each rendering process increments id (rendering of a list of n elements means n incrementations, each update an additional one)

  _listTemplate: TemplateStringFunction = null;
  _listData: Object[] = [];
  _listIt: string = "";
  _listStart: number = 0;

  PROPS_FILTER = (p: string) => p.charAt(0) != '_' && p != p.toUpperCase() && p != 'constructor' && p != 'render';
  
  REFERENCED_BIND_VARIABLE_NAMES_REGEX = new RegExp('([a-zA-Z_$][\\w]+\\.[\\w\\.]+)', 'g');
  DERIVED_PROPERTY_SIGNATURE_REGEX = new RegExp("^function *\\(\\)");

  constructor(tagName: string = 'div') {
      super();
      this._tagName = tagName;
      this._shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
      this._root = document.createElement(this._tagName);
      this._shadow.appendChild(this._root);

      this.render();
  }

  abstract render(): void;

  useAutoProps() {
      // Replace all public simple properties with getters and setters,
      // so that access can be intercepted and observability can be realized
      this._forEachPropertyOfObjectAndPrototype((prop, obj) => {
          const initialValue = obj[prop];

          // Fix for event handlers because they cannot be added with defineProperty
          // from component() as long as a web component is not part of the DOM
          if (prop.startsWith("event-")) {
              prop = prop.substring(6)
              delete obj[prop];
          }

          if (prop == "construct" && typeof(initialValue) == "function") {
              initialValue.call(this);
          }
          else // Default Property handling
              Object.defineProperty(this, prop, {
                  get: function() { return this.getProperty(prop, initialValue); },
                  set: function(v) {
                      const oldValue = this.getProperty(prop, initialValue);

                      if (this._callBindVariableBeforeChangedHook(this, prop, v, oldValue)) {
                        this.setProperty(prop, v);                        
                        this._callBindVariableAfterChangedHook(this, prop, v, oldValue);
                      }
                    },
                  enumerable: true,
                  configurable: true
              });
      })
  }

  setProperty(name: string, value: Object) {
      const oldValue = this._properties[name];

      // Render again in case of complex object or on value change of simple property or on collection action
      if (typeof(oldValue) == "object" || typeof(value) == "object" || oldValue != value || value["lastActionMethod"]) {
          // Process initial element-property setter calls (cache for time after template
          // has been constructed and further binding variables are available)
          this._properties[name] = value;

          // Update properties including local binding variables
          if (this._allBindVariables)
              this._allBindVariables[name] = value;

          this._updatePropertyObservers([name, value]);
      }

      // Make new objects observable
      if (this._allBindVariables)
          this._makeBindVariableObservable(name);
  }

  getProperty(name: string, initialValue: Object): Object {
      if (this._allBindVariables)
          return this._allBindVariables[name];

      return this._properties[name] ?? this.getAttribute(name) as Object ?? initialValue;
  }

  _hasAlreadyRendered() {
      return this._root.textContent != "";
  }

  renderContent(html: TemplateStringFunction, locals: PropertyMap = undefined) {
      this._renderFull(html, locals);
  }

  renderList(data: Object[]|string, html: TemplateStringFunction, locals: PropertyMap = undefined) {
      const expression = html.toString();
      const listIt = expression.substring(expression.indexOf('(')+1, expression.indexOf(')'));

      // List not yet resolved at time of call (first rendering), i.e. still value like ${data}
      if (typeof data == "string") return;

      this._listData = data;
      this._listIt = listIt;
      this._listTemplate = html;
      this._listStart = this._root.childNodes.length;

      if (typeof(locals) == "undefined" || locals == null)
          locals = {};

      for (const listItem of this._listData) {
          locals[this._listIt] = listItem;
          locals[this._listIt]._observableUniqueName = this._listIt + (this._renderIteration+1);
          this._renderFull(html, locals);
      }
  }

  _calculateProperties() {
      let result = {};
      this._forEachPropertyOfObjectAndPrototype((prop, obj) => result[prop] = obj[prop]);

      this._allBindVariables = result;
  }

  _forEachPropertyOfObjectAndPrototype(func: (prop: string, obj: Object) => void) {
      for (const name of Object.getOwnPropertyNames(this).filter(this.PROPS_FILTER))
          func(name, this);

      const prototype = Object.getPrototypeOf(this);
      for (const name of Object.getOwnPropertyNames(prototype).filter(this.PROPS_FILTER))
          func(name, prototype);
  }

  _convertToTemplateExpression(buildFunction: TemplateStringFunction) {
      let expression = buildFunction.toString();
      const expressionStart = expression.indexOf('`');

      if (expressionStart > 0)
          expression = expression.substring(expressionStart+1, expression.length-1);

      return expression;
  }

  _parseHTML(htmlFunction: TemplateStringFunction, locals: PropertyMap): [NodeListOf<ChildNode>, PropertyMap, string[]] {
      const html = this._convertToTemplateExpression(htmlFunction);

      // First call of render?
      if (this._allBindVariables == null)
          this._calculateProperties();

      const allBindVariables = this._allBindVariables;
      const [template, bindVariableNames] = this._calculateTemplateAndBindVariableNames(html, allBindVariables, locals);

      this._calculateBindings(template, bindVariableNames);

      const parser = new DOMParser();
      const elements = parser.parseFromString(template, "text/html").body.childNodes;

      return [elements, allBindVariables, bindVariableNames];
  }

  _makeBindVariableObservable(bindVariableName: string) {
      for (const bindingExpression of this._allBindExpressions[bindVariableName])
          this._makeBindVariableStructureObservable(bindVariableName, bindingExpression);
  }

  _makeBindVariableStructureObservable(bindVariableName: string, bindingExpression: string) {
      const o = this._allBindVariables[bindVariableName];
      const props = bindingExpression.split('.');

      let propObj = o;
      let propertyPath = bindVariableName;
      for (let i=0; i<props.length; i++) {
          let lastProp = props[i];
          propertyPath += `.${props[i]}`;

          if (typeof propObj == "undefined") return;

          if (typeof propObj == 'object') {
              if(!Array.isArray(propObj))
                  this._makeObjectObservable(propObj, lastProp, bindVariableName, propertyPath);
              else
                  this._makeArrayObservable(propObj, bindVariableName);
          }

          propObj = propObj[props[i]];
      }
  }

  _callBindVariableBeforeChangedHook(obj: Object, prop: string, newValue: Object, oldValue: Object) {
    const hookMethodName = `${prop}BeforeChanged`;
    if (obj[hookMethodName]) {
        const ret = obj[hookMethodName](newValue, oldValue);
        if (typeof ret != "undefined" && ret == false)
            return false;

        return true;
    }

    return true;
  }

  _callBindVariableAfterChangedHook(obj: Object, prop: string, newValue: Object, oldValue: Object) {
    const hookMethodName = `${prop}AfterChanged`;
    if (obj[hookMethodName])
        obj[hookMethodName](newValue, oldValue);
  }

  _callBindVariableBeforePropertyChangedHook(obj: Object, prop: string, subProp: string, newValue: Object, oldValue: Object) {
    const hookMethodName = `${prop}BeforePropertyChanged`;
    if (obj[hookMethodName]) {
        const ret = obj[hookMethodName](subProp, newValue, oldValue);
        if (typeof ret != "undefined" && ret == false)
            return false;

        return true;
    }

    return true;
  }

  _callBindVariableAfterPropertyChangedHook(obj: Object, prop: string, subProp: string, newValue: Object, oldValue: Object) {
    const hookMethodName = `${prop}AfterPropertyChanged`;
    if (obj[hookMethodName])
        obj[hookMethodName](subProp, newValue, oldValue);
  }

  _makeObjectObservable(obj: Object, observerProperty: string, componentProperty: string, propertyPath: string) {
      let _value = obj[observerProperty];

      const self = this;

      if (this._registerNewObserver(obj, observerProperty)) {
        Object.defineProperty(obj, observerProperty, {
            get: function() { return _value; }.bind(self),
            set: function(v: Object) {
                const _oldValue = _value;

                if (self._callBindVariableBeforeChangedHook(obj, observerProperty, v, _oldValue)) {
                    _value = v;

                    obj._observers.forEach((properties, component) => properties.forEach(
                        () => {
                            let bindVariableValue = component.getProperty(componentProperty, undefined);
                            if (bindVariableValue) {
                                if (!component._callBindVariableBeforePropertyChangedHook(self, componentProperty, propertyPath, v, _oldValue)) {
                                    return;
                                } 

                                bindVariableValue.lastActionMethod = "SET";
                                bindVariableValue.lastActionPropertyPath = propertyPath;

                                component.setProperty(componentProperty, bindVariableValue);

                                component._callBindVariableAfterPropertyChangedHook(self, componentProperty, propertyPath, v, _oldValue)

                                bindVariableValue.lastActionMethod = null;
                                bindVariableValue.lastActionPropertyPath = null;
                            }
                        }));

                    self._callBindVariableAfterChangedHook(obj, observerProperty, _value, _oldValue);
                  }         
            }.bind(self),
            enumerable: true,
            configurable: true
        });
      }
  }

  _makeArrayObservable(arr: Array<Object>, observerProperty: string) {
    if (this._registerNewObserver(arr, observerProperty)) {
          arr._emit = function(index: number, items: Object[], deletedItems: Object[]) {
              // Use partial rendering only for change or delete operations with 1 element
              if (items.length == 0) this.lastActionMethod = "DELETE";
              else if (index == null) this.lastActionMethod = "ADD";
              else if (items.length == 1) this.lastActionMethod = "EDIT";
              this.lastActionIndex = index ?? this.length - 1;

              // Return last added, updated or deleted element
              this.lastActionObject = deletedItems.length > 0 ? deletedItems[deletedItems.length - 1] : items[this.lastActionIndex];

              // Notify observers
              this._observers.forEach((properties, component) => properties.forEach(
                  property => component.setProperty(property, this)));

              // Reset action
              this.lastActionMethod = null;  this.lastActionIndex = null; this.lastActionObject = null;

              return this;
          }
          arr.push = function(...items: Object[]) {
              Array.prototype.push.call(this, ...items);
              arr._emit(null, items, []);
              
              return arr.length;
          };
          arr.splice = function(index: number, deleteCount: number, ...items: Object[]) {
              const deletedItems = Array.prototype.splice.call(this, index, deleteCount, ...items);
              if (deleteCount <= 1)
                arr._emit(index, items, deletedItems);

            return deletedItems;
          }
          arr.edit = function(index, el) { return this.splice(index, 1, el); };
          arr.delete = function(index) { return this.splice(index, 1); };
      }
  }

  _registerNewObserver(obj: Object|Array<Object>, observerProperty: string) {
    if (!obj._observers) obj._observers = new Map();
    if (!obj._observers.has(this)) obj._observers.set(this, []);
    if (!obj._observers.get(this).includes(observerProperty)) {
      obj._observers.get(this).push(observerProperty);
      return true;
    }
    else
        return false;
  }

  _calculateBindings(htmlFunction: string, bindVariableNames: string[]) {
      for (let bindVariableName of bindVariableNames) {
          const regexp = new RegExp(`(${bindVariableName})((\\.[\\w]+)+)`, 'g');

          this._allBindExpressions[bindVariableName] = [];

          for (const [, , expression] of htmlFunction.matchAll(regexp)) {
              const expr = expression.substring(1);

              if (!this._allBindExpressions[bindVariableName].includes(expr))
                  this._allBindExpressions[bindVariableName].push(expr);
          }

          this._makeBindVariableObservable(bindVariableName);
      }
  }

  _renderFull(htmlFunction: TemplateStringFunction, locals: PropertyMap) {
      this._locals = locals;

      const [elements, bindVariables, bindVariableNames] = this._parseHTML(htmlFunction, locals);

      const lastExistingElement = this._root.childNodes.length;

      while(elements.length > 0) // Elements are extracted from source at appendChild, therefore always first element
          this._root.appendChild(elements[0]);

      // Incrementally process only those elements recursively that have not been processed via
      // previous renderList or renderContent method within the same render method, so that the
      // same elements are not processed multiple times and added to the observables data structure.
      for (let index = lastExistingElement; index < this._root.childNodes.length; index++)
          this._processElementBinding(this._root.childNodes[index], bindVariables, bindVariableNames);
  }

  _removeObserversForBindVariable(bindVariableToDelete: string) {
      // Remove observer expressions
      if (this._observersForBindVariable.has(bindVariableToDelete))
        for (const [comp] of this._observersForBindVariable.get(bindVariableToDelete)) {
            for (const [attr, expr] of this._observerExpressions.get(comp)) {
                if (expr.bindVariableNames.includes(bindVariableToDelete))
                    this._observerExpressions.get(comp).delete(attr);                
            }

            if (this._observerExpressions.get(comp).size == 0)
                this._observerExpressions.delete(comp);
        }

        // Remove observers for bind variable
        this._observersForBindVariable.delete(bindVariableToDelete);
 
        // Remove bind variable
        delete this._allBindVariables[bindVariableToDelete];

        // Remove all bind expressions for bind variable
        delete this._allBindExpressions[bindVariableToDelete];
  }

  _renderUpdate(newBindVariableValue: Object) {
      // Only partially update components that render list, since for other components
      // other element would be added/deleted
      if (this._listTemplate != null) {
          this._locals[this._listIt] = this._listData[newBindVariableValue.lastActionIndex];

          // Remove node
          if (newBindVariableValue.lastActionMethod == "DELETE") {
            this._removeObserversForBindVariable(newBindVariableValue.lastActionObject._observableUniqueName);
            this._root.childNodes[this._listStart+newBindVariableValue.lastActionIndex].remove();
          }
          else {
            this._locals[this._listIt]._observableUniqueName = this._listIt + (this._renderIteration+1);

            // Parse new html for added or updated content
            const [elements, bindVariables, bindVariableNames] = this._parseHTML(this._listTemplate, { [this._listIt]: this._listData[newBindVariableValue.lastActionIndex] });

            // Add or replace html
            if (newBindVariableValue.lastActionMethod == "ADD") {
                if (this._root.childNodes[newBindVariableValue.lastActionIndex])
                    this._root.insertBefore(elements[0], this._root.childNodes[this._listStart+newBindVariableValue.lastActionIndex-1].nextSibling);
                else
                    this._root.appendChild(elements[0]);

                this._processElementBinding(this._root.childNodes[this._listStart+newBindVariableValue.lastActionIndex], bindVariables, bindVariableNames);
            }
            else if (newBindVariableValue.lastActionMethod == "EDIT") {
                this._root.replaceChild(elements[0], this._root.childNodes[this._listStart+newBindVariableValue.lastActionIndex])
                this._processElementBinding(this._root.childNodes[this._listStart+newBindVariableValue.lastActionIndex], bindVariables, bindVariableNames);
            }
        }
      }
  }

  _makeDerivedVariablesObservable(variableName: string, variableBody: string, html: string) {
    // Nur global in der Form prop: function() bzw. lokal in der Form prop = function()
    // definierte abgeleitete Properties observable machen (keine regulären Methoden / Funktionen
    // in der Form function name() bzw. name())
    if (!this.DERIVED_PROPERTY_SIGNATURE_REGEX.test(variableBody))
         return html;

     // Make derived bind variables observable
     let referencedBindVariableNames = "||null";
     for (const [referencedBindVariableName] of variableBody.matchAll(this.REFERENCED_BIND_VARIABLE_NAMES_REGEX))
         referencedBindVariableNames += "||" + referencedBindVariableName;

      return html.replaceAll(`${variableName}`, `(${variableName}()${referencedBindVariableNames})`);
  }

  _calculateTemplateAndBindVariableNames(html: string, props: PropertyMap, locals: PropertyMap): [string, string[]] {
      this._renderIteration++;

      // Determine all binding variables
      const bindVariables = Object.keys(props);

      // Add additional local variables to binding
      if (locals) {
          for (let [n,v] of Object.entries(locals)) {
              const uniqueBindVariableName = n + this._renderIteration;

              props[uniqueBindVariableName] = v;
              bindVariables.push(uniqueBindVariableName);

              const regexp = new RegExp(`(${n.replaceAll("$", "\\$")})([^=-])`, 'g');
              for (const [expr, , token] of html.matchAll(regexp))
                  html = html.replace(expr, `${uniqueBindVariableName}${token}`);

              html = this._makeDerivedVariablesObservable(uniqueBindVariableName, v.toString(), html);
          }
      }

      // Make derived global bind variables observable
      const regexp = new RegExp('(this[\\w$.]*\\.[\\w$]+)([(]?)', 'g');
      for (const [, expr, token] of html.matchAll(regexp)) {
          if (token == '(') continue;

          // Resolve property variable (defined in componented or referenced from store)
          const index = expr.indexOf(".") + 1;
          const functionBody = new Function("return " + expr).call(props).toString().replaceAll("this.", expr.substring(index, expr.indexOf(".", index)+1));

          html = this._makeDerivedVariablesObservable(expr, functionBody, html);   
      }

      return [html, bindVariables];
  }

  _processElementBinding(element: DOMElement, bindVariables: PropertyMap, bindVariableNames: string[]) {
      // Support databinding expressions in attributes (regular DOM elements)
      if ("attributes" in element)
          Array.from(element.attributes).forEach((attr: Attr) => {
            if (attr.nodeValue.includes("${"))
                  this._processBindingExpression(element, bindVariables, bindVariableNames, attr.nodeName, attr.nodeValue);
          });

      // Support databinding expressions within tags (TextNodes)
      if ("data" in element) {
          if (element.data.includes("${"))
              this._processBindingExpression(element, bindVariables, bindVariableNames, "data", element.data);
      }

      // Edit child elements recursively
      if ("childNodes" in element)
          for (const childElement of Array.from(element.childNodes)) {
              this._processElementBinding(childElement, bindVariables, bindVariableNames);
          }

      // Render elements with render support      
      if ("_hasAlreadyRendered" in element && !element._hasAlreadyRendered())
        element.render();
  }

  _processBindingExpression(element: DOMElement, bindVariables: PropertyMap, bindVariableNames: string[], attr: string, expr: string) {
      // Build callable expression to (re)calculate value of attribute based on depending binding variables  
      const attributeExpression = this._buildCallableExpression(attr, expr, bindVariableNames);

      // Save attribute expression for later execution on bind variable changes
      if (!this._observerExpressions.has(element)) this._observerExpressions.set(element, new Map());
      this._observerExpressions.get(element).set(attr, attributeExpression);

      // Register combination of element and attribute as observer for each bind variable name
      this._registerElementAttributeAsObserverForBindVariables(element, attr, bindVariables, attributeExpression.bindVariableNames);

      // Determine current values
      const bindVariableValues = this._getBindVariableValues(attributeExpression.bindVariableNames);

      // Get current value of element attribute by evaluating expression
      element[attr] = attributeExpression.execute(...bindVariableValues);
  }

  _buildCallableExpression(attr: string, expr: string, bindVariableNames: string[]) {
      // If expression is the only expression, do not interpret it as string,
      // but evaluate directly so that references to functions can be assigned to properties
      if (attr == "data" || expr.lastIndexOf("${") > 0 || expr.lastIndexOf("}") < expr.length-1)
          expr = "`" + expr + "`";
      else
          expr = expr.replaceAll("${", "").replaceAll("}", "");

      let referencedBindVariables = [];
      for (const bindVariableName of bindVariableNames) {
          if (expr.includes(bindVariableName))
              referencedBindVariables.push(bindVariableName);
      }

      // Currently, in addition to the local variables (additional variables passed to renderContent/renderList),
      // the WebComponent's properties are also passed as local variables to the WebComponent's attribute function,
      // which is not really necessary, but facilitates the generic handling
      return new AttributeExpression(new Function(...referencedBindVariables, "return " +  expr).bind(this), referencedBindVariables, expr);
  }

  _registerElementAttributeAsObserverForBindVariables(element: DOMElement, attr: string, bindVariables: PropertyMap, referencedBindVariableNames: string[]) {
    // Add combination of element and attribute to observer structure
    for (let bindVariableName of referencedBindVariableNames) {
          if (!this._observersForBindVariable.has(bindVariableName)) this._observersForBindVariable.set(bindVariableName, new Map());

          const variableObservable = this._observersForBindVariable.get(bindVariableName);
          if (!variableObservable.has(element)) variableObservable.set(element, []);

          if (bindVariables[bindVariableName].bind)
              bindVariables[bindVariableName] = bindVariables[bindVariableName].bind(this); // pass this from parent to child on callbacks that are passed down

          variableObservable.get(element).push(attr);
      }
  }

  _getBindVariableValues(bindVariableNames: string[]) {
    let result = [];
    for (const b of bindVariableNames)
        result.push(this._allBindVariables[b]);

    return result;
  }

  _updatePropertyObservers(bindVariable: [string, Object]) {
      const [bindVariableName, bindVariableValue] = bindVariable;

      // Render partially only if element has already been created.
      // (Setters should also be able to be called before component
      // has been created for the first time, which is why state setters
      // only change state here, but have no effect on UI yet).
      if (this._observersForBindVariable.has(bindVariableName)) {
          for (const [element, attrs] of this._observersForBindVariable.get(bindVariableName).entries()) {
              for (const attrName of attrs) {
                  const attrExpr = this._observerExpressions.get(element).get(attrName);
                  
                  // Reevaluate binding expression
                  const bindVariableValues = this._getBindVariableValues(attrExpr.bindVariableNames);
                  const newValue = attrExpr.execute(...bindVariableValues);

                  // Always propagate changes in properties to all observer elements and
                  // propagate changes in subproperties only if subproperty is included in binding expression / template
                  // (e.g. if data.selectedPerson.name is changed, only attributes with bindings to data, data.selectedPerson
                  // and data.selectedPerson.name, but e.g. not on data.selectedPerson.age).
                  if (!bindVariableValue.lastActionPropertyPath || attrExpr.template && attrExpr.template.includes(bindVariableValue.lastActionPropertyPath)) {
                      // Partielle Updates bei Collections triggern
                      if (newValue.lastActionMethod) {
                          if (element instanceof HofHtmlElement)
                            element._renderUpdate(newValue);
                          // console.log(`[${element.tagName ?? "TEXT"}] Partial update of ${attrName}: ${newValue.lastActionMethod} ${JSON.stringify(newValue[newValue.lastActionIndex])}`);
                      }
                      else {
                          element[attrName] = newValue;
                          // console.log(`[${element.tagName ?? "TEXT"}]: Full update of ${attrName}: ${JSON.stringify(newValue)}`);
                      }
                  }
              }
          }
      }
  }
}

// Helper function to support functional component definition as alternative to class based web component implementation
export function component(name: string, obj: object, tag = "div"): new () => HofHtmlElement {
  let componentConstructor = class extends HofHtmlElement {
      constructor() { super(tag); super.useAutoProps(); }
      render() {}
  };
  componentConstructor["componentName"] = name;

  for (const prop of Object.keys(obj))
      if (prop == "render") {
          const func = obj[prop]();
          const variables = _calculateLocalVariables(prop);

          delete componentConstructor["render"];

          if (Array.isArray(func)) {
              const renderFuncs: Function[] = [];

              if (func.length > 0 && Array.isArray(func[0])) // Array with render function
                  for (const renderExpr of func)
                      renderFuncs.push(_calculateRenderFunc(renderExpr));
               else
                   renderFuncs.push(_calculateRenderFunc(func));

              componentConstructor.prototype["render"] = function() { renderFuncs.forEach((renderFunc => renderFunc(this, variables))); }
          }
          else // Call function
              componentConstructor.prototype["render"] = function() { this.renderContent(func, variables); };
      }
      else {
          // Due to a bug in current JS implementations, DOM events are also executed when the getter is
          // accessed, which leads to errors if DOM element / web component is not yet inserted in the
          // real DOM, so that the onXY events are stored here under a different name and later
          // registered within the class under the correct name (this works because the custom element
          // has already been registered than)
          componentConstructor.prototype["event-"+prop] = obj[prop];
      }

      function _calculateRenderFunc(func: Function|Function[]) {
          if (func.length == 1) // Call [function]
              return function(obj: HofHtmlElement, variables: PropertyMap) { obj.renderContent(func[0], variables); };
          else if (func.length == 2 && typeof(func[0]) == "function") // Call [function, variables]
              return function(obj: HofHtmlElement) { obj.renderContent(func[0], func[1]); };
          else if (func.length >= 2 && typeof(func[1]) == "function") // Call [listVariable, function, variables]
              return function(obj: HofHtmlElement, variables: PropertyMap) { obj.renderList(obj[func[0]] ?? func[0], func[1], func[2] ?? variables);  }
          else
              throw new Error("Invalid render function argument!");
      }

      function _calculateLocalVariables(prop: string) {
          let functionDefinition = obj[prop].toString();
          let begin = functionDefinition.indexOf("{") + 1;
          let end = functionDefinition.lastIndexOf("return")
          let functionBody = functionDefinition.substring(begin, end);

          // Filter out comments
          functionBody = functionBody.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, ' ');

          // Calculate variable names
          const regexps = [
            new RegExp(`let[^\\w$]+([\\w$]+)[\\W]*=`, 'g'),
            new RegExp(`const[^\\w$]+([\\w$]+)[\\W]*=`, 'g'),
            new RegExp(`function[^\\w$]+([\\w$]+)\\(`, 'g')
          ];
          const variables = [];
          for (const regexp of regexps)
            for (const [,variable] of functionBody.matchAll(regexp))
                variables.push(variable);

          // Calculate variable values
          if (variables.length > 0)
            return new Function(functionBody + "return {" + variables.join(",") + "}").call(obj);
          else
            return [];
      }

  customElements.define(name, componentConstructor);

  return componentConstructor;
}