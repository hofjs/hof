interface PropertyMap {
    [propertyName: string]: Object & Partial<{
        bind(thisArg: Object, ...args: Object[]): Object;
    }>;
}
interface BindVariableExpressionsMap {
    [bindVariableName: string]: string[];
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
declare type Object = globalThis.Object & Partial<ObjectObservable>;
declare type Array<T> = globalThis.Array<T> & Partial<ArrayObservable<T>>;
declare type DOMElement = HTMLElement | Text | Node | HofHtmlElement;
declare type TemplateStringFunction = (listItemParameter?: Object) => string;
declare class AttributeExpression {
    execute: Function;
    bindVariableNames: string[];
    template: string;
    constructor(execute: Function, bindVariableNames: string[], template: string);
}
export declare abstract class HofHtmlElement extends HTMLElement {
    _tagName: string;
    _root: HTMLElement;
    _shadow: ShadowRoot;
    _properties: PropertyMap;
    _locals: PropertyMap;
    _allBindVariables: PropertyMap;
    _allBindExpressions: BindVariableExpressionsMap;
    _observersForBindVariable: Map<string, Map<DOMElement, string[]>>;
    _observerExpressions: Map<DOMElement, Map<string, AttributeExpression>>;
    _renderIteration: number;
    _listTemplate: TemplateStringFunction;
    _listData: Object[];
    _listIt: string;
    _listStart: number;
    PROPS_FILTER: (p: string) => boolean;
    REFERENCED_BIND_VARIABLE_NAMES_REGEX: RegExp;
    DERIVED_PROPERTY_FUNCTION_SIGNATURE_REGEX: RegExp;
    constructor(tagName?: string);
    connectedCallback(): void;
    abstract render(): void;
    useAutoProps(): void;
    setProperty(name: string, value: Object): void;
    getProperty(name: string, initialValue: Object): Object;
    _hasAlreadyRendered(): boolean;
    renderContent(html: TemplateStringFunction, locals?: PropertyMap): void;
    renderList(data: Object[] | string, html: TemplateStringFunction, locals?: PropertyMap): void;
    _calculateProperties(): void;
    _forEachPropertyOfObjectAndPrototype(func: (prop: string, obj: Object) => void): void;
    _convertToTemplateExpression(buildFunction: TemplateStringFunction): string;
    _parseHTML(htmlFunction: TemplateStringFunction, locals: PropertyMap): [NodeListOf<ChildNode>, PropertyMap, string[]];
    _makeBindVariableObservable(bindVariableName: string): void;
    _makeBindVariableStructureObservable(bindVariableName: string, bindingExpression: string): void;
    _callBindVariableBeforeChangedHook(obj: Object, prop: string, newValue: Object, oldValue: Object): boolean;
    _callBindVariableAfterChangedHook(obj: Object, prop: string, newValue: Object, oldValue: Object): void;
    _callBindVariableBeforePropertyChangedHook(obj: Object, prop: string, subProp: string, newValue: Object, oldValue: Object): boolean;
    _callBindVariableAfterPropertyChangedHook(obj: Object, prop: string, subProp: string, newValue: Object, oldValue: Object): void;
    _makeObjectObservable(obj: Object, observerProperty: string, componentProperty: string, propertyPath: string): void;
    _makeArrayObservable(arr: Array<Object>, observerProperty: string, componentProperty: string, propertyPath: string): void;
    _applyValueAndNotifyObservers(obj: Object, observerProperty: string, componentProperty: string, newValue: Object, oldValue: object, arrayNotification: boolean, action: Function): void;
    _registerNewObserver(obj: Object | Array<Object>, observerProperty: string, component: HofHtmlElement, componentProperty: string, componentPropertyPath: string): boolean;
    _calculateBindings(htmlFunction: string, bindVariableNames: string[]): void;
    _renderFull(htmlFunction: TemplateStringFunction, locals: PropertyMap): void;
    _removeObserversForBindVariable(bindVariableToDelete: string): void;
    _renderUpdate(value: Object): void;
    _logUpdate(element: DOMElement, name: string, value: Object): void;
    _makeDerivedVariablesObservable(variableName: string, variableBody: string, html: string): string;
    _calculateUniqueElementAndVariableName(name: string, renderIteration: number): string;
    _calculateTemplateAndBindVariableNames(html: string, props: PropertyMap, locals: PropertyMap): [string, string[]];
    _processElementBinding(element: DOMElement, bindVariables: PropertyMap, bindVariableNames: string[]): void;
    _processBindingExpression(element: DOMElement, bindVariables: PropertyMap, bindVariableNames: string[], attr: string, expr: string): void;
    _buildCallableExpression(attr: string, expr: string, bindVariableNames: string[]): AttributeExpression;
    _registerElementAttributeAsObserverForBindVariables(element: DOMElement, attr: string, bindVariables: PropertyMap, referencedBindVariableNames: string[]): void;
    _getBindVariableValues(bindVariableNames: string[]): (globalThis.Object & Partial<ObjectObservable> & Partial<{
        bind(thisArg: Object, ...args: Object[]): Object;
    }>)[];
    _updatePropertyObservers(bindVariable: [string, Object]): void;
}
declare type BeforeChangedHookName<PropertyName extends string> = `${PropertyName}BeforeChanged`;
declare type BeforeChangedHookType<PropertyType> = (newValue: PropertyType, oldValue: PropertyType) => boolean;
declare type AfterChangedHookName<PropertyName extends string> = `${PropertyName}AfterChanged`;
declare type AfterChangedHookType<PropertyType> = (newValue: PropertyType, oldValue: PropertyType) => void;
declare type BeforePropertyChangedHookName<PropertyName extends string> = `${PropertyName}BeforePropertyChanged`;
declare type BeforePropertyChangedHookType<PropertyType> = (subProp: string, newValue: PropertyType, oldValue: PropertyType) => boolean;
declare type AfterPropertyChangedHookName<PropertyName extends string> = `${PropertyName}AfterPropertyChanged`;
declare type AfterPropertyChangedHookType<PropertyType> = (subProp: string, newValue: PropertyType, oldValue: PropertyType) => void;
declare type HofHtmlElementComponentLiteralWithHooks<HofHtmlElementComponentLiteral> = {
    [Propertyname in keyof HofHtmlElementComponentLiteral]: Object;
} & {
    [PropertyName in BeforeChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?: BeforeChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    [PropertyName in AfterChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?: AfterChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    [PropertyName in BeforePropertyChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?: BeforePropertyChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    [PropertyName in AfterPropertyChangedHookName<string & keyof HofHtmlElementComponentLiteral>]?: AfterPropertyChangedHookType<HofHtmlElementComponentLiteral[string & keyof HofHtmlElementComponentLiteral]>;
} & {
    construct?: Function;
    render: Function;
};
export declare function component<T extends HofHtmlElementComponentLiteralWithHooks<T>>(name: string, obj: T, tag?: string): new () => HofHtmlElement & T;
export {};
