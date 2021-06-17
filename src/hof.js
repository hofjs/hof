// Base class for all Web components created by this framework
class HofHtmlElement extends HTMLElement  {
    _tagName;
    _root;
    _shadow;

    _observables = {};
    _properties = {};
    
    _allProperties = null;
    _elementAttributeBindParams = new Map();
    _bindingExpressions = [];

    _renderIteration = -1;

    _listTemplate = "";
    _listData = [];
    _listIt = "";
    _listStart = 0;

    static _actions = {};

    PROPS_FILTER = p => p.charAt(0) != '_' && p != p.toUpperCase() && p != 'constructor' && p != 'render';

    constructor(tagName = 'div') {
        super();
        this._tagName = tagName;
        this._shadow = this.attachShadow({ mode: "closed" });
    }

    dispatch(action, data) {
        HofHtmlElement._actions[action]?.forEach(callback => callback(data));
    }

    callback(action, callback) {
        if (!HofHtmlElement._actions[action]) HofHtmlElement._actions[action] = [];

        HofHtmlElement._actions[action].push(callback.bind(this));
    }

    connectedCallback() {
        this._root = document.createElement(this._tagName);
        this._root.partialRenderingSupport = true;
        this._shadow.appendChild(this._root);

        // Only if element has no HofHtmlElement as ancestor node (this means element is used
        // directly in HTML of web page), trigger rendering (otherwise this is done by ancestor element und cannot
        // be triggered here, because in this case attributes are available, but properties are not yet parsed
        // at the time of the method)
        if (!this._hasParentElementWithPartialRenderingSupport())
            this.render();
    }

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

            // Setup message handlers
            if (prop == "callbacks" && typeof(initialValue) == "function") {
                const callbacks = initialValue.call(this);
                for (var callback of Object.keys(callbacks))                    
                    this.callback(callback, callbacks[callback]);
            }
            else if (prop == "construct" && typeof(initialValue) == "function") {
                initialValue.call(this);
            }
            else // Default Property handling
                Object.defineProperty(this, prop, {
                    get: function() { return this.getProperty(prop, initialValue); },
                    set: function(v) { this.setProperty(prop, v); },
                    enumerable: true,
                    configurable: true
                });
        })
    }

    setProperty(name, value) {
        const oldValue = this._properties[name];

        // Render again in case of complex object or on value change of simple property or on collection action     
        if (typeof(oldValue) == "object" || typeof(value) == "object" || oldValue != value || value.lastActionMethod) {
            // Process initial element-property setter calls (cache for time after template
            // has been constructed and further binding parameters are available)
            this._properties[name] = value;

            // Update properties including local binding variables
            if (this._allProperties)
                this._allProperties[name] = value;

            this._updatePropertyObservers([name, value, oldValue]);
        }

        // Make new objects observable
        if (this._allProperties)
            this._makePropertyObservable(name);
    }

    getProperty(name, initialValue) {
        if (this._allProperties)
            return this._allProperties[name];

        return this._properties[name] ?? this.getAttribute(name) ?? initialValue;
    }

    renderContent(html, params) {
        this._renderFull(html, params);               
    }

    renderList(data, template, params) {
        const expression = template.toString();
        const listIt = expression.substring(expression.indexOf('(')+1, expression.indexOf(')'));

        this._listData = data;
        this._listIt = listIt;
        this._listTemplate = template;
        this._listStart = this._root.childNodes.length;

        if (typeof(params) == "undefined" || params == null)
            params = {};

        for (const listItem of this._listData) {
            params[this._listIt] = listItem;
            this.renderContent(template, params);
        }
    }

    _hasParentElementWithPartialRenderingSupport() {
        let parent = this.parentNode;
        while (parent != null) {
            if (parent.partialRenderingSupport)
                return true;
            
            parent = parent.parentNode;
        }

        return false;
    }

    _calculateProperties() {
        let result = {};
        this._forEachPropertyOfObjectAndPrototype((prop, obj) => result[prop] = obj[prop]);

        this._allProperties = result;
    }

    _forEachPropertyOfObjectAndPrototype(func) {
        for (const name of Object.getOwnPropertyNames(this).filter(this.PROPS_FILTER))
            func(name, this);

        const prototype = Object.getPrototypeOf(this);
        for (const name of Object.getOwnPropertyNames(prototype).filter(this.PROPS_FILTER))
            func(name, prototype);
    }

    _convertToTemplateExpression(buildFunction) {
        let expression = buildFunction.toString();
        const expressionStart = expression.indexOf('`');

        if (expressionStart > 0)
            expression = expression.substring(expressionStart+1, expression.length-1);

        return expression;
    }

    _parseHTML(html, params) {
        if (typeof html == 'function') // Support arrow functions
            html = this._convertToTemplateExpression(html);

        // Erster Render-Aufruf?
        if (this._allProperties == null)
            this._calculateProperties();

        const props = this._allProperties;
        const [template, bindParams] = this._calculateTemplateAndBindParams(html, props, params);

        this._calculateBindings(template, bindParams);

        const parser = new DOMParser();
        const elements = parser.parseFromString(template, "text/html").body.childNodes;

        return [elements, props, bindParams];
    }

    _makePropertyObservable(bindingParam) {
        for (const expr of this._bindingExpressions[bindingParam])
            this._makePropertyStructureObservable(bindingParam, expr);
    }

    _makePropertyStructureObservable(bindingParam, p) {
        const o = this._allProperties[bindingParam];
        const props = p.split('.');

        let propObj = o;
        let propertyPath = bindingParam;
        for (let i=0; i<props.length; i++) {
            let lastProp = props[i];
            propertyPath += `.${props[i]}`;

            if (typeof propObj == "undefined") return;
            
            let _value = propObj[lastProp];
            if (typeof propObj == 'object') {
                if(!Array.isArray(propObj))
                    this._makeObjectObservable(propObj, lastProp, bindingParam, propertyPath);
                else
                    this._makeArrayObservable(propObj, bindingParam);
            }

            propObj = propObj[props[i]];
        }
    }

    _makeObjectObservable(obj, observerProperty, componentProperty, propertyPath) {
        let _value = obj[observerProperty];
        Object.defineProperty(obj, observerProperty, {
            get: function() { return _value; }.bind(this),
            set: function(v) {
                _value = v;
                
                let bindParam = this.getProperty(componentProperty);
                bindParam.lastActionMethod = "SET";
                bindParam.lastActionPropertyPath = propertyPath;

                this.setProperty(componentProperty, bindParam)

                bindParam.lastActionMethod = null;
                bindParam.lastActionPropertyPath = null;
            }.bind(this),
            enumerable: true,
            configurable: true
        });
    }

    _makeArrayObservable(arr, observerProperty) {
        if (!arr._observers) arr._observers = new Map();
        if (!arr._observers.has(this)) arr._observers.set(this, []);
        if (!arr._observers.get(this).includes(observerProperty)) {
            arr._observers.get(this).push(observerProperty);
        
            arr._emit = function(index, items) {
                // Use partial rendering only for change or delete operations with 1 element
                if (items.length == 0) this.lastActionMethod = "DELETE";
                else if (index == null) this.lastActionMethod = "ADD";
                else if (items.length == 1) this.lastActionMethod = "EDIT";
                this.lastActionIndex = index ?? this.length - 1;

                this._observers.forEach((properties, component) => properties.forEach(
                    property => component.setProperty(property, this)));
                
                // Reset action
                this.lastActionMethod = null;  this.lastActionIndex = null;

                return this;
            }
            arr.push = function(el) {
                Array.prototype.push.call(this, el); return arr._emit(null, [el]);
            };
            arr.splice = function(index, deleteCount, ...items) {
                Array.prototype.splice.call(this, index, deleteCount, ...items);
                if (deleteCount <= 1) return arr._emit(index, items);
            }
            arr.edit = function(index, el) { return this.splice(index, 1, el); };
            arr.delete = function(index) { return this.splice(index, 1); };
        }
    }

    _calculateBindings(html, bindParams) {
        for (let bindParam of bindParams) {
            const regexp = new RegExp(`(${bindParam})((\\.[\\w]+)*)`, 'g');

            this._bindingExpressions[bindParam] = [];

            for (const [, , expression] of html.matchAll(regexp)) {
                const expr = expression.substring(1);

                if (!this._bindingExpressions[bindParam].includes(expr))
                    this._bindingExpressions[bindParam].push(expr);
            }

            this._makePropertyObservable(bindParam);
        }
    }

    _renderFull(html, params) {
        const [elements, props, bindParams] = this._parseHTML(html, params);               
            
        const lastExistingElement = this._root.childNodes.length;

        while(elements.length > 0) // Elements are extracted from source at appendChild, therefore always first element 
            this._root.appendChild(elements[0]);

        // Incrementally process only those elements recursively that have not been processed via
        // previous renderList or renderContent method within the same render method, so that the
        // same elements are not processed multiple times and added to the observables data structure.
        for (let index = lastExistingElement; index < this._root.childNodes.length; index++)
            this._processElementBinding(this._root.childNodes[index], props, bindParams);
    }

    _renderUpdate(newBindParamValue) {
        // Only partially update components that render list, since for other components
        // other element would be added/deleted
        if (this._listTemplate != "") {
            const [elements, props, bindParams] = this._parseHTML(this._listTemplate, { [this._listIt]: this._listData[newBindParamValue.lastActionIndex] });               
            
            if (newBindParamValue.lastActionMethod == "ADD") {
                if (this._root.childNodes[newBindParamValue.lastActionIndex])
                    this._root.insertBefore(elements[0], this._root.childNodes[this._listStart+newBindParamValue.lastActionIndex-1].nextSibling);
                else
                    this._root.appendChild(elements[0]);

                this._processElementBinding(this._root.childNodes[this._listStart+newBindParamValue.lastActionIndex], props, bindParams);
            }
            else if (newBindParamValue.lastActionMethod == "EDIT") {
                this._root.replaceChild(elements[0], this._root.childNodes[this._listStart+newBindParamValue.lastActionIndex])
                this._processElementBinding(this._root.childNodes[this._listStart+newBindParamValue.lastActionIndex], props, bindParams);
            }
            else if (newBindParamValue.lastActionMethod == "DELETE")
                this._root.childNodes[this._listStart+newBindParamValue.lastActionIndex].remove();                
        }
    }

    _calculateTemplateAndBindParams(html, props, params) {
        this._renderIteration++;

        // Determine all binding variables
        const bindParams = Object.keys(props);

        // Add additional local variables to binding
        if (params) {
            for (let [n,v] of Object.entries(params)) {
                const uniqueBindingParamName = n + this._renderIteration;
                
                props[uniqueBindingParamName] = v;
                bindParams.push(uniqueBindingParamName);


                const regexp = new RegExp(`(${n})([^=-])`, 'g');
   
                for (const [expr, name, token] of html.matchAll(regexp))
                    html = html.replace(expr, `${uniqueBindingParamName}${token}`)

                if (v) html = html.replaceAll(`live(${uniqueBindingParamName})`, v.toString().substring(6));
            }
        }

        return [html, bindParams];
    }

    _processElementBinding(element, props, bindParams) {
        // Data structure for saving the original templates to element
        if (!element.templateExpressions) element.templateExpressions = {};

        // Support databinding expressions in attributes (regular DOM elements)
        if (element.attributes)
            Array.from(element.attributes).forEach(attr => {
                    if (attr.nodeValue.includes("${"))
                    this._processBindingExpression(element, props, bindParams, attr.nodeName, attr.nodeValue);
            });
        
        // Support databinding expressions within tags (TextNodes)
        if (element.data) {
            if (element.data.includes("${"))
                this._processBindingExpression(element, props, bindParams, "data", element.data);
        }

        // Edit child elements recursively
        if (element.childNodes)
            for (const childElement of element.childNodes) {
                this._processElementBinding(childElement, props, bindParams);
            }

        // Render elements with render support
        if (element.render) element.render();
    }

    _processBindingExpression(element, props, bindParams, attr, expr) {              
        const [propertyExpressionParams, propertyExpressionFunction] = this._buildCallableExpression(attr, expr, bindParams);

        this._registerObservable(element, attr, props, propertyExpressionParams, propertyExpressionFunction, expr);

        // Determine current values
        let result = [];
        for (const b of propertyExpressionParams)
            result.push(props[b]);
        
        // Get current value of element attribute by evaluating expression
        element[attr] = propertyExpressionFunction(...result);
    }

    _buildCallableExpression(attr, expr, bindParams) {
        if (attr == "data")
            expr = "`" + expr + "`";
        else
            expr = expr.replaceAll("${", "").replaceAll("}", "");

        let referencedBindParams = [];
        for (const bindparam of bindParams) {
            if (expr.includes(bindparam))
                referencedBindParams.push(bindparam);
        }

        // Currently, in addition to the local variables (additional params passed to renderContent/renderList),
        // the WebComponent's properties are also passed as local parameters to the WebComponent's attribute function,
        // which is not really necessary, but facilitates the generic handling
        return [referencedBindParams, new Function(...referencedBindParams, "return " +  expr).bind(this)];
    }

    _registerObservable(element, attr, props, referencedBindParams, propertyExpression, expr) {
        if (!this._elementAttributeBindParams.has(element))
            this._elementAttributeBindParams.set(element, {});
        this._elementAttributeBindParams.get(element)[attr] = referencedBindParams;

        for (let bindparam of referencedBindParams) {
            if (!this._observables[bindparam]) this._observables[bindparam] = new Map();

            const paramObservable = this._observables[bindparam];
            if (!paramObservable.has(element)) paramObservable.set(element, {});

            if (props[bindparam].bind)
                props[bindparam] = props[bindparam].bind(this); // this von Parent an Child mitgeben bei nach unten gereichten Callbacks

            paramObservable.get(element)[attr] = propertyExpression;
        }

        // Save original template of element attribute to check if it is dependent on subproperty changes
        element.templateExpressions[attr] = expr;
    }  

    _updatePropertyObservers(bindparam) {
        const [name, value, oldValue] = bindparam;
        const allProps = this._allProperties;

        // Render partially only if element has already been created.
        // (Setters should also be able to be called before component
        // has been created for the first time, which is why state setters
        // only change state here, but have no effect on UI yet).
        if (this._observables[name]) { 
            for (const [element, props] of this._observables[name].entries()) {
                for (const [attrName, attrValue] of Object.entries(props)) {
                    let result = [];
                    for (const b of this._elementAttributeBindParams.get(element)[attrName])
                        result.push(allProps[b]);

                    // Reevaluate binding expression
                    const newBindParamValue = attrValue(...result);

                    // Always propagate changes in properties to all observer elements and
                    // propagate changes in subproperties only if subproperty is included in binding expression / template
                    // (e.g. if data.selectedPerson.name is changed, only attributes with bindings to data, data.selectedPerson
                    // and data.selectedPerson.name, but e.g. not on data.selectedPerson.age).
                    if (!value.lastActionPropertyPath || element.templateExpressions[attrName] && element.templateExpressions[attrName].includes(value.lastActionPropertyPath)) {
                        // Partielle Updates bei Collections triggern
                        if (newBindParamValue.lastActionMethod) {
                            element._renderUpdate(newBindParamValue);
                            // console.log(`[${element.tagName ?? "TEXT"}] Partial update of ${attrName}: ${newBindParamValue.lastActionMethod} ${JSON.stringify(newBindParamValue[newBindParamValue.lastActionIndex])}`);
                        }
                        else {
                            element[attrName] = newBindParamValue;
                            // console.log(`[${element.tagName ?? "TEXT"}]: Full update of ${attrName}: ${JSON.stringify(newBindParamValue)}`);
                        }
                    }
                }
            }
        }
    }
}

// Helper function to support functional component definition as alternative to class based web component implementation
function component(name, obj, tag = "div") {
    let c = class extends HofHtmlElement {
        constructor() { super(tag); super.useAutoProps(); }
    };

    for (prop of Object.keys(obj))
        if (prop == "render") {
            const func = obj[prop]();
            if (Array.isArray(func)) {
                const renderFuncs = [];

                if (func.length > 0 && Array.isArray(func[0])) // Array mit Render-Funktionen
                    for (const renderExpr of func)
                        renderFuncs.push(_calculateRenderFunc(renderExpr));
                else
                    renderFuncs.push(_calculateRenderFunc(func))

                c.prototype["render"] = function() { renderFuncs.forEach((renderFunc => renderFunc(this))); }
            }
            else // Aufruf function
                c.prototype["render"] = function() { this.renderContent(func); };
        }
        else {
            // Due to a bug in current JS implementations, DOM events are also executed when the getter is
            // accessed, which leads to errors if DOM element / web component is not yet inserted in the
            // real DOM, so that the onXY events are stored here under a different name and later
            // registered within the class under the correct name (this works because the custom element
            // has already been registered than)
            c.prototype["event-"+prop] = obj[prop];
        }

        function _calculateRenderFunc(func) {
            if (func.length == 1) // Aufruf [function]
                return function(obj) { obj.renderContent(func[0]); };                     
            else if (func.length == 2 && typeof(func[0]) == "function") // Aufruf [function, params]
                return function(obj) { obj.renderContent(func[0], func[1]); };
            else if (func.length >= 2 && typeof(func[1]) == "function") // Aufruf [listParam, function, params]
                return function(obj) { obj.renderList(obj[func[0]] ?? func[0], func[1]);  }
        }

    customElements.define(name, c);
}