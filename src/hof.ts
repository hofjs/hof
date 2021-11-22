// https://github.com/prateek3255/typescript-react-demo-library

// Adapt bind to preserve function body instead of returning [native code] if function is bound which is
// important because _makeDerivedVariablesObservable requires function body to setup observability
(function () {
    const originalBind = Function.prototype.bind;

    // Only adapt if extension has not already been applied
    if (originalBind.toString().includes("[native code]"))
        Function.prototype.bind = function () {
        const result = originalBind.apply(this, arguments);
        result.toString = () => this.toString();

        return result;
    }
}());

// Shim replaceAll if not supported on browser by using a simplified implementation
// that provides all required functionality for this framework
(function() {
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function(find: any, replace: any): string {
            let s = '', index, next;
            while (~(next = this.indexOf(find, index))) {
              s += this.substring(index, next) + replace;
              index = next + find.length;
            }
            return s + this.substring(index);
        };
    }
}());

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
    _observers: Map<string, Map<HofHtmlElement, Map<string, string[]>>>;
    _observersPropertyPaths: Map<HofHtmlElement, Map<string, string[]>>;
}

interface ArrayObservable<T> extends ObjectObservable { 
    _emit: (index: number, items: T[], deletedItems: T[], action: Function) => Array<T>;

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
  DERIVED_PROPERTY_FUNCTION_SIGNATURE_REGEX = new RegExp("^function[ \n]*\\(\\)");

  constructor(tagName: string = 'div') {
      super();
      this._tagName = tagName;
      this._shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
      this._root = document.createElement(this._tagName);
      this._shadow.appendChild(this._root);

      if (this["styles"]) {
        const styles = document.createElement("style");
        styles.innerHTML = this["styles"];
        this._shadow.appendChild(styles);
      }

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

          if (prop == "construct" && typeof(initialValue) == "function")
              initialValue.call(this);
          else if (prop == "styles" && typeof(initialValue) == "function")
              this["styles"] = initialValue();
          else // Default Property handling
              Object.defineProperty(this, prop, {
                  get: function() { return this.getProperty(prop, initialValue); },
                  set: function(v) {
                      const oldValue = this.getProperty(prop, initialValue);

                      if (this._callBindVariableBeforeChangedHook(this, prop, v, oldValue)
                        && this._callBindVariableBeforePropertyChangedHook(this, prop, "", v, oldValue)) {
                        
                        // If not initial rendering (oldValue != undefined) and value set on
                        // initial rendering is array, make partial update instead of full update
                        if (Array.isArray(oldValue))
                            this._renderUpdate(v);
                        else
                            this.setProperty(prop, v);

                        this._callBindVariableAfterPropertyChangedHook(this, prop, "", v, oldValue);
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
        // Only update property if it was changed and not only subproperty
        if (!value.lastActionPropertyPath) {
          // Process initial element-property setter calls (cache for time after template
          // has been constructed and further binding variables are available)
          this._properties[name] = value;

          // Update properties including local binding variables
          if (this._allBindVariables)
              this._allBindVariables[name] = value;

          // Make new objects observable
          if (this._allBindVariables)
              this._makeBindVariableObservable(name);
        }
      }
      
      this._updatePropertyObservers([name, value]);
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

      // List parameter has to be identified by =>, because Node returns parameteter without brackets in function.toString()
      // which is important because tests are executed on node
      const listIt = expression.substring(0, expression.indexOf("=>")).replace("(", "").replace(")", "").trim();

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
          locals[this._listIt]._observableUniqueName = this._listIt + "__it" + (this._renderIteration+1);

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

      return expression.trim();
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
            if (!Array.isArray(propObj) && propertyPath.includes(".") && propObj[lastProp].bind) {
                propObj[lastProp] = propObj[lastProp].bind(propObj);
            }

              // Do not observe function references
              if (propObj[lastProp]["bind"]) continue;
    
              // Observe arrays and objects
              if(!Array.isArray(propObj))
                  this._makeObjectObservable(propObj, lastProp, bindVariableName, propertyPath);
              else {
                  this._makeArrayObservable(propObj, lastProp, bindVariableName, propertyPath);
              }
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

      if (!this._registerNewObserver(obj, observerProperty, this, componentProperty, propertyPath)) {
        Object.defineProperty(obj, observerProperty, {
            get: function() { return _value; }.bind(this),
            set: function(v: Object) {
                const newValue = v;
                const oldValue = obj[observerProperty];

                self._applyValueAndNotifyObservers(obj, observerProperty, componentProperty, newValue, oldValue, false, () => _value = v);
            }.bind(this),
            enumerable: true,
            configurable: true
        });

        // Adapt binding for methods in properties, so methods use this of surrounding object literal
        if (propertyPath.includes(".") && obj[observerProperty].bind) {
            obj[observerProperty] = obj[observerProperty].bind(obj);}
    }
  }

  _makeArrayObservable(arr: Array<Object>, observerProperty: string, componentProperty: string, propertyPath: string) {
    const self = this;
    if (!this._registerNewObserver(arr, observerProperty, this, componentProperty, propertyPath)) {
          arr._emit = function(index: number, items: Object[], deletedItems: Object[], action: Function) {
            // Use partial rendering only for change or delete operations with 1 element
            if (items.length == 0) this.lastActionMethod = "DELETE";
            else if (index == null) this.lastActionMethod = "ADD";
            else if (items.length == 1) this.lastActionMethod = "EDIT";

            this.lastActionIndex = index ?? this.length;

            const newValue = items[items.length - 1];
            const oldValue = deletedItems[deletedItems.length - 1];;
            
            // Return last added, updated or deleted element
            this.lastActionObject = newValue ?? oldValue;

            self._applyValueAndNotifyObservers(this, observerProperty, componentProperty, newValue, oldValue, true, action);

            // Reset action
            this.lastActionMethod = null;  this.lastActionIndex = null; this.lastActionObject = null; this.lastActionPropertyPath = null;

            return this;
          }
          arr.push = function(...items: Object[]) {       
              arr._emit(null, items, [], () =>  Array.prototype.push.call(this, ...items));
              
              return arr.length;
          };
          arr.splice = function(index: number, deleteCount: number, ...items: Object[]) {
              const deletedItems = this.slice(index, index + deleteCount);
              if (deleteCount <= 1)
                arr._emit(index, items, deletedItems, () => Array.prototype.splice.call(this, index, deleteCount, ...items));

            return deletedItems;
          }
          arr.edit = function(index, el) { return this.splice(index, 1, el); };
          arr.delete = function(index) { return this.splice(index, 1); };
      }
  }

  _applyValueAndNotifyObservers(obj: Object, observerProperty: string, componentProperty: string, newValue: Object, oldValue: object, arrayNotification: boolean, action: Function) {
    const self = this;

    if (!self._callBindVariableBeforeChangedHook(self, componentProperty, self[componentProperty], self[componentProperty])
        || !self._callBindVariableBeforePropertyChangedHook(self, componentProperty, observerProperty, newValue, oldValue))
        return;

    action();

    obj._observers.get(observerProperty).forEach((componentDetails, component) => {
        componentDetails.forEach((componentPropertyPaths, componentProperty) => {
            componentPropertyPaths.forEach(componentPropertyPath => {
                // On arrays if length property is changed, array ist changed, so adapt
                // property path to match expressions depending on array instead of array.length property
                if (arrayNotification)
                    componentPropertyPath = componentPropertyPath.replace(".length", "");

                let bindVariableValue = component.getProperty(componentProperty, undefined);
                if (bindVariableValue) {
                    if (!arrayNotification) bindVariableValue.lastActionMethod = "SET";

                    if (!component._callBindVariableBeforeChangedHook(component, componentProperty, component[componentProperty], component[componentProperty])
                        || !component._callBindVariableBeforePropertyChangedHook(component, componentProperty, componentPropertyPath, newValue, oldValue)) {
                        return;
                    }

                    bindVariableValue.lastActionPropertyPath = componentPropertyPath;                                    
                    component.setProperty(componentProperty, bindVariableValue);

                    component._callBindVariableAfterPropertyChangedHook(self, componentProperty, componentPropertyPath, newValue, oldValue)                          

                    bindVariableValue.lastActionMethod = null;
                    bindVariableValue.lastActionPropertyPath = null;
                }
            });
        });                                    
    });

    self._callBindVariableAfterChangedHook(self, componentProperty, self[componentProperty], self[componentProperty]);
  }

  _registerNewObserver(obj: Object|Array<Object>, observerProperty: string, component: HofHtmlElement, componentProperty: string, componentPropertyPath: string) {
    let propertyAlreadyObserved = true; 
    if (!obj._observers) obj._observers = new Map();
    if (!obj._observers.has(observerProperty)) {
        obj._observers.set(observerProperty, new Map());
        propertyAlreadyObserved = false;
    }
    if (!obj._observers.get(observerProperty).has(component)) obj._observers.get(observerProperty).set(component, new Map());
    if (!obj._observers.get(observerProperty).get(component).has(componentProperty)) obj._observers.get(observerProperty).get(component).set(componentProperty, []);

    const objObserverList = obj._observers.get(observerProperty).get(component).get(componentProperty);
    if (!objObserverList.includes(componentPropertyPath))
       objObserverList.push(componentPropertyPath);

    return propertyAlreadyObserved;
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

  _renderUpdate(value: Object) {
      // Only partially update components that render list, since for other components
      // other element would be added/deleted
      if (this._listTemplate != null) {
          this._locals[this._listIt] = this._listData[value.lastActionIndex];

          // Remove node
          if (value.lastActionMethod == "DELETE") {
            this._removeObserversForBindVariable(value.lastActionObject._observableUniqueName);
            this._root.childNodes[this._listStart+value.lastActionIndex].remove();
          }
          else {
            this._locals[this._listIt]._observableUniqueName = this._listIt + "__it" + (this._renderIteration+1);

            // Parse new html for added or updated content
            const [elements, bindVariables, bindVariableNames] = this._parseHTML(this._listTemplate, this._locals);

            // Add or replace html
            if (value.lastActionMethod == "ADD") {
                if (this._root.childNodes[value.lastActionIndex])
                    this._root.insertBefore(elements[0], this._root.childNodes[this._listStart+value.lastActionIndex-1].nextSibling);
                else
                    this._root.appendChild(elements[0]);

                this._processElementBinding(this._root.childNodes[this._listStart+value.lastActionIndex], bindVariables, bindVariableNames);
            }
            else if (value.lastActionMethod == "EDIT") {

                this._root.replaceChild(elements[0], this._root.childNodes[this._listStart+value.lastActionIndex])
                this._processElementBinding(this._root.childNodes[this._listStart+value.lastActionIndex], bindVariables, bindVariableNames);
            }
        }
      }
  }

  _logUpdate(element: DOMElement, name: string, value: Object) {
      // Filter out function references on first rendering because they are not observed
      if (value["bind"]) return;

      // If property path is specified, component is not updated, but child component that references property path
      if (value.lastActionPropertyPath) return;
     
      console.log(`[${element.nodeName ?? "TEXT"}]: Update of ${name}: ${value.lastActionMethod ?? "SET"} ${JSON.stringify(value.lastActionObject ?? value)}`);
  }

  _makeDerivedVariablesObservable(variableName: string, variableBody: string, html: string) {
    // Make only globally in the form prop: function() or locally in the form prop = function() defined derived properties
    // observable (local lambda expressions are also supported because they get transformed into prop = function())
    if (!this.DERIVED_PROPERTY_FUNCTION_SIGNATURE_REGEX.test(variableBody))
         return html;

     // Make derived bind variables observable
    let referencedBindVariableNames = "||null";
    for (const [referencedBindVariableName] of variableBody.matchAll(this.REFERENCED_BIND_VARIABLE_NAMES_REGEX))
        referencedBindVariableNames += "||" + referencedBindVariableName;

    return html.replace(new RegExp(`([^\\w])${variableName}\\(\\)([^\\w])`, "g"), `$1(${variableName}()${referencedBindVariableNames})$2`);
  }

  _calculateUniqueElementAndVariableName(name: string, renderIteration: number) {
      return name + "__it" + renderIteration;
  }

  _calculateTemplateAndBindVariableNames(html: string, props: PropertyMap, locals: PropertyMap): [string, string[]] {
      this._renderIteration++;

      // Determine all binding variables
      const bindVariables = Object.keys(props);

      // Add additional local variables to binding
      if (locals) {
          for (let [variableName, variableValue] of Object.entries(locals)) {
              const uniqueBindVariableName = variableName + "__it" + this._renderIteration;

              props[uniqueBindVariableName] = variableValue;
              bindVariables.push(uniqueBindVariableName);

              // Replace variable name with unique name to support list parameters
              html = html.replace(new RegExp(`([{][^{}]*[^\\w]?)${variableName}([^\\w])`, "g"), `$1${uniqueBindVariableName}$2`);
              
              html = this._makeDerivedVariablesObservable(uniqueBindVariableName, variableValue.toString(), html);
          }
      }

      // Make derived global bind variables observable
      const regexp = new RegExp('(this[\\w$.]*\\.[\\w$]+)([(]?)', 'g');
      for (const [, expr] of html.matchAll(regexp)) {
          // Resolve property variable (defined in component or referenced from store)
          const index = expr.indexOf(".") + 1;
          const func = new Function("return " + expr).call(props);
          if (!func) continue;

          const functionBody = func.toString().replaceAll("this.", expr.substring(index, expr.indexOf(".", index)+1));

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

      // Rebind this of subproperties to parent property
      for (let bindVariableName of attributeExpression.bindVariableNames) {
        if (bindVariables[bindVariableName].bind)
            bindVariables[bindVariableName] = bindVariables[bindVariableName].bind(this); // pass this from parent to child on callbacks that are passed down
      }

      // Determine current values
      const bindVariableValues = this._getBindVariableValues(attributeExpression.bindVariableNames);

      // Get current value of element attribute by evaluating expression
      const value = attributeExpression.execute(...bindVariableValues);

      element[attr] = value;
      
      // Register combination of element and attribute as observer for each bind variable name
      if (value != null && !value["bind"]) // Do not observe functions
        this._registerElementAttributeAsObserverForBindVariables(element, attr, bindVariables, attributeExpression.bindVariableNames); 
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
      // which is not really necessary, but facilitates the generic handling (errors as a consequence of expressions
      // that are not resolved yet, are catched to support functions on properties such as persons.map)
      return new AttributeExpression(new Function(...referencedBindVariables, "try {return " +  expr + "} catch(e) { return ''; }").bind(this), referencedBindVariables, expr);
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

                  if (!bindVariableValue.lastActionPropertyPath || attrExpr.template.includes(bindVariableValue.lastActionPropertyPath)) {
                    // Reevaluate binding expression
                    const bindVariableValues = this._getBindVariableValues(attrExpr.bindVariableNames);
                    const newValue = attrExpr.execute(...bindVariableValues);

                    // Always propagate changes in properties to all observer elements and
                    // propagate changes in subproperties only if subproperty is included in binding expression / template
                    // (e.g. if data.selectedPerson.name is changed, only attributes with bindings to data, data.selectedPerson
                    // and data.selectedPerson.name, but e.g. not on data.selectedPerson.age).
                    if (typeof newValue.lastActionIndex != "undefined" || !bindVariableValue.lastActionPropertyPath || attrExpr.template && attrExpr.template.includes(bindVariableValue.lastActionPropertyPath)) {
                        // Always update HofHTMLElement to pass down subproperty changes to sub components,
                        // but update simple html elements only if value changed
                        if (element instanceof HofHtmlElement || element[attrName] != newValue) {
                            // this._logUpdate(element, attrName, newValue);

                            element[attrName] = newValue;
                        }
                    }
                }
              }
          }
      }
  }
}

type BeforeChangedHookName<PropertyName extends string> = `${PropertyName}BeforeChanged`;
type BeforeChangedHookType<PropertyType> = (newValue: PropertyType, oldValue: PropertyType) => boolean;
type AfterChangedHookName<PropertyName extends string> = `${PropertyName}AfterChanged`;
type AfterChangedHookType<PropertyType> = (newValue: PropertyType, oldValue: PropertyType) => void;
type BeforePropertyChangedHookName<PropertyName extends string> = `${PropertyName}BeforePropertyChanged`;
type BeforePropertyChangedHookType<PropertyType> = (subProp: string, newValue: PropertyType, oldValue: PropertyType) => boolean;
type AfterPropertyChangedHookName<PropertyName extends string> = `${PropertyName}AfterPropertyChanged`;
type AfterPropertyChangedHookType<PropertyType> = (subProp: string, newValue: PropertyType, oldValue: PropertyType) => void;

type HofHtmlElementComponentLiteralWithHooks<HofHtmlElementComponentLiteral> = {
    [Propertyname in keyof HofHtmlElementComponentLiteral]: Object;
} & {
    [PropertyName in BeforeChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?:
        BeforeChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    [PropertyName in AfterChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?:
        AfterChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    [PropertyName in BeforePropertyChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?:
        BeforePropertyChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    [PropertyName in AfterPropertyChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?:
        AfterPropertyChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    construct?: Function;
    render: Function;
}

// Helper function to support functional component definition as alternative to class based web component implementation
export function component<T extends HofHtmlElementComponentLiteralWithHooks<T>>(name: string, obj: T, tag = "div"): new () => HofHtmlElement & T {
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
          
          // Filter out comments (this has to be done before looking for return statement to avoid return within comment to be returned)
          functionDefinition = functionDefinition.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, ' ');

          let begin = functionDefinition.indexOf("{") + 1;
          let end = functionDefinition.lastIndexOf("return")
          let functionBody = functionDefinition.substring(begin, end);

          // Replace lambda expressions with scoped functions to
          // enable rebind of this (because this must reference component
          // instead of component literal to make observability work)
          functionBody = functionBody.replace(/[ \n]+=[ \n]+\(([^\)]*)\)[ \n]*=>[ \n]*({[ \n]*return)?([^;]+;[ \n]*)}?/gm, "= function($1) { return $3 }; ");

          // Calculate variable names
          const variables = [];
            for (const [,,variable] of functionBody.matchAll(/(const|let|function)[ \n]+([^ \n(=]+)/gm))
                variables.push(variable);

          // Calculate variable values
          if (variables.length > 0)
            return new Function(functionBody + "return {" + variables.join(",") + "}").call(obj);
          else
            return [];
      }

  customElements.define(name, componentConstructor);

  return componentConstructor as new() => HofHtmlElement & T;
}