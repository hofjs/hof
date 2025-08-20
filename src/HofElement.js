import { extractParams, extractParamsAndBody, getNormalisedPath, parseAllHTMLs, parseAllVars, toJSPath } from "./ExtractParsing.js";
import { DEF, Queue, filterObj,nohtml } from "./helper.js";
import { laxJSON } from "./laxJSON.js";
import { css, html,Template } from "./html.js";
import { cleanSelfFromSharedObs, Delete, ForceUpdate, makeDeepObservable } from "./Observe.js";
import { CounterContext, Dependencies, SyncDesc } from "./syncDef.js";
import { Token } from "./ScopeParser.js";

/**@typedef {import("../Util/helperTypes.js").PropChangeEvent} PC_Ev*/
/**
    * @typedef {Object} SubHTML
    * @property {String} js_str - The String content of the html``, created throug combining the parsed strs and exp values
    * @property {import("./ExtractParsing.js").ParsedHTMLExp } parsed - The result from parseHMTL()
    * @property {Template|null} template
    * @property {Map<String,String>|null} replaceMap
    * @property {String} arr_prop - the prob name of the array, everything already repalced 
    * @property {String} arr_root_def - the sync name for this array 
    * @property {String} inside_arr - If this is inside an array 
    * @property {Boolean} is_fix - Anno is_fix 
    * @property {Boolean} is_exp - Anno is_exp  
    * @property {Boolean} is_dyn_exp_HTML - No Auto List but still some html fn logic  
    * @property {Map<number,SubHTML>} sub_html - Map Map to potential Array Sub HTMLs. Number is the same as of the exp ${} in html``fn
    */


export class HofOptions {
    /** Use shadow DOM . If not false, value will be passed to attachShadow Dom options. By default it is `false`  @type {Boolean|ShadowRootInit}  */
    shadow_DOM = false;
    /**The warping tag that is used, when you insert html and the ${} has no surrounding empty tag. By default it is a `"<span>"` */
    wrap_tag = "span";
    /**Used for array, that aren't already warped. By default it is a `"<ul>"` */
    arr_wrap_tag = "ul";
    /**Used for .map( x=>  html\` Only Text \`  ) if html`` has only text OR has not a single root tag. By default it is a `"<li>"` */
    arr_el_wrap_tag = "li";

    /** 
     * NOT YET IMPLEMENTED
     * will skip the update of all array elements that are shifted back during a splice. 
     * This prevents unnecesary recalcultions if the auto list does not use the index of the map function. 
     * But if it does, then the UI will be out of sync*/
    arr_lazy_splice = false;

    /**Different annos. use like ${ <ANNO> ,  <EXP> } */
    annos = {
        /**Do you match any anno at all */
        any_anno: /^(\s*(['"`]?ANNO['"`]?.*)\s*,)[^,()\]\[\{\}]+$|^(\s*((?:[^{\[\/\(]|\(\s*\))+)\s*,)/i,
        /**If you exp matches this regex, it will not use html, even if it contains tags. @example ${ nohtml, ` <hello>` }  ->   `&lt;hello&gt;`  */
        no_html_anno_re: /['"`]?no_html['"`]?/i,
        /**If you exp matches this regex, it will use html, even if it contains no tags. @example ${ html, `  <b>will be html</b>` }  */
        use_html_anno_re: /['"`]?html['"`]?/i,
        exp_anno_re: /(['"`])?exp\1?/i,
        /** use the ${} only as static initialsation. Good for fix list that do not change at runtime like the array of `<option>` of a `<select>`   */
        fix_anno_re: /(['"`])?fix\1?/i
    };

    /**If it is at all allowed to pares dynamic html */
    dynamic_html = true;
    /**
     * false: Only `${}` that contain HTML tags (`<tag ...>` ) will be parsed as html, more efficient, [Recommended] cause less `.innerHTML= ...` from the framework   \
     * 
     * true: All `${}` will be set via `innerHTML`, good if you have to display html escapes like   `\&lt;`|`\&amp;` ... and you are to lazy to allow this for single `${}`*/
    dynamic_html_default = false;

    /**Allow only in the class body defined properties */
    only_defined = true;
    /**The string that is displayed, if a value if undefined. Empty string is good for default values cause it is effectively invisible, however for debugging its by default "undefined". 
     * @example 
     * __options={undefined_val:"Nil"};
     * html`<p>${undefined}</p>` 
     * @example 
     * <p>Nil</p>
     * 
     *  */
    undefined_val = "undefined";

    /** Don't create any __syncMap Dependencies if you don't have the prop.
     * 
     * Good for manually syncing, where you can just use one template for multiple classes and the unaviailable props are ignored.
      */
    has_not_no_depend = false;

    /** Keep the Default value if you don't have prop and its undefined. Good for manually syncing, where you can just use one template for multiple classes and the unaviailable props are ignored. */
    has_not_keep_default = true;

    static temp_default = { first: "first", "type": "type", "--": "--", }
    static type_dflt = { Number: -1, String: "--", Date: "1970-01-01", Array: [], Object: '[Object --]' }
    /**
     * How the template element, that is copied for all Instances of a Component, is interpolated. Is later anyway overriden with props available in the Component Instance.
     * 
     * `"first"`:
     * Fill the synced value during Template creation with the date from the first obj that creates the Template.
     * If Instance loading is long or Component share many (primitive) values this is a good setting. It has also a smaller  Layout-Shift if you use long `${}`  (or even html) than default values like `"--"` that get filled.
     * But if you have nested Arrays or Objects this option could lead to confusing results. 
     * 
     * `"type"`:
     * Use something specific for the type
     * 
     * `"--"`:
     * Uses always the `"--"`.   
     *  Warning: If you set e.g. `<input>` you may get warnings like `"--"` is no valid Number|Date etc.
     * 
     */
    temp_default = "first";

    sync_attr = false;

    /**
     * Don't call setAttribute for this props, when an JS-props changes.
     * 
     * For standard HTML attributes like `"id"` or `"title"`, setting the JS prop already triggers a change in the DOM.
     * The default Regex uses a negative lookahead to exclude some attrs you probably don't want to set.
     * 
     * Note: for simple function Properties the str-value of the attr does not use the Function.proto.toString(), that would display the whole funtion, 
     * because it's to long. Instead a short description of the name is given and rest is ellipsed.
     * This representation is created once during template creation.
    */
    attr_reflect = /^(?!innerHTML|innerText|style|hidden)/;


    /** Do not set the .value of input select or textareas on value change. This is pointless, because before that the value property is set on them, which triggers an already  */
    value_attr_reflect = false;
    /**
     * With this regex the attribute shorthand is split.  
     * By default takes the everything before a _ in the first group
     * This is useful, cause you may have multiple elements you want to set the same attr with different attr values. 
     * Note: a leading this. is always trimed; Having no match raises Error
     * ```
     * <input ${name} > <img ${name_img} ${this.src_img2}>   ->   <input name=${ name } >  <img name=${name_img}  src=${this.src_img2}>
     * ```
     */
    shorthand_regex = /([^_]+)_?/;


    /**
     * If you have a function in the class named like a event e.g. onclick, it overrides the setter to attach a onevent function. 
     * 
     * This also applies to props like id, class, style.
     * This option solves this, through deleting the child prop and attaching it via the setter.
     * 
     * This also makes it, that the function with names like on\<event\> are automatically attached to the element.
     * Because HTML events do bubble up, you can listen to events emitted by HTML elements in the component like a `<button>` or `<form>`.
     * @example
     * class Component extends HofElement{
     *     onclick(event){...}
     *     template = html`You can click <b>ME!</b>`;
     * }
     * class FormComponent extends HofElement{
     *      onsubmit(event){...}
     *      template = html`<form> bubbles up ...</form>`;
     * }
     */
    restore_html_getter = true;

    /**The Regex, that filters what properties are used by option `restore_html_getter`  
     * It also reflects the HTML JS properties value to the attribute.
     * The default value is:
     * ```
     * /^(?:id|title|class(?:Name)?|on[^\W_]*)$/
     * ```
     * 
     * Example:
     * ``` 
     * class AB extends HofElement {
     *     id = 'id'+ Math.random();
     *     title = 'A title '+ new Date().toString();
     * }
     * ```
     * ``` html
     * <!--automatically set default value, even if not given -->
     * <a-b id="id0.3434243" title="A title 2024.11.23T04:40"></a-b>
     * ```
     */
    restore_re = /^(?:id|title|class(?:Name)?|contenteditable|on[^\W_]*)$/

    static bind = { component: "component", dom: 'dom' }
    /**If you use on<event> function, should you bind the `this` to the component.
     * 
     * **!!** Is only for Functions, `this` in Lambda functions may still refer to the component, cause its scoped.
    */
    bind = HofOptions.bind.component;

    /**Binds function to the component, even when the function is attached to a sub object like `onclick=${this.subObj.fn}` */
    flat_this=false;

    /**Give child elements a reference to their template generator element.  Good for simple html inline events
     * @example
     * html`
     * <button onclick="if(this.TEMP.trigger)this.TEMP.callAFnOfComponent(event);">Click me</button>
     * `
     */
    template_gen_ref = true;
    /**@type {string|string[]} */
    template_gen_ref_str = ["TEMP", '.~'];

    /**
     * **!!! EXPERIMENTAL, INCOMPLETE, full feature will rely on `eval()` !!!**
     * 
     * If the `html\`\`` should automatically register obj dependencies from simple Prop Dependencies
     * **!!!** This only works for objects, that are given directly, not their children. Otherwise use static ctx or HofElement.ctx.add({...}) !!!
      */
    auto_context = false;


    /**Intended for manual templates. If the textNode index does not exist, try splitting the existing text to create it */
    auto_split_textNodes = true;

    /**A convenience feature: if match has a group leave the things before it to last textNode. This allows for spaces before labels in manually defined sync attrs  */
    auto_split_grp_to_last = true;

    /**The Regex, that marks a textNode split, the last textNode is split at the match index.
     * The length of the match is removed from the Start of the split Textnode, by default it's the 3 \s.
     * The default value matches 3-4 spaces and removes them, spaces after them stay, so that here
     * if you use option auto_split_grp_to_last and match 4 spaces, it will keep one \s at the previous textnode
     * ```
     *                                        Textnodes:  v~#1   v~#2    v~#3      
     *      <p>Block 1   Block 2    some test </p> ->     Block 1Block 2 some test 
     *                                                          ^^-----^^--- 3*\s removed
     * ```
     * For advanced use cases, you could define your own Regex, that doesn't count \s at start or \n 
     * use lookbehinds (?<=  <reg> ) to keep chars
     */
    auto_split_regex = /(?<=\S)\s?(\s{3})/;

    

    /**Generates a reflect function for `<input value=${this.prop}>` , if neither `"onchange"` or `"oninput"` was manually given.
     * 
     * By Default it uses `"onchange"`.
     * Use of valueless event attribute to select other event attribute like
     * 
     * `<input oninput value=${this.prop}>`
     * @type {boolean|"onchange"|"oninput"|String}
     */
    auto_event = "onchange";

    /**Maybe in futere use  Numbers as Bitflags like attr:  write_back.sync | undefined_remove |  observe.all */
    static attr = { write_back: { all: 1, own: 2, sync: 4 }, observe: { all: 8, own: 16, sync: 32 },undefined_remove:64 }
    /**Attribute settings */
    attr = {  
        /**Remove the corresponding Attr to  a property if its `undefined` */
        undefined_remove: true, 
        /**Remove the corresponding Attr to  a boolen property if its `false` */
        bool_false_remove: true,
        /** 
         * Ensures, that only the properties of child elements are set by removing after initial set the Attr. The set proerty value stays. 
         * ```
         * `<img  onclick=${()=>'...'}> `
         * // ->
         * img.onclick  //()=>'...'
         * img.hasAttribute('onclick') //false  
         * ```
         * Also cleans potential undesired copied Attrs from the template element.  
         * Intended to remove Attr for functions or `<input>` and to produce less cluttered HTML e.g. for debugging or when needed as output */ 
        initial_clean:true,
        /** Filter granular what should be cleaned with `initial_clean` */
        initial_clean_re: /^on|^value$/,  
        /**If property changes, update the corresponding Attr */
        write_back: {all:false, own: true,sync:false },
        /**If Attr in DOM changes, update the corresponding property */
        observe: { all:false, own: true,sync:false },
    }

    /** Detemines how far the update of the DOM travels upwards */
    propagate_up=-1;
    /** Detemines how far the update of the DOM travels downwards */
    propagate_down=-1;

    /**A default Style added to all HofElement Components
     * @example 
     * //Note that the style will be automatically wrapped in the tagname 
     * HofOptions.default.style="display:block;color:red";
     * //Becomes:    css`counter- { display:block;color:red }`
     */
    style = "";

    /**@param {HofOptions} opt  */
    constructor(opt) {
        Object.assign(this, HofOptions.default);
        Object.assign(this, opt);
    }
    /**here you can put a global options overwrite Obj. This will be additionally assigned on every option creation 
     @type {HofOptions}*/
    static default = new HofOptions();
}


export class HofElement extends HTMLElement {
    /**@type {Map<Function,Template|undefined>} */
    static all_exist_TMP = new Map();
    /**The last created custum componet. These info will be read by the html``fn, to extract the exps 
     * @type {HofElement}
    */
    static last;
    /**To get it as context in created functions from this.constructor  (do not use in ctx cause then unnecessary in every comp ) */
    static html=html;
    static getLast() { return HofElement.last };
    static stash(new_last_ele = HofElement.last) {
        return HofElement.last = new_last_ele;
    };
    static unstash() {
        HofElement.last = undefined;
    }
    static resetLastAs(ele) { HofElement.last = ele }
    /**Gives you the creation number of this element, is initialy undefined, and set after class HofElement member initialisation. So it is already set during your class member init. Good for an id when option restore_html_getter is active */
    __nr = undefined;

    __is_HofElement = HofElement.GiveParentType(this) || true;


    /**returns true if the init function is executed and  Attributes are connected to this -> good for cacheing Getter */
    __init = false;
    /**returns true if the template is being constructed */
    __constructing = true;

    /**The html before anything was created, usefull if you have non shadow components and want the initial String between the tags, by default you get the innerHTML of the template */
    innerHTML_0 = this.innerHTML;

    /**Default Options
     * @returns {HofOptions|Partial<HofOptions>} */
    get __options() { return HofOptions.default }

    /**Will overwrite the Default Getter */
    set __options(val) { DEF(this, '__options', { value: val, enumerable: true, configurable: true, writable: true }) }

    /**@type {string| Template|Function<any,Template>} */
    get template() { return undefined; }

    __own_exps_val = new Map();

    constructor() {
        super();
        this.__is_attr_write_back = true;

        //remove enumerablility of some util things, also better for webkonsole autocomplete -> util things are put deeper
        DEF(this, '__is_HofElement', { value: true, enumerable: false, configurable: true });
        DEF(this, '__syncMap', { value: this.__syncMap, enumerable: false, configurable: true });
        DEF(this, '__syncMapElm', { value: this.__syncMapElm, enumerable: false, configurable: true });
        DEF(this, '__arrRoot', { value: this.__arrRoot, enumerable: false, configurable: true });
        DEF(this, '__syncHierarchy', { value: this.__syncHierarchy, enumerable: false, configurable: true });
        DEF(this, '__own_exps_val', { value: this.__own_exps_val, enumerable: false, configurable: true });
        DEF(this, '__isFnTemp', { value: false, enumerable: false, configurable: true,writable:true });
        DEF(this, 'innerHTML_0', { value: this.innerHTML, enumerable: false, configurable: true });

        DEF(this, "__unobserved", { value: this.__unobserved, enumerable: false, configurable: true });

        const filtered_obj = filterObj(this, HofElement.HofElement_props);
        DEF(this, "__before_own_init", { value: filtered_obj, enumerable: false, configurable: true });
        DEF(this, "__is_attr_write_back", { value: this.__is_attr_write_back, enumerable: false, configurable: true });
        DEF(this, "__initialSetAttr", { value: this.__initialSetAttr, enumerable: false, configurable: true });
        DEF(this, "__setAble", { value: this.__setAble, enumerable: false, configurable: true });

        DEF(this, "__fired", { value: this.__fired, enumerable: false, configurable: true })
        DEF(this, "__recalc_depend", { value: this.__recalc_depend, enumerable: false, configurable: true })
        DEF(this, '__init', { value: this.__init, enumerable: false, configurable: true })
        DEF(this, '__constructing', { value: this.__constructing, enumerable: false, configurable: true })
        this.__is_attr_write_back = false;

    }

    connectedCallback() {
        //Save the class default values
        if (!this.constructor.class_dflt) {
            this.constructor.class_dflt = { ...this };
        }

        this.__is_attr_write_back = true;
        const temp = HofElement.last; //Only needed for function templates 
        HofElement.last = this;

        //Only needed depending on the sequence of customElements.define(); Restore Attr that might be set by parent HofElement before class init, that got overriden by class init 
        Object.assign(this, this.__before_own_init ?? {})

        //Sync All Attributes
        for (const { name, value } of this.attributes) {
            if(this.__before_own_init[name])continue
            /**
             * You could also look, if the Hof element has a sync attr and attr is included in it 
             * this could mean that this is nested in a Hof element and recives attrbitutes later
             * especially when the value is still "" what could indicate, that it is about to be set
             */
            this.__FindAndSetAttr(name, value);
            this.__initialSetAttr.set(name, true);
        }

        //For react integration test
        if (HofElement.in_react) { HofElement.ReactAdapt.call(this) }


        //Attach default options to your options
        if (Object.getOwnPropertyDescriptor(this, '__options')) {
            const defaults = new HofOptions();
            this.__options = { ...defaults, ...this.__options, }
            this.__options.attr = { ...defaults.attr, ...this.__options.attr };
        }
        const { template, __options: {  restore_html_getter } } = this;



        //Is called after Attrbiutes are parsed and available on this and before any observers or syncings are done, so you can change the options here
        this.init();
        this.__init = true;
        const shadow_DOM = this.__options.shadow_DOM;


        if (restore_html_getter) { this.__restoreProtoGSetter() }

        //Set style attr default, if no directly style attr was set, style is already excluded from __FindAndSetAttr ()
        if (!this.attributes.style && this.style.constructor.name !== CSSStyleDeclaration.name) {
            const style_literal = this.style;
            //restore the default .style setter on prototype
            delete this.style;
            if(typeof style_literal==='string'){
                this.setAttribute('style',style_literal)
            }
            //treat it like a object
            else {Object.assign(this.style, style_literal);}
        }



        if (template===undefined) { console.warn(`No prop 'template' is not defined for class <${this.constructor.name}>. Now the componet has no template and acts only as a decorator for its normal children given in innerHTML. If this is undesired give a template`) }

        const existing_temp = HofElement.all_exist_TMP.get(this.constructor.name);
        const has_temp = existing_temp !== undefined;
        const is_pure = existing_temp?.is_pure;

        //Was a string without html`` or the uid from the html`` was not detected -> encoding issue?
        if (!has_temp && typeof template === 'string') {
            console.warn(`Template was a string, you need to specify the attrbiute sync manually, no external objects or expressions are possible in this way`);
            HofElement.supplyforLastTemp(new Template(template, undefined, HofElement.getLastCreatedTemplateOptions(undefined, this)), this.constructor);
            this.constructor.is_str_temp = true;
        }
        //Only if not Strings
        if (!this.constructor.is_str_temp && !this.constructor.sub_htmls) {
            HofElement.initParsing(this.constructor,true)
        }


        if (!has_temp || !is_pure) {
            //A function was given -> execute, set last to this, so the html``fn can get correct impl
            //Also execute it again if not pure, so that you can get the correct enviroment for lamda funtion 
            // (No new Tempalte is created if one existes already, this only saves the new html``fn exps to this.__own_exps_val,
            //  so that you don't need to explitly give a share Obj)
            if (!Template.isOn(template) && typeof template === 'function') {
                this.__isFnTemp=true;
                // HofElement.stash(this);
                if (this.constructor.temp_fn_context) {
                    //With automaticcly supplied scope
                    this.constructor.temp_fn_context.call(this, this.template)
                }
                else {
                    
                    this.template();
                }
                // HofElement.unstash();
            }
        }

        this.__constructing = false;
        const proto = Object.getPrototypeOf(this);
        /*Template is on prototype, remove it from yourself, 
        for enumerabllity reasons and especially if it was a string or function, makes it more consistent what this.template returns*/
        if (Object.getOwnPropertyDescriptor(proto, "template")) delete this.template;


        let dom_root = this;

        if (shadow_DOM) {
            dom_root = this.attachShadow({ mode: "open", ...shadow_DOM, });
        }
        
        
        if(this.template!== undefined){
            //in case they are used
            // this.children_0=[...this.children];
            DEF(this, 'children_0', { value: [...this.children], enumerable: false, configurable: true });
    
            this.template.copy(dom_root);

            //Saves the copied Dom elemnts in map
            this.__calcSyncMap(dom_root);

            delete this.children_0;
        }
        //replace temp ref giving 
        else{
            this.__giveTempGenRef(dom_root);
        }


        //Just some normalization to allow option attr, so that user can give it more freely
        this.__proccessObservedAttr();

        //Init deep observability
        this.__observeSelf();
        
        //Init context deep observability
        this.__registerAtContext();

       

        if (shadow_DOM && this.constructor.style_tag) {
            const style_tag = document.createElement('style');
            style_tag.textContent = this.constructor.style_tag;
            dom_root.insertBefore(style_tag, dom_root.firstChild);
        }

           
        HofElement.last = temp;
        HofElement.unstash()
        this.__is_attr_write_back = false;

        this.initAfter();
    }
    /**Called on connectedBack after the Attr parsing and before any observe init or the appending|fill of the Template with current values
     * It is empty, so you can replace HofElement.init with a custom function that is executed on every start.
     */
    init() { }
    /**Called at the end of init, here the Template exists already */
    initAfter() { }
    
    /**Called at disconnectedCallback() */
    dispose() { }

    /**@type {Map<string,Dependencies>} */
    __syncMap = new Map();
    /**
     * When this elment is removed, all its dependencies can be cleaned
     * @type {Map<HTMLElement,Set<string>>} */
    __syncMapElm = new Map();

    /** 
     * @typedef {{element:HTMLElement,counter:CounterContext,template:Template,arr_root_def:String,needs_clean:boolean}} ArrRoot
     * @type {Map<string,ArrRoot[]>} */
    __arrRoot = new Map();


    __collectAllChildrenToSYNC(dom_root,all_sync=[],start=0,end=undefined){
        const selected_chl = [...dom_root.children].slice(start, end);
        let sync_que = new Queue(...selected_chl); 
        let visited_ele; 
        let max_iter = 10000
        while ((visited_ele = sync_que.dequeue) && max_iter-- > 0) {
            if (visited_ele.attributes['SYNC']) { all_sync.push(visited_ele) }
            //ignore children of non shadow other custom components
            if (!visited_ele.__is_HofElement || visited_ele.__options?.shadow_DOM) { sync_que.enqueueHeadAll(...visited_ele.children); }
        }
        return all_sync;
    }
    __calcSyncMap(dom_root, template = this.template, ele_to_counter_map = new Map(), [start = 0, end] = [], apply_root_sync = true) {
        //Collect all elements with sync attr
        const all_sync = this.__collectAllChildrenToSYNC(dom_root, [] , start, end);
        const array_changed = new Set();

        if (apply_root_sync) {

            const root_sync_value =typeof apply_root_sync==='string'?apply_root_sync:  this.template.dom_temp.attributes['SYNC']?.value ?? "";
            //root-sync just means, this sync is for the own children, not from a potential parent HofMelement
            if (root_sync_value) dom_root?.setAttribute?.("root-sync", root_sync_value);
            //for shadow roots, reading the attribute will fail, so give the root sync value manually as backup
            this.__ApplySync(dom_root, template, ele_to_counter_map, array_changed,all_sync, 'root-sync', root_sync_value);
        }

        for (const element of all_sync) {
            this.__ApplySync(element, template, ele_to_counter_map, array_changed,all_sync,)
        }
        for (const arr_root_prop of array_changed.values()) {
            this.handleArrayChange(undefined, arr_root_prop);
        }
        //No more use
        ele_to_counter_map.clear();
        this.__giveTempGenRef(dom_root);
    }
    /**Goes over all elements with a sync attr and creates acording to ot the __syncMap and sets the initial value */
    __ApplySync(element = new Element(), template = this.template, ele_to_counter_map,/** @type {Set<String>}*/array_changed, all_sync,sync_attr_name = 'SYNC', root_sync_value) {

        //Was probably a Array Element, that was removed on Array shorten
        if (!element.isConnected) { ele_to_counter_map.delete(element); return }

        const { __syncMap, __options: { undefined_val, sync_attr, has_not_no_depend, has_not_keep_default, bind } } = this;

        const sync_attr_val = root_sync_value ?? element.attributes?.[sync_attr_name]?.value;
        if (!sync_attr_val) { return }

        if (!sync_attr) element?.removeAttribute?.(sync_attr_name);

        const sync_props_groups = sync_attr_val.split(/\s*\|\s*/);

        let auto_gen = {};

        //Events for auto gen
        const events = ['onchange', 'oninput'];
        //Abort Auto Gen if a fn is already there, but take as a hint when only as empty attr like <input onchange>
      
        auto_gen.hasPreexistingEvent =  events.some( ev_name=> element?.hasAttribute?.(ev_name)&&element.getAttribute(ev_name)!=="");
        if(!auto_gen.hasPreexistingEvent){
            auto_gen.hintedEvent = events.find(ev_name => element?.hasAttribute?.(ev_name)&&element.getAttribute(ev_name)=="");
        }

        for (const sync_props_group of sync_props_groups) {
            if(sync_props_group==="")continue;
            let { prop, recalc_type, attrs, subdepends, textNodeIndices,
                only_init, generic_value, params_fix, arr_index_name } = SyncDesc.infer(sync_props_group, element, ele_to_counter_map, this.__options);
            const prop_path = prop.split(HofElement.pathCombine);

            const is_class_getter = recalc_type === "property" && this.constructor?.__fn_g_depends?.has?.(prop.split(".")[0]);

            if (recalc_type === 'array') {
                const arr_root_end_idx = sync_props_group.match(/\s|:|#\d|\{/)?.index ?? sync_props_group.length;
                const arr_root_start_idx = sync_props_group.startsWith('~.') ? 2 : 0;
                const arr_root_def = sync_props_group.slice(arr_root_start_idx, arr_root_end_idx);

                /**@type {typeof HofElement} */
                const Class = this.constructor;
                const path_splitted = prop.split(".");
                const arr = this.__getPath(path_splitted);
                let temp;
                const template = Class?.arr_root_to_template?.get?.(arr_root_def)

                const arrRoot_arr = this.__arrRoot.get(prop) ?? this.__arrRoot.set(prop, []).get(prop);
                /** A simple annotation, to prevent it reseting its innerHTML  connecnt on array changes */
                element.__isArrRoot = true;
                const arrRoot_el = { element, template, counter: undefined, arr_root_def,needs_clean:true };
                arrRoot_arr.push(arrRoot_el);

                this.__addSyncHierarchy([prop]);
                // this.__arrRoot.set(prop, { element, template, counter: undefined });
                const is_arr = Array.isArray(arr);
                
                this.__mapGenricArrExp(arrRoot_el, ele_to_counter_map, prop, arr_index_name, [0, is_arr ? arr.length : 0, true]);

                // if (!is_arr) { continue }

                // if (arr?.length !== element.children.length) {
                    //Immediate: less efficient, cause it allways updates all array 
                    this.handleArrayChange(undefined, prop);
                    //Will be Handled later in __calcSyncMap, more efficient in case there are multiple Array Roots, that depend on the same prop
                    //But has a disadvantage with elements who's attr set are depended on children, like select with options
                    // array_changed.add(prop);
                // }
                continue
            }

            let has_not = false;
            //Just init  SYNC attr for things you don't have
            if (!only_init && recalc_type === "property" && !this.__hasProp(prop_path)) {
                has_not = true;
                if (has_not_no_depend) only_init = true;
            }

            const allDependProps = !only_init && recalc_type === "property" ? [prop, ...subdepends] : subdepends;

            //Get the function that emulates the neccessary scope, used for array
            let recalc;
            const is_lamda = /LAMBDA/.test(prop);
            if (recalc_type === 'function') {
                recalc =  template.func_depends.get(prop);
                //If the fn needs its depenpendencies from the paras
                // const fnIsSuppliedWithParams = recalc?.__supplied_params;
                if(is_lamda && (!recalc.__supplied_params  ) && this.__own_exps_val.has(prop) ){
                    recalc =this.__own_exps_val.get(prop);
                }
            }
            else if (recalc_type === 'expression') {
                recalc = template.func_depends.get(prop);
                if (typeof this.__own_exps_val.get(prop) === 'function') {
                    recalc = this.__own_exps_val.get(prop);
                }
                recalc??=()=>`fucntion ${prop} not yet found`;
            }


            //Create __snycMap entry,   only  for properties and expressions
            if (!only_init) {
                const nodeDepdObjs = [];
                const attrDepdObjs = [];
                const getter_key = is_class_getter ? prop : undefined;

                if (recalc_type === "property") {
                    for (const textNodeIndex of textNodeIndices) {
                        nodeDepdObjs.push({ textNode: element.childNodes[textNodeIndex], getter_key })
                    }
                    for (const attr of attrs) { attrDepdObjs.push({ element, attr, getter_key }) }
                }
                //A Expression  !!! Not for functions or lambas, you don't want to redefine the function everytine a part of it is set, otherwise loops
                else if (recalc_type === 'expression') {
                    for (const textNodeIndex of textNodeIndices) {
                        nodeDepdObjs.push({ textNode: element.childNodes[textNodeIndex], recalc,  params_fix })
                    }
                    for (const attr of attrs) { attrDepdObjs.push({ element, attr, recalc, params_fix }) }
                }
                let syncElmDepSet;
                if(allDependProps.length){
                    syncElmDepSet  = this.__syncMapElm.get(element) ?? this.__syncMapElm.set(element,new Set()).get(element) ;
                }
                for (const depend_prop of allDependProps) {
                    syncElmDepSet.add(depend_prop);
                    if (!__syncMap.has(depend_prop)) {
                        __syncMap.set(depend_prop, new Dependencies());
                        //for subdepenency
                        this.__addSyncHierarchy([depend_prop]);
                    }
                    const dependency = __syncMap.get(depend_prop);

                    if (recalc_type === "property") {
                        dependency.simplePropertyTextNodes.push(...nodeDepdObjs);
                        dependency.simplePropertyAttributes.push(...attrDepdObjs);
                    }
                    else if (recalc_type === 'expression') {
                        dependency.evaluatedTextNodes.push(...nodeDepdObjs);
                        dependency.evaluatedAttributes.push(...attrDepdObjs);
                    }
                }
            }

            //Initialize the value
            let value;

            //use supplied children
            let is_children=false;

            if (recalc_type === 'property') {
                //Use the innerHTML of this Component, and not of the template
                if (prop == 'innerHTML') {
                    value = this.innerHTML_0;
                }
                if (prop == 'children') {
                    is_children=true
                    value = this.children_0;
                }
                else { value = generic_value ?? this.__getPath(prop_path); }
                //For functions on this
                if (typeof value === 'function') { value = this.__handleBinding(value, element, params_fix, bind, is_lamda,prop_path) }
            }
            else if (recalc_type === 'function') value = this.__handleBinding(recalc, element, params_fix, bind, is_lamda,prop_path);
            else if (recalc_type === 'expression') {
                
                let currenTemplateEle;
                const isInnerHTML= attrs.includes( "innerHTML"); 
                if (isInnerHTML) {
                    //So that nested html`` templates can get the cached Templates 
                    currenTemplateEle = HofElement.getLast();
                    HofElement.last = this;
                }
                value = recalc.call(this, params_fix);
                if(isInnerHTML){
                    HofElement.resetLastAs(currenTemplateEle);
                }
            }
            value = value ?? undefined_val;
            

            // autoGen data collect
            auto_gen.hasPreexistingEvent =  attrs.some(  (attr)=> events.includes(attr)  )
            if (!auto_gen.attr) { 
                const inputAttrs = ["value","checked","contenteditable"]; 
                const autoGenAttr = attrs.findLast( (attr)=> inputAttrs.includes(attr)) ?? (element.hasAttribute("contenteditable")&& element.getAttribute("contenteditable")!=="false"? "contenteditable":undefined );
                if(autoGenAttr){
                    Object.assign( auto_gen , { prop_path, value, attr:autoGenAttr });
                }
            }
            if (textNodeIndices.length === 1 && (element.localName === "textarea"|| auto_gen.attr==="contenteditable")) {
                Object.assign( auto_gen , { prop_path, value, }); 
            };

            if (has_not && has_not_keep_default) { continue }


            for (const attr of attrs) {
                const any_set = this.__handleSet(element, attr, value, undefined, undefined, true);
                if (!any_set) continue;
                if(attr==='innerHTML'){
                    this.__collectAllChildrenToSYNC(element, all_sync);
                }
            }


            for (const textNodeIndex of textNodeIndices) {
                if(is_children){
                    const childNodesAll= [...element.childNodes];
                    const up_to=childNodesAll.slice(0,textNodeIndex);
                    const after=childNodesAll.slice(textNodeIndex+1);
                    element.replaceChildren(...up_to, ...this.children_0,...after);
                    continue
                }
                if(textNodeIndex>element.childNodes.length-1){
                    //Dynamic auto textnode append, max 3, -> no spliting -> simpler than the once inite auto append
                    const to=Math.min(textNodeIndex,element.childNodes.length+3);
                    for(let i=element.childNodes.length;i<=to ;i++){
                        element.append(' ');
                    }        
                }
                //Replace Comment with an empty textnode
                if( element.childNodes[textNodeIndex].nodeType == Node.COMMENT_NODE){
                    element.childNodes[textNodeIndex].after(" ");
                    element.childNodes[textNodeIndex].remove();
                }
                element.childNodes[textNodeIndex].data = value;
            }


        }
        //Genrates automatic change input events for inputs|textareas
        if(!element.__is_HofElement && !auto_gen.hasPreexistingEvent) this.__autoGen(element, auto_gen.prop_path, auto_gen.value, auto_gen.attr,auto_gen.hintedEvent);

        ele_to_counter_map.delete(element);

    }
    /**Retruns a function, that is correctly bound to either Component or the element */
    __handleBinding(fn, element, params_fix, bind_opt = this.__options.bind, is_lamda,prop_path) {
        //fn is marked during Template Gen, if it needs a param
        const arr_param_idx = fn.__supplied_params ? [params_fix] : [];

        const is_bind_this = bind_opt === HofOptions.bind.component;

        //for paths use the binding <button onclick=${this.obj.fn} >  -> bind to this.obj and not to this
        const use_this=this.__options.flat_this? this : (this.__getPath(prop_path.slice(0,-1)) ?? this);

        if (!is_bind_this && arr_param_idx.length > 0) { params_fix['_ele'] = use_this; }

        return (is_bind_this && !is_lamda) || arr_param_idx.length > 0 || fn.__supplied_params ?
            fn.bind(is_bind_this ? use_this : element, ...arr_param_idx)
            : fn;
    }

    /**
     * Some HTML Elements or Custo ones throw Error if you Set certain props. Therfore this Map is built to not set them 
     * It stores Result per Tag of setAble(), to avoid going over the prototyp chain every single Setting @type {Map<String,Map<String,Boolean>> } */
    __setAble = new Map();

    /**
     * This handles the Setting of a Prop. It deals with Setterless Prop and DOM Attrbitue Options \
     * Retruns false if nothing was set 
     * @param {HTMLElement} element  @param {String} attr  @param {String} val_str  @param {boolean} initial 
    */
    __handleSet(element, attr, val, val_str, event, initial = false) {
        const { dynamic_html, attr_reflect,value_attr_reflect, undefined_val, attr: { bool_false_remove, undefined_remove,initial_clean,initial_clean_re  },bind } = this.__options;

        //.__is_HofElement might be still undefined, there hypon test
        const is_hof =   element.__is_HofElement ??  element.tagName.includes("-");
        //to avoid lower case problem. Info using __is_HofElement does not work on first try here, cause it might still not yet inited
        if (is_hof) {
            attr = element?.constructor?.attr_name_map?.get?.(attr) ?? attr;
        }
        if (!dynamic_html && attr == "innerHTML") { throw Error("At " + this.constructor.name + " tag " + element.tagName + ": Use of dynamic HTML, despite the  __options parse_html=false. Set Option parse_html=true . Or try to separate your html, so that the prop from the ${} can be interpreted as a pure Textnode like:\n html` ${  `<i> ${this.prop}  </i>`  } `  -> html` <i> ${this.prop} </i>`" + "\nIn case it occurred at runtime, the __options is already false and you want that the html inside your prop is evaluated as innerHTML, you can also use the no_html|html Annotation ${ 'nohtml' , ... } or ${ nohtml , ... } , { 'html', ... } or {html, ... }") }

        const attr_Map = this.__setAble.get(element.localName) ?? this.__setAble.set(element.localName, new Map()).get(element.localName);

        const isSetable = attr_Map.get(attr) ?? attr_Map.set(attr, setAble(element, attr)).get(attr);

        
        //Check if initial_clean, !!! Do this before you set the property, otherwise HTML Attr linked props like id,class or on.* (functions) are overwritten
        let initial_clean_re_matched=false;
        if (initial && initial_clean&& initial_clean_re.test(attr) ){
            initial_clean_re_matched=true;
            const tempAttrWrite = element?.__stashAttrWrite?.(true);
            element.removeAttribute(attr);
            element?.__unstashAttrWrite?.(tempAttrWrite);
        } 

        /*if the child has the same obj and it is a HofElement element, the setting here will do nothing (set with   old_val === new_val   is aborted )
        the Change is propagate through shared_obj in Observe.js, 
        */
        if (isSetable) {
            if (attr == "innerHTML") {
                if(  Template.isOn(val)){
                    val.copy(element);
                    // this.__cleanOld();
                    this.__cleanUnder(element, event?.path );
                    this.__calcSyncMap(element, val, undefined, undefined, false);
                }
                // test for being a html element or array of them
                else if(val instanceof Node){
                    element.replaceChildren(val);
                }
                // very rough, but catches mao with varing child nodes  as   ${ new Array(20).fill(10).map(x=>  cond1? html`<img><img>`:html`<img>` )  }
                else if( val?.[0] instanceof Node || val?.[0]?.[0] instanceof Node){
                    element.replaceChildren(...val.flat(2));
                }
                else{
                    const innerHTML_str = this.__expToString(val,'handleSet');
                    element[attr] = innerHTML_str;
                }
            }
            else{
                if(!initial && typeof val === "function"){
                    val=this.__handleBinding(val,element,{},bind,false,[])
                }
                if(is_hof && (attr ==='class'||attr ==='classname')){
                    attr = 'className';
                }
                element[attr] = val;
            }
        }
        //Don't Set Attr on Hofelements, cause they would try to parse it from String 
        if (is_hof) {
            // if (!event || isPrimitive(val)) return isSetable
            return isSetable;
        }
        //if initial_clean was performed
        if(initial_clean_re_matched) return isSetable

        //Check if you have to set DOM attr dont do this on initial set
        if (!initial && (attr_reflect === false || attr_reflect?.test?.(attr) === false)) { return isSetable }
        
        if(!value_attr_reflect&&(element.matches('select,textarea')|| (element.matches('input')&&!element.type==='submit'))){
            return isSetable;
        }
        //Don't do it for functions, the toString may be very long -> a good str representation should already be set during Template creation
        //Also don't set attr for innerHTML 
        if (typeof val === "function"||attr == "innerHTML") { return isSetable }

        const tempAttrWrite = element?.__stashAttrWrite?.(true);

        if (bool_false_remove && val === false || undefined_remove && val === undefined) {
            element.removeAttribute(attr);
            element?.__unstashAttrWrite?.(tempAttrWrite);
            return isSetable;
        }

        element.setAttribute(attr, val_str ?? (val ?? undefined_val) + "");
        element?.__unstashAttrWrite?.(tempAttrWrite);
        //cause, here must have been at least the attr set
        return true;
    }
    /**
     * Convert a `${}` to string before it is attached to the a HTML text node or attribute.  
     * Good to avoid `[object object]`
     */
    __expToString(exp,context){
        if(context==="autoListEmpty"&& Template.isOn(exp) )return exp;
        return (exp ?? this.__options.undefined_val)+"";
    }
    /**Goes over all children and maps them and all their children with their childNode index */
    __mapGenricArrExp(/**@type{ArrRoot}*/ arrRoot_el, ele_to_counter_map, prop = "", arr_index_name, [start = 0, end, trim_excess = false] = [], key = "__i") {
        //Look if yo already have a counter
        /**@type {CounterContext} */
        let base_counter = arrRoot_el.counter;
        const element = arrRoot_el.element;
        if (!base_counter) {
            //Look if you are inside nested array with own Counter -> you need to save this Context, for recalc purpose.
            const parent_counter = ele_to_counter_map.get(element);
            if (parent_counter) {
                base_counter = new CounterContext([arr_index_name], prop, parent_counter);
            }
            else {
                base_counter = new CounterContext([arr_index_name], prop, undefined, true);
            }
            arrRoot_el.counter = base_counter;
        }
        let i = start;
        const selected_chl = [...element.children].slice(start, end);
        for (const child of selected_chl) {
            let turn_counter = base_counter.getIncCounter(i);

            ele_to_counter_map.set(child, turn_counter)
            const queue = new Queue(...child.children);
            let chl_chl;
            while (chl_chl = queue.dequeue) {
                if (chl_chl.attributes['SYNC']) {
                    ele_to_counter_map.set(chl_chl, turn_counter);
                }
                if (!chl_chl.__is_HofElement) queue.enqueueHeadAll(...chl_chl.children);
            }
            i++;
        }
        //If your length differs from Templates inital Length. Only for initial children in __calcSyncMap that haven't yet any __syncMap Dependencies.
        if (trim_excess && element.children.length > end) {
            element.replaceChildren(...[...element.children].slice(0, end));
        }
    }

    /**
     * You can mark the DOM element that fired last here, so that you don't reset the values for inputs
     * @type {HTMLElement}*/
    __fired;

    __autoGen(/** @type {HTMLElement}*/element, prop_path, prop_val, attr,hintedEvent) {
        const { auto_event } = this.__options;
        if (!auto_event) return;
        if (!prop_path) return;

        //Is Expression or Function
        if (prop_path[0].startsWith('#')) { return }

        const tag = element.localName;
        // toggle-button <button checked=${this.propState}></button>
        const isButton = tag==="button";
        const isContentEdible= attr==="contenteditable" || element.hasAttribute("contenteditable") && element.getAttribute("contenteditable")!=="false" && [...element.childNodes].reduce((a, x, i) => /\S/.test(x.data) ? a + 1 : a, 0) <= 1;
        const is_input_like = /input|select|text/.test(tag) || isContentEdible || isButton ;
        //For textareas, also if they look like <textarea>  ${this.text} </textarea> , they should only have one ${} in them
        const isInTextAreaIndex = tag === "textarea" && [...element.childNodes].reduce((a, x, i) => /\S/.test(x.data) ? a + 1 : a, 0) <= 1;
        if (!is_input_like || (tag === 'textarea' && !isInTextAreaIndex)  ) return;

        if (element.__is_HofElement && !element.constructor.all_def_names.includes('value')) {
            console.warn(`At:${element.tagName} \nTo Use the Auto Generation of on input|change Events on Custum Elements they need the prop value defined\nElement`, element)
            return
        }
        const events = ['onchange', 'oninput'];
        //Abort Auto Gen if a fn is already there, but take as a hint when only as empty attr like <input onchange>
        

        let event_name = hintedEvent ?? (isContentEdible?'oninput':typeof auto_event === "string" ? auto_event : events[0]);
        const is_num = typeof prop_val == "number";
        const is_bool = typeof prop_val == "boolean";
        const attr_is_checked= attr === 'checked';
        const is_toogle_button = isButton || (is_bool && (element.type == "button"))?`!target.${attr_is_checked?'checked':'value'}`:"";
        const is_checkbox = (element.type == "checkbox" || is_bool) && attr_is_checked;

        const value= isContentEdible? 'textContent':'value';
        
        const infoComment= `\t/*Auto Generated Binding, disable via option:auto_event*/\n\t`;
        const JSPath=toJSPath(prop_path);
        let body = `${infoComment}/* The fired prevents, that during afterChanged the fireing Attr Dependency is updated*/\n\tconst target=event.target.${value}!==undefined?event.target:event.currentTarget;\n\tthis.__fired = target;\n\tthis.${JSPath}=${is_checkbox ? 'target.checked' : is_num ? `Number(target.${value})` : is_bool ? `target.${value}===''?false:!/^\s*(?:false|null|undefined|nil|none|no)\s*$/i.test(target.${value})` : `target.${value}`}\n\tthis.__fired = null;`;
        if(is_toogle_button){
            event_name="onclick";
            body = `${infoComment}\n\tconst target=event.target.${value}!==undefined?event.target:event.currentTarget;\n\tthis.${JSPath}=${isButton?`!this.${JSPath}`: is_toogle_button};`
        }
        const onevent = new Function("event", body);
        element[event_name] = onevent.bind(this);
        if (tag === "input" && !element.attributes.type) {
            if (is_num) {
                element.type = "number";
                // if (!element.attributes.step) { element.step = 'any' }
            }
            if (is_checkbox) { element.type = "checkbox"; }
            else if (is_bool) { element.dataset.boolCast = "" }

        }
    }

    /**Will be not observed. use either string keys or regex example:
     * ```
     * __unobserved = ["prop1", "element", /on.*|_.+/]
     * ```
     */
    __unobserved = [];
    __observeSelf() {
        //maybee filter for keys that are components themself
        const not = [...HofElement.HofElement_props, ...this.__options.template_gen_ref_str, ...this.__unobserved];
        makeDeepObservable(this, { __path: [], __root: this, not })
    }


    /** 
     * Searches a attr whos lowercase is defined on this component. Then infers the Type from a default value and converts the value from String to it the found Type  
     * @param {String} name @param {String} value*/
    __FindAndSetAttr(name, value, set = true) {
        if (!this.constructor.attr_name_map) {
            //Simples matching after setting all to small
            const attr_name_map = this.constructor.attr_name_map = new Map([['__options', '__options']]);
            Object.getOwnPropertyNames(this).forEach(x => attr_name_map.set(x.toLowerCase(), x));
        }
        if (!this.constructor.default_types) {
            //Make that a JSON/laxJSON is performed on __options
            this.constructor.default_types = new Map([['__options', {}]]);
        }
        //onevent Functions ignorieren
        if (typeof this[name] === 'function' /*&& name.startsWith("on")*/) { return value}

        let use_name;
        let use_val = value;
        if (name == "sync") return value;

        const default_types = this.constructor.default_types
        const new_is_str = typeof value ==='string';
        let is_bool = false;

        if ( name !== 'style' && (use_name = this.constructor.attr_name_map.get(name))) {

            //May be set in parent with wrong casing before this class was attached, remove lower case version
            if (use_name !== name && Object.hasOwn(this, name)) {
                this[use_name] = this[name];
                //deleting avoids confusion
                delete this[name];
            }
            
            //Store the initial type
            let default_val = default_types.has(use_name) ? default_types.get(use_name) : default_types.set(use_name, this[use_name]).get(use_name);
            if (typeof default_val === 'number') use_val = Number(use_val);
            if (typeof default_val === 'boolean'){is_bool=true ;use_val = value === "" ? true : /^(?:false|null|undefined)$/.test(use_val + "") ? false : Boolean(use_val);}
            if (default_val?.constructor?.name === 'Date') use_val = new Date(Date.parse(use_val));

            //Object Literal
            if (['Object', 'Array'].includes(default_val?.constructor?.name)) {
                try { use_val = JSON.parse(use_val); } catch (e) { try { use_val = laxJSON(use_val); } catch (e) { } }
            }

        }
        if(!new_is_str){
            if(is_bool){
                use_val=false;
            }
            else{
                use_val=value
            }
        }
        
        if (!set) return use_val;
        return this[use_name ?? name] = use_val;
    }

    /**Only for init attr option, is object and the destruction does not deeply init it*/
    __proccessObservedAttr() {
        if (!Object.getOwnPropertyDescriptor(this, '__options')) return;
        const attr = this.__options.attr;

        if (!attr) { this.__options.attr = { write_back: false, observe: false }; return }


        const write_back = attr.write_back;
        let write_back_bools;

        if (write_back?.own) { write_back_bools = [false, false, true]; }
        else if (write_back?.sync) { write_back_bools = [false, true, false]; }
        else if (write_back?.all) { write_back_bools = [true, false, false]; }

        if (write_back) [write_back.all, write_back.sync, write_back.own] = write_back_bools;


        const observe = attr.observe;
        if (!observe) return;
        let observe_bools;


        if (observe.own) { observe_bools = [false, false, true]; }
        else if (observe.sync) { observe_bools = [false, true, false]; }
        else if (observe.all) { observe_bools = [true, false, false]; }

        [observe.all, observe.sync, observe.own] = observe_bools;
    }

    /**A boolean if a setAttr comes from the Framework and it can be ignored on attribute Change 
     * On default its true . After finished init, it is set to false. Then whever the Framework need to .setAttr it will go to true again.
    */
    __is_attr_write_back = true;


    /**
     * This should be automaticlly called with the this of your Component.
     * The obseved Attributes are only read once by the native Webcomponent, and changing them later has no effect. 
     * But I could not 100% figure out when this is called, it might not depending on the order of customElements.defines() or if it's the first Object of the Class
     * So if you want to play save, that this.setAttribute() or changing attr in webconsole triggers a rerender, use following line:
     * ```
     * class MyComp extends HofElement{
     *      
     *      static observedAttributes = super.observedAttributes;
     * 
     * }
     * ```
     * This calls the Getter observedAttributes on HofElement and returns an Array with all defined variables. They are parsed from Class.toString(). The String parsing must be done anyway, for reasons.
     * You can filter it even more, if you like.
     * @type {String[]}*/
    static get observedAttributes() {
        if (this.name === HofElement.name) return [];
        const Class = this;//Is the Class that you create
        const  filterd = HofElement.ExtractAllNames(Class).filter(x => !x.startsWith("__") || /__options/.test(x));
        return filterd.map(x=>x.toLowerCase());
    }

    /**
     * 
     * A Getter that does internally the same as observedAttributes, but you only have to write
     * ```
     * class MyComp extends HofElement{
     *      //manually: this is standart Webcomponent behavior, You can use this
     *      static observedAttributes = ['count', 'info'];
     * 
     *      //Close to standart, but writing out 'observedAttributes' is long
     *      static observedAttributes = super.observedAttributes;          
     * 
     *      //Short Syntax via static class initializer block
     *      static {super.init_obs_attr}
     * }
     * ```
     * 
     * @returns {string[]}
    */
    static get init_obs_attr() {
        const Class = this;//Is the Class that you create
        const obs_attr = Class.observedAttributes;
        DEF(Class, 'observedAttributes', { value: obs_attr, configurable: true })
        return obs_attr;
    }

    __initialSetAttr = new Map();

    attributeChangedCallback(name, old_val, new_val) {
        if (!this.__options.attr?.observe) return; //All Observe disabled via option
        const observe = this.__options.attr?.observe ?? {};

        if ( old_val === null&&!this.__is_HofElement && !(observe.all || observe.sync)) return //initial Set or attribute does not exist
        if (this.__is_attr_write_back) { return }

        if (observe.own && !this.__initialSetAttr.has(name)) { return } //Only onwn and was not in initial Attrbiutes, therefore return
        //If you only want to Sync Attr, that are in __syncMap a.k.a. the render depends on them
        if (observe.sync && !this.__syncMap.has(name)) { return }

        // console.log(`DOM Attribute  ${name} of `, this, `was changed.`);

        const temp = this.__is_attr_write_back;
        this.__is_attr_write_back = true
        //Has no Type extract
        // this[name] = new_val;

        if (HofElement.in_react) {
            HofElement.ReactSet.call(this, name);
        } else {
            this.__FindAndSetAttr(name, new_val);
        }

        this.__is_attr_write_back = temp;
    }

    __restoreProtoGSetter() {
        const proto = Object.getPrototypeOf(this);
        if (proto._restore_no) return;
        const restore_re = this.__options.restore_re;
        //for fuunctions, store original fn on prototype
        const event_props = (proto._restored_ev && Object.keys(proto._restored_ev)) ?? Object.getOwnPropertyNames(proto).filter(prop =>prop!=='constructor'&& restore_re.test(prop))
        //for props, store only array with name
        const props = proto._restored_props ?? Object.getOwnPropertyNames(this).filter(prop =>prop!=='constructor'&& restore_re.test(prop))
        if (!event_props.length && !props.length) { proto._restore_no = true; return }
        proto._restored_ev ??= {};
        proto._restored_props ??= props;
        for (let prop of event_props) {
            const val = this[prop] ?? proto._restored_ev[prop];
            if (typeof val === 'function') {
                proto._restored_ev[prop] ??= val;
                /**Delete the value function on proto, the set the event via the setter*/
                delete proto[prop];
            }
            this[prop] = val;
        }
        //Set the Attribute in before changed
        for (const prop of props) {
            const path = `${prop}BeforeChanged`;
            const attr_prop = prop === 'className' ? 'class' : prop;
            /**Also clean for property functions like   onclick = (ev)=>console.log(ev,this) */
            if(prop.startsWith('on')&& typeof this[prop]==='function'){
                this.addEventListener(prop.slice(2),this[prop]);
            }
            else {
                this.setAttribute(attr_prop, this[prop]);
            }
            const restoreFn = function (_) {
                if(this.__is_attr_write_back)return;

                const temp = this.__is_attr_write_back;
                this.__is_attr_write_back = false;
                if(typeof _.new_val==='function'){
                    this.removeEventListener(prop.slice(2),_.old_val);
                    this.addEventListener(prop.slice(2),_.new_val);
                }
                else this.setAttribute(attr_prop, _.new_val)
                this.__is_attr_write_back = temp;
            };
            DEF(restoreFn,'__restore_getter_fn',{value:true, writable:false,configurable:true})
            DEF(this,path,{value:restoreFn,configurable:true,writable:true,enumerable:false})
        }
    }

    static pathCombine = '.';

    /**@param {PC_Ev} event */
    beforeChanged(event) {
        //Sequence of allPaths is not guaranteed to follow a perfect tree, so emit at least the triggering event path always first 
        const isCtx = event.path[0]==='constructor';
        const isCtxOnsharedPath =  this.__meta?.__shared_paths?.get?.(event.path[0]) !==undefined;
        const relevantPathStart = isCtx? 2 : 0; 
        
        const path_str=event.path.slice(relevantPathStart).join(HofElement.pathCombine);
        
        const method = `${path_str}BeforeChanged`;
        let res;
        //Check to prevent collisons with __restore_getter_fn before Hook;
        if(!this[method]?.__restore_getter_fn){
            res= this[method]?.(event);
            if(res!==undefined)return res;
        }
        
        //try only last path on target & not in Ctx
        if(!isCtx && !isCtxOnsharedPath && this[method]===undefined && event.path.length>1) res= event?.target?.[`${event.path.at(-1)}BeforeChanged`]?.(event)
        if(res!==undefined)return res;

        const options = this.__options;
        const propagate_up = event?.propagate_up ?? options.propagate_up;
        const propagate_down = event?.propagate_down ?? options.propagate_down;
        
        const allPaths = this.__pathUp(event.path,isCtx,propagate_up);
        allPaths.push( ...this.__getAllSubDependencies(event.path,undefined,propagate_down));

        for (const path of allPaths) {
            if(!this.__propagateConstrainValid(event,path,propagate_up,propagate_down))continue;

            const cur_joined_path = path.slice(relevantPathStart).join(HofElement.pathCombine);
            if (cur_joined_path === path_str) { continue }

            const method = `${cur_joined_path}BeforeChanged`;
            res= this[method]?.(event);
            if(res!==undefined)return res;
        }
        //old simple before events
        // const method = `${event.path.join(HofElement.pathCombine)}BeforeChanged`;
        // return this[method]?.call(this, event);
    }
    /**To prevent infinite Recursion and or Duplicate Reender of Exps ${}, that depend on multiple prop and make multiple sets e.g.  let name="AA",l=10;`${name+="|",l+=100  }` 
     * Only neccessary on recall Operations.
     * @type { Map<Object,true>}
    */
    __recalc_depend = new Map();

    /** 
     * To manually emulate the SYNC Recalc after a Change Event, you can give a Object like {path: ['prop1','subprop1','4','yyy'  ]}
     * Use the path:['this'] to trigger it for all props on the template.
     * @param {PC_Ev} event 
    */
    afterChanged(event) {
        const path_str = event.path.join(HofElement.pathCombine);
        const { undefined_val, attr_reflect, attr: attr_op } = this.__options;
        const {  __recalc_depend, __arrRoot } = this;

        
        //***parent paths
        const isCtx = event.path[0]==='constructor';
        /**  For ctx dependent things do only propagate up to the obj root  
           e.g. [constructor, ctx, shareObj, name] => [shareObj, name]
           -> saves updates especially for gloabal ctx and good enough as long as there is no constructor.ctx dependency on this use on ${ this.fn(this) }
        */
        const relevantPathStart = isCtx? 2 : 0; 
        const options = this.__options;
        const propagate_up = event?.propagate_up ?? options.propagate_up;
        const propagate_down = event?.propagate_down ?? options.propagate_down;


        //Collect up paths 
        const allPaths = this.__pathUp(event.path,isCtx,propagate_up);
       

        let subDepends = [];
        const isArrayRoot = __arrRoot.has(path_str);
        //Let Array determine what subdepenenies don't need to be changed,
        if (isArrayRoot) { subDepends = this.handleArrayChange(event, path_str, event.path) ?? [] }
        //Compute all Subdepenencies
        else if(propagate_down!==0) { subDepends = this.__getAllSubDependencies(event.path,undefined,propagate_down) }

        allPaths.push(...subDepends)

        // const old_last= HofElement.last= this; //for html`` in Expressions in ${}

        //to prevent recalcing the same thing again. Similar as __recalc_depend, but local to the function 
        const __recalc_depend_local = new Set();

        for (const path of allPaths) {
            const cur_joined_path = path.join(HofElement.pathCombine);
            const prop_depend = this.__syncMap.get(cur_joined_path);

            //Update Subdepentent Arrays, the len compare is a easy way to prevent updating own parent array
            if (__arrRoot.has(cur_joined_path) && path.length > event.path.length) {
                this.handleArrayChange({}, cur_joined_path, path);
            }

            if (!prop_depend) { continue; }

            let new_val = this.__getPath(path);
            //To avoid multiple getter call in toString
            let new_val_str = this.__expToString(  new_val, 'afterChanged');

            //to only calculate the getter values once, save them in a map
            const calc_get = new Map();

            for (let i=0;i<prop_depend.simplePropertyTextNodes.length;i++) {
                const depend= prop_depend.simplePropertyTextNodes[i];
                if(__recalc_depend_local.has(depend)){continue}
                __recalc_depend_local.add(depend);
                const { textNode, getter_key } = depend;
                if(this.__isUnconnected(textNode,depend,prop_depend.simplePropertyTextNodes)){i--;continue}
                if (textNode.parentElement === this.__fired) { continue }
                if (getter_key) {
                    textNode.data = (calc_get.has(getter_key) ?
                        calc_get.get(getter_key) :
                        calc_get.set(getter_key,this.__expToString( this.__getPath(getter_key.split('.')) ,'afterChangedGetter')).get(getter_key)
                    ) ?? undefined_val;
                    continue
                }

                textNode.data = new_val_str;
            }
            for (let i=0;i<prop_depend.simplePropertyAttributes.length;i++) {
                const depend= prop_depend.simplePropertyAttributes[i];
                if(__recalc_depend_local.has(depend)){continue}
                __recalc_depend_local.add(depend);
                const { element, attr, getter_key } = depend;
                if(this.__isUnconnected(element,depend,prop_depend.simplePropertyAttributes)){i--;continue}

                if (element === this.__fired && (/value|checked/.test(attr) || (element.hasAttribute('contentEditable') && element.attributes?.contentEditable !== 'false'))) { continue }
                const new_val_g = getter_key ?
                    (calc_get.has(getter_key) ?
                        calc_get.get(getter_key) :
                        calc_get.set(getter_key, this.__getPath(getter_key.split('.'))  ).get(getter_key)
                    )
                    : new_val;
                this.__handleSet(element, attr, new_val_g, undefined, event)

            }
            for (let i=0;i<prop_depend.evaluatedTextNodes.length;i++) {
                const depend= prop_depend.evaluatedTextNodes[i];
                if(__recalc_depend_local.has(depend)){continue}
                __recalc_depend_local.add(depend);
                const { textNode, recalc, params_fix } = depend;
                if(this.__isUnconnected(textNode,depend,prop_depend.evaluatedTextNodes)){i--;continue}
                if (textNode.parentElement === this.__fired) { continue }
                if (__recalc_depend.has(recalc)) { continue } else { __recalc_depend.set(recalc, true) }

                const new_val = recalc.call(this, params_fix);
                textNode.data =  this.__expToString( new_val ,'afterChangedTextNodeExp');

                __recalc_depend.delete(recalc);
            }
            for (let i=0;i<prop_depend.evaluatedAttributes.length;i++) {
                const depend= prop_depend.evaluatedAttributes[i];
                if(__recalc_depend_local.has(depend)){continue}
                __recalc_depend_local.add(depend);
                const { element, attr, recalc, params_fix,  } = depend;
                if(this.__isUnconnected(element,depend,prop_depend.evaluatedAttributes)){i--;continue}
                if (element === this.__fired && (/value|checked/.test(attr) || (element.hasAttribute('contentEditable') && element.attributes?.contentEditable !== 'false'))) { continue }
                if (__recalc_depend.has(recalc)) { continue } else { __recalc_depend.set(recalc, true) }


                let currenTemplateEle;
                if (attr === "innerHTML") {
                    if(isArrayRoot && [...element.children].some(child=> child.__isArrRoot)){
                        continue;
                    }
                    currenTemplateEle = HofElement.getLast();
                    HofElement.last = this;
                }
                const new_val = recalc.call(this, params_fix);

                const any_set = this.__handleSet(element, attr, new_val, undefined, event);
                __recalc_depend.delete(recalc);
                if (attr === "innerHTML") {
                    HofElement.resetLastAs(currenTemplateEle);

                }

                // if (!any_set) continue;
                // //Does not work currently inside arrays 
                // if (attr === "innerHTML" && Template.isOn(new_val)) {
                //     this.__calcSyncMap(element,)
                // }
            }


        }
        __recalc_depend_local.clear();
        __recalc_depend.clear();
        // HofElement.last= old_last;


        if (attr_op && !this.__is_attr_write_back) {
            //If you set or touch the attr in after change, you prevent a loop
            this.__is_attr_write_back = true;
            const { write_back, write_back: { all, sync, own }, undefined_remove, bool_false_remove } = attr_op;
            if (write_back && event.path.length == 1 && (all || (sync && this.__syncMap.has(event.path[0])) || (own && this.__initialSetAttr.has( (event.path[0]+"").toLocaleLowerCase())))) {
                const new_val = event.value;
                if ((undefined_remove && new_val === undefined) || bool_false_remove && new_val === false) {
                    this.removeAttribute(event.path[0]);
                }
                else {
                    this.setAttribute(event.path[0],this.__expToString(  new_val, 'attrWriteBack',event.path[0] ));
                }
            }
        }


        //Emit the event after all changes for ALL path are applied
        // Good for fixing Bugs with invalid input type Sequence e.g <input type="color" value="..."> lead: 
        //  ->Warning stores3.js:100 The specified value "orange" does not conform to the required format.  The format is "#rrggbb" where

        //Sequence of allPaths is not guaranteed to follow a perfect tree, so emit at least the triggering event path always first 
        const method = `${path_str}AfterChanged`;
        this[method]?.(event);

        const isCtxOnsharedPath = this.__meta?.__shared_paths?.get?.(event.path[0]) !== undefined;
        //try only last path on target and don't when in ctx
        if(!isCtx && !isCtxOnsharedPath &&  this[method]===undefined && event.path.length>1)event?.target?.[`${event.path.at(-1)}AfterChanged`]?.(event)
        
        for (const path of allPaths) {
            if(!this.__propagateConstrainValid(event,path,propagate_up,propagate_down))continue;

            const cur_joined_path = path.slice(relevantPathStart).join(HofElement.pathCombine);

            if (cur_joined_path === path_str) { continue }

            const method = `${cur_joined_path}AfterChanged`;
            this[method]?.(event);
        }

        this.__is_attr_write_back = false;
    }
    __propagateConstrainValid(event,path,dflt_propagate_up,dflt_propagate_down){
        const propagate_up = event.propagate_up?? dflt_propagate_up;
        const propagate_down = event.propagate_down?? dflt_propagate_down;
        const hookPathMinLen = propagate_up>-1? Math.min(0,event.path.length - propagate_up):0;
        const hookPathmaxLen = propagate_down>-1? event.path.length + propagate_down:Infinity;
        //Extra case for the ['this'] path at ~ -1
        if(propagate_up&& path.length === 1 && path[0]==='this'&&event.path.length>propagate_up){return false}
        return path.length>=hookPathMinLen &&  path.length<=hookPathmaxLen;
    }
    __pathUp(path,isCtx=false,propagate_up=undefined){
        const all_up_paths = [];
        let relevantPathStart = 0;
        
        let propagateOverThis = true;//propagte up is to large enough to reach this
        if(propagate_up>-1){
            if(propagate_up<path.length){
                propagateOverThis = false;
            }
                                                     //v-- Always include self
            relevantPathStart = Math.min(path.length - 1 , Math.max(0, path.length - propagate_up) );
        }
        for (let i = path.length; i > relevantPathStart; i--) {
            all_up_paths.push(path.slice(0, i));
        }
        if(!isCtx && propagateOverThis) all_up_paths.push(['this']);
        return all_up_paths;
    }
    __stashAttrWrite(newVal){
        const old = this.__is_attr_write_back; 
        this.__is_attr_write_back = newVal;
        return old;
    }
    __unstashAttrWrite(old){
        this.__is_attr_write_back=old;
    }
    /** If cleaning of something nested was missed and still is in sync Map and is called by an still existing dependency remvoe it to avoid error */
    __isUnconnected(element,depend,dependArray){
        if(!element?.isConnected){    
            const idx = dependArray.indexOf(depend);
            if(idx!==-1)dependArray.splice(idx,1);
            return true;
        }
        return false;
    }
    /**
     * Before the normal after Change, this inserts or deletes Templates, if an arrays length has changed via push|splice 
     * if the event is null, it fetches from the path reads from the DOM Element the nessaccary values. But with the event its slightly more efficient 
     * @param {PC_Ev} event */
    handleArrayChange(event = {}, path_str, path_splitted = path_str.split(".")) {
        const arrRoot_arr = this.__arrRoot.get(path_str);
        if (!arrRoot_arr) { return }

        /**@type {any[]} */
        let array = event.new_val ?? this.__getPath(path_splitted);

        let is_no_array = false;
        let has_pushed_len = false;
        const sub_dpd_upt = [];
        if (!Array.isArray(array)) {
            is_no_array = true;
            // const msg = `Expected a Array for <${this.localName}> this.${path_str}, but got instead ${array?.constructor?.name ?? typeof array}${array !== undefined ? ":" + array : ''}\n Now it will execute the $\{} again, and uses it's return as innerHTML.\nIt is possible that it still gets the value later and the order of customElements.define() is just unfortunate`;
            // throw Error(msg);
            // console.warn(msg);
            has_pushed_len = true;
            sub_dpd_upt.push([...path_splitted, 'length'])
            array = [];
        }
        /**The range of elements, that have no html */
        const range = event.range ?? [0, array.length];


        //On splice, range gives you toatal old len
        if (event.trigger === "splice") range[1] = array.length;

        let min_len,max_len = range[1];

        //Old len also retruns length for Strings, only use it if it was a array
        const old_no_arr = event.old_val !== undefined && !Array.isArray(event.old_val);
        let old_len_mod = old_no_arr ? 0 : event.old_len;

        //If you push and the previos array Elements already have a dependencie toward a nonexisting element, you heve to include them in sub_dpd_upt
        // look at example HofElement/Samples/functionTemp.html to see what for it is
        let pre_existing = this.__getAllOutOfBoundSubDependencies(path_splitted, old_len_mod, array.length)

        const remove_depends = new Set();

        //Collect the throug splice inserted or changed indices
        this.__collectExistingArrayPath(range[0],event.trigger=="set"?array.length:old_len_mod,path_splitted,sub_dpd_upt);

        //Go over all Array roots. Note: Templates may be different ones; At Start|Without event.old_len the lengths are different
        for (let i=0;i<arrRoot_arr.length;i++) {
            const arrRoot_el = arrRoot_arr[i];
            const { element,  arr_root_def } = arrRoot_el;
            if(element.isConnected==false){
                arrRoot_arr.splice(i,1);i--;continue;
            }
            let template = arrRoot_el.template;
            if (!template) {
                if (!(this.constructor.warn ??= new Set()).has(path_str)) {
                    this.constructor.warn.add(path_str)
                    // console.warn(`There was no Template at path ${path_str} for `, element, `Therefore changes in length cannot be refelcted. Try recreating template from func_depend map . But the contents that are in the original Template still work. Do you use nested obj arrays? Was an Array Root manually defined for it? Could be intended behaviour if wanted`);
                }
                //Try to create a Template from the by calling the function again 
                if(array.length>0){
                    const  currenTemplateEle = HofElement.getLast();
                    HofElement.last = this;
                    const exp = this.template.func_depends.get(arr_root_def);
                    if(!exp){
                        continue;
                    }
                    const new_val = exp?.call?.(this, arrRoot_el.counter.toParamObj());

                   
                    template= arrRoot_el.template = this.constructor?.arr_root_to_template?.get?.(arr_root_def);
                    // Your ${} did not create a template -> use return value a s inner html
                    if(!template){
                        this.__handleSet(element,'innerHTML',this.__expToString(new_val,'autoListEmpty'),undefined,{path:path_splitted} )
                        HofElement.resetLastAs(currenTemplateEle);
                        continue;
                    }
                    HofElement.resetLastAs(currenTemplateEle);
                }
            }
            if( arrRoot_el.needs_clean==true){
                element.replaceChildren();
            }
            // look if length must be returned to mark it for update
            
            const old_len = (old_len_mod ??= element.children.length);
            if (min_len > old_len) { min_len = old_len }
            if (max_len < old_len) { max_len = old_len }

            if (!has_pushed_len && old_len !== array.length) {
                has_pushed_len = true;
                sub_dpd_upt.push([...path_splitted, 'length'])
            }

            //remove surplus elements and from all sub elements;
            if (array.length < old_len) {
                for(let i=old_len-1;i>=array.length;i-- ){
                    this.__collectCleanPaths(element.children[i],remove_depends);
                }
            }
            //Attach new elements
            if (array.length > old_len) {
                //if before type was no array, first clean the element
                if (old_no_arr || old_len === 0) { element.replaceChildren() }

                const ele_to_counter_map = new Map();
                const add_range = [old_len, range[1]];

                for (let ind = old_len; ind < range[1]; ind++) {
                    /**@type {HTMLElement} */
                    const copy = template.dom_temp.cloneNode(true);
                    element.append(...copy.childNodes);
                }
                this.__mapGenricArrExp(arrRoot_el, ele_to_counter_map, path_str, undefined, add_range);
                this.__calcSyncMap(element, template, ele_to_counter_map, add_range, false)

                ele_to_counter_map.clear();//unnessary, but to show for intention of end of use
            }

            
            // reexecute the ${} for empty or non arrays
            if (array.length === 0 || is_no_array) {
                arrRoot_el.needs_clean=true;
                //For top level things without Params, this should work
                const exp = this.template.func_depends.get(arr_root_def);
                const tmp = HofElement.stash(this);
                const ret  = exp?.call?.(this, arrRoot_el.counter.toParamObj());
                this.__handleSet(element,'innerHTML',this.__expToString(ret,'autoListEmpty'),undefined,{path:path_splitted} )
                HofElement.unstash(tmp);
            }
            else{
                arrRoot_el.needs_clean=false;
            }
        }
        //At least on had more children, so clean potential __syncDependencies
        if (max_len > array.length) {
            // /* ALso generate */
            // remove_depends.push (new Array(max_len - array.length).fill(0).map((x, i) => path_str + HofElement.pathCombine + (array.length + i)));
            remove_depends.add(path_str+'.length');
            //clear unneccessary _syncMap entries, also Update length prop cause your now smaller
            const still_depend = this.__clearDisconnectedDepend([...remove_depends], path_splitted,path_str);
            sub_dpd_upt.push(...still_depend.map(x => x.split(".")));
        }
        sub_dpd_upt.push(...pre_existing);

        //On push you don't need to change the pushed ones, they are already new
        if (event.trigger == 'push') return sub_dpd_upt;
        
        
        //Delete on splice all arrayRoots under you, in case they existed 
        if (event.trigger == 'splice') {
            for (const [arr_root_path_str] of this.__arrRoot) {
                if (!arr_root_path_str.includes(path_str + ".")) { continue }
                const arr_root_path = arr_root_path_str.split(".");
                if (arr_root_path[path_splitted.length] >= array.length) {
                    this.__arrRoot.delete(arr_root_path_str);
                }
                else {
                    sub_dpd_upt.push(arr_root_path_str.split("."));
                }
            }
        }

        return sub_dpd_upt;
    }
    /** Collects the paths that already have a synced HTML and need to be returned from handleArrayChange */
    __collectExistingArrayPath(start,end,path_splitted,o_res=[]){
        for (let i = start; i < end; i++) {
            const path = [...path_splitted, i + ""];
            const subDepends = this.__getAllSubDependencies(path,undefined,undefined,true);
            o_res.push(path, ...subDepends);
        }
        return o_res;
    }
    /** Goes over all children of a element and collects the path for the dependencies */
    __collectCleanPaths(element,remove_depends=undefined,removeElm=true){
        const removeStack = [element];
        let guard=1000;
        do{
            const removeElm = removeStack.pop();
            if(!removeElm)break;
            const depends_on = this.__syncMapElm.get(removeElm);
            this.__syncMapElm.delete(removeElm);
            if(depends_on&&remove_depends){ depends_on.forEach( elm=> remove_depends.add(elm));}
            removeStack.push(... [...removeElm.children].reverse() );
        }while(guard--);
        if(removeElm)element.remove();
    }
    /**
     * Removes from __syncMap all depenencies that have  isConnected=false.
     * This is mainly used after an array was spliced and you have dead dependencies.
     * With given hint, only these paths of the __syncMap are checked -> more efficient.
     * Currently the paths are strings like "user.age.3.and_so_on" , may change in future 
     * retruns the paths for dependencies that still have a connection (also used outside of this array, they may need to be updated to undefined after splice)
     */
    __clearDisconnectedDepend(path_hints = [...this.__syncMap.keys()],path_trigger=[],trigger_path_str= path_trigger.join('.')) {
        const still_depend = [];
        
        for (const dpd_path of path_hints) {
            const prop_depend = this.__syncMap.get(dpd_path);

            const isUnderRefArray = dpd_path.split('.').length>path_trigger.length;
            if(isUnderRefArray){
                this.__arrRoot.delete(dpd_path);
            }
            if (!prop_depend) {
                //SYNC Hierachy also Contains Paths that have no SyncMap entry, so you can delete it here
                if(isUnderRefArray)this.__deleteSyncHierarchy([dpd_path]);
                continue
            }
            //for elements
            let temp = [];
            for (const depend of prop_depend.simplePropertyAttributes) { if (depend.element.isConnected) { temp.push(depend) } }
            prop_depend.simplePropertyAttributes = temp;
            temp = [];
            for (const depend of prop_depend.evaluatedAttributes) { if (depend.element.isConnected) { temp.push(depend) } }
            prop_depend.evaluatedAttributes = temp;

            //for TextNodes
            temp = [];
            for (const depend of prop_depend.simplePropertyTextNodes) { if (depend.textNode.isConnected) { temp.push(depend) } }
            prop_depend.simplePropertyTextNodes = temp;
            temp = [];
            for (const depend of prop_depend.evaluatedTextNodes) { if (depend.textNode.isConnected) { temp.push(depend) } }
            prop_depend.evaluatedTextNodes = temp;
            //delete whole depend if empty
            if (prop_depend.simplePropertyAttributes.length === 0 && prop_depend.simplePropertyTextNodes.length === 0 &&
                prop_depend.evaluatedAttributes.length === 0 && prop_depend.evaluatedTextNodes.length === 0) {
                this.__syncMap.delete(dpd_path);

                if(isUnderRefArray){
                    this.__deleteSyncHierarchy([dpd_path]);
                }
            }
            // The array sub property is used elewhere in the template push it to the sync
            else  if(dpd_path.startsWith( trigger_path_str)&&!dpd_path===trigger_path_str+'.length'){ still_depend.push(dpd_path) }
        }
        return still_depend;
    }
    /** cleans all dependencies under this element */
    __cleanUnder(element,path_trigger=[],trigger_path_str= path_trigger.join('.')){
        const removeSet = new Set();
        this.__collectCleanPaths(element,removeSet,false);
        this.__clearDisconnectedDepend( [...removeSet],path_trigger, trigger_path_str);
    }
    /**
     * clean entries with elements that are no longer connected after conditional template change
     * !! could be optimized, se combo of __collectCleanPaths + __clearDisconnectedDepend by saving for every template all possible dependecies,  not recommend for better performance but neccessary after an nested template is switched !!
     */
    __cleanOld(){
        const entries= this.__syncMap.entries();
        for(const [prop,entry] of entries){
            entry.simplePropertyTextNodes= entry.simplePropertyTextNodes.filter(dep=>dep.textNode?.isConnected===true);
            entry.simplePropertyAttributes= entry.simplePropertyAttributes.filter(dep=>dep.element?.isConnected===true);
            entry.evaluatedTextNodes= entry.evaluatedTextNodes.filter(dep=>dep.textNode?.isConnected===true);
            entry.evaluatedAttributes= entry.evaluatedAttributes.filter(dep=>dep.element?.isConnected===true);
        }
        
        const elms = this.__syncMapElm.keys();
        for(const elm of elms){
            if(!elm.isConnected){this.__syncMapElm.delete(elm)}
        }
        for(const [_,arrRoots] of this.__arrRoot){
            let anyToDelete =false;
            for(const arrRoot of arrRoots){
                if(arrRoot.element?.isConnected==false){ anyToDelete=true; break; }
            }
            if(anyToDelete){
                this.__arrRoot.set(_,arrRoots.filter(arrRoot=>arrRoot.element?.isConnected));
            }
        }
    }
    /**?maybe faster with __meta access, but then maybee it is not on meta?*/
    __getPath(path, len = path.length) {
        switch (len) {
            case 0: return undefined;
            case 1: return this[path[0]];
            case 2: return this[path[0]]?.[path[1]];
            case 3: return this[path[0]]?.[path[1]]?.[path[2]];
            case 4: return this[path[0]]?.[path[1]]?.[path[2]]?.[path[3]];
            case 5: return this[path[0]]?.[path[1]]?.[path[2]]?.[path[3]]?.[path[4]];
            case 6: return this[path[0]]?.[path[1]]?.[path[2]]?.[path[3]]?.[path[4]]?.[path[5]];
        }
        let curObj = this;
        let i=0;
        while(Object.hasOwn(curObj,path[i])){curObj=curObj[ path[i]];i++}
        return i==( len)? curObj:undefined;
    }

    /** Returns if the ele has this path, also true if explicitlly given as attr, [] returns true*/
    __hasProp(arr = []) {
        //Early Out for Getters from Parent Class -> this avoids calling them, nice if you have some loging Logik in there
        if (arr.length === 1 && this.constructor?.__fn_g_depends?.has?.(arr[0])) return true;

        let i = 0; let value = this;
        //check if value if not undefined or its an Array value in range of the length of Array, so also eplty Array slots are seen (-1 is addition of Observe.js) 
        while (i < arr.length && value && ( value[arr[i]] !== undefined || Object.hasOwn(value, arr[i]) || Array.isArray(value) && arr[i] >= -1 && arr[i] < value.length)) {
            (
                value = value[arr[i++]])
        }
        return i === arr.length || this.attributes[arr[0]] !== undefined;
    }
    __syncHierarchy = new Map();
    //A Map that contains infos of which subprops must be rerendered
    __addSyncHierarchy(depend_paths = this.__syncMap.keys()) {
        for (const depend_path of depend_paths) {
            const path_split = depend_path.split(HofElement.pathCombine);
            let cur_map = this.__syncHierarchy;
            for (const name of path_split) {
                if (!cur_map.has(name)) { cur_map.set(name, new Map()) }
                cur_map = cur_map.get(name);
            }
        }
    }
    __deleteSyncHierarchy(remove_paths,evenWithSub=false) {
        //if Nothing given, just clear the whole map
        if (remove_paths === undefined) { this.__syncHierarchy.clear() }
        outer: for (const remove_path of remove_paths) {
            const path_split = remove_path.split(HofElement.pathCombine);
            let cur_map = this.__syncHierarchy;
            const path_to = path_split.slice(0, -1);
            for (const name of path_to) {
                //Isn't there, just continue
                if (!cur_map.has(name)) { continue outer }
                cur_map = cur_map.get(name);
            }
            const remove_prop = path_split.at(-1);
            const subMap = cur_map.get(remove_prop);
            if(!subMap || subMap.size>0)continue; 
            cur_map.delete(remove_prop);
        }
    }
    /**Should return all dependencies that exist under the path,\ like:\
     * this.user  ->  this.user.name & this.user.address & this.user.loc 
     * @param {string[]} path 
     * @param {boolean} [join_path=false] This joins the path arrays to Strings [ 'AAA.BB.yy', 'user.4.age' ]
     * @returns {string[][]|string[]} 
     */
    __getAllSubDependencies(path, join_path = false,propagate_down = undefined,clearArrayRoots=false) {
        const is_this = path[0] === "this";
        let i = 0; let cur_map = this.__syncHierarchy;
        let cur_path = [];
        if (!is_this) {
            while (cur_map.has(path[i]) && (cur_path.push(path[i]), cur_map = cur_map.get(path[i++]))) { }
            //Not in map
            if ((i < path.length || i === 0)) return [];
        }
        const subsAll =this.collectPaths(cur_map, cur_path,propagate_down,undefined, clearArrayRoots)
        return join_path ? subsAll.map(x => x.join(HofElement.pathCombine)) : subsAll;
    }

    /**Returns all preexisting out of Bound Array Subdepenedencies
     * If you append the array and the previous array Elements already have a dependency toward a non-existing element,
     *  you have to include them in sub_dpd_upt of handleArrayChange, so that they get updated.
     * You need to set __options : has_not_no_depend : false, otherwise those dependencies aren't created exist.
     * (this was done previosly)
     * This mainly occurs when you use .map`with array- destructuring like where you have undefined patches :
     * ```
     * persons=[{},{}]
     *  persons.map(  (person,idx,[pers_0,pers_1,pers_2,pers_3] ) => ... )
     * ```
     */
    __getAllOutOfBoundSubDependencies(path, old_len, arr_len) {
        let cur_path = [];
        let i = 0; let arr_map = this.__syncHierarchy;
        while (arr_map.has(path[i]) && (cur_path.push(path[i]), arr_map = arr_map.get(path[i++]))) { }
        //Not in map
        if ((i < path.length || i === 0)) return [];
        let idx = old_len;
        let idx_str = idx + "";
        const all_sub_paths = [];
        while (arr_map.has(idx_str) && idx < arr_len) {
            const sub_path = [...cur_path, idx_str];
            all_sub_paths.push(sub_path);
            all_sub_paths.push(...this.collectPaths(arr_map.get(idx_str), sub_path))
            idx++; idx_str = idx + "";
        }
        return all_sub_paths;
    }
    /**Gives a reference to the template generator to the child elements (not Nodes) depending on the options. dom_root is  this | this.shadowRoot */
    __giveTempGenRef(dom_root) {
        let { template_gen_ref, template_gen_ref_str } = this.__options;

        if (!template_gen_ref) return;

        if (!Array.isArray(template_gen_ref_str)) { template_gen_ref_str = [template_gen_ref_str] }

        const ele_to_visit = new Queue(...dom_root.children);
        let max_iter = 10000;
        /**@type {HTMLElement }*/let visited_ele;

        while ((visited_ele = ele_to_visit.dequeue) && max_iter-- > 0) {
            for (const temp_str of template_gen_ref_str) {
                // visited_ele[temp_str] = this;
                DEF(visited_ele, temp_str, { value: this, enumerable: false, configurable: true, writable: false })
            }
            if (visited_ele.__is_HofElement) continue;
            ele_to_visit.enqueueHeadAll(...visited_ele.children)
        }
    }


    /***************
        Following static functions are for communtiaction with html``fn
    ****************/
   
    /**On object creation, before the object will be constructed, save in the Parent class HofElement some stats\
     * - Add your class to HofElement map, to have overview, which class exist
     * - Add your ref&class_str so that html``fn can use exps 
     * - Increase number of created elements on constructur
     * - Check for static style
     * - save for obj non-primitve attr, that might be set, before they get overriden by class inititalition
     */
    static GiveParentType(ele) {
        const { all_exist_TMP } = HofElement;
        if (ele.constructor) {
            if (!all_exist_TMP.has(ele.constructor.name)) {
                all_exist_TMP.set(ele.constructor.name, undefined);
                if (ele.constructor.style || HofOptions.default.style) {
                    const tagName = ele.localName ?? ele.tagName.toLowerCase() ?? HofElement.defaultTagName(ele.constructor);
                    HofElement.createClassStyle(tagName, ele.constructor.style, ele.constructor);
                }
            }
            //Count the connected Elements
            ele.constructor.count ??= 0;
            // ele.__nr = ele.constructor.count;
            DEF(ele, '__nr', { value: ele.constructor.count, enumerable: false, writable: false, configurable: true })
            ele.constructor.count++;

        }
        HofElement.stash(ele);
    }

    static classTemplateParsed = false;
    static needsInitParsing(Class = HofElement.last.constructor){
        return !Object.hasOwn( Class,'all_def_names') || !Object.hasOwn( Class,'sub_htmls') || !Object.hasOwn( Class,'__fn_g_depends');
    }
    /**Prepares All neccessary Parsings*/
    static initParsing(Class = HofElement.last.constructor,use_templete_fn=false , options = { ...HofOptions.default, ...HofElement.last?.__options }) {

        //All_def_names might be already called ealier due to observedAttributes -> therefore it's seperate
        if (!Object.hasOwn( Class,'all_def_names') ) { this.ExtractAllNames(Class); }

        if ( !Object.hasOwn( Class,'sub_htmls') || !Object.hasOwn( Class,'__fn_g_depends')) {
            
            if(typeof Class.ctx==='function')Class.ctx= HofElement.safeCtx(Class.ctx);
            
            HofElement.setUpFunctionOrGetterDepend(Class, HofElement.last);
            
            // Extract static replaceMap for parameter mapping
            let global_repl = Class.replaceMap;
            if(global_repl ){
                //Assume obj or entries array
                global_repl= new Map( Array.isArray(global_repl)? global_repl:Object.entries(global_repl));
            }
            
                
            //do this only from the connected callback 
            if (use_templete_fn && typeof HofElement.last?.template === 'function') {
                const temp_fn = HofElement.last?.template;
                const params = extractParams(temp_fn);
                global_repl ??= new Map();
                for (const param of params) {
                    if (param.pos[0] !== 0) continue;
                    const path = HofElement.paramPosToPath(param);
                    if (!path) continue;
                    global_repl.set(param.name, path);
                }
                //Automatically generate the replaceMap for   all => html``
                if (global_repl.size === 0 && params[0]?.name === 'all') {
                    const [params, body] = extractParamsAndBody(temp_fn);
                    for (const prop of Class.all_def_names) {
                        global_repl.set(prop, prop);
                    }
                    Class.temp_fn_context = new Function('temp_fn', Class.all_def_names.reduce((a, x, i) => a + '\n\t' + `const ${x}=this.${x}`, '') + `\n\tconst html=this.constructor.html\n\treturn ${body}`);
                }
                // "("  ")" are a crude fix for the parseAllHTMLs Alogrythm so that it also works for lamdas without braces
                HofElement.parseAllHTML(Class, "(" + temp_fn.toString() + ")", options, global_repl);
            }
            else {
                HofElement.parseAllHTML(Class, Class.toString(), options, global_repl);
            }
            Class.classTemplateParsed = true;            
        }
    }

    /** Gives the html methode from the last created obj the js ``-str, so that html can construct a Template with it's exps-val 
     * @returns {(   undefined | Template | String)} */
    static getLastTempJS(uid) {

        if (!HofElement.last) {
            return undefined;
        }

        const Class = HofElement.last?.constructor;
        
        if(Class?.classTemplateParsed === false && HofElement.needsInitParsing()){
            //Will only doe something one first gen
            HofElement.initParsing();
        }

        if (uid && Class.sub_htmls.has(uid)) {
            /**@type {SubHTML} */
            const sub_html = Class.sub_htmls.get(uid);
            
            // let is be interpreted as String if not array or root
            if ( !sub_html.parsed.is_root && !sub_html.parsed.arr_root_def ) {    
                if(sub_html.is_fix || sub_html.inside_arr)return undefined;
            }

            if (sub_html?.template) {
                return sub_html.template;
            }
            if (sub_html?.parsed) return sub_html.parsed;
        }
        //Signal that no Template is found
        return undefined;
        //Look if template already exists for this class  
        // let temp;
        // if (temp = HofElement.all_exist_TMP.get(HofElement.last.constructor.name)) {
        //     return temp;
        // }
    }
    /**Transforms a extractParams Pos to a path relative to this */
    static paramPosToPath({ pos, name, destr_type }, start = 1, base, js_arr = false) {
        let res = base ?? "";
        let sp = base === undefined ? "" : ".";
        for (let i = start; i < pos.length; i++) {
            if (typeof pos[i] === 'number') {
                //On last use the param name; s for "sqBrace",  destr_type could be undefiened (top level param)|"crlBrace"|"sqBrace"
                const use_name = i == pos.length - 1 && destr_type?.[0] !== 's';
                res += (use_name ? sp + name : js_arr ? `[${pos[i]}]` : sp + pos[i]);
            }
            else {
                const { 1: destr_name } = pos[i].split("|", 2);
                res += sp + destr_name
            }
            if (i == start) { sp = "." }
        }
        return res;
    }
    /**Parse From the String of the Class all defined Variable Names  */
    static ExtractAllNames(Class) {
        if (Object.hasOwn( Class, 'all_def_names')) { return Class.all_def_names };
        const from_parent=Class.all_def_names??[];
        //Extract only defined props --Object.getOwn... may already inclued things that were set by parent template, dempending on customEl.define sequence
        Class.all_def_names = parseAllVars(Class.toString(), { only_class_var: true });

        //also add meta keys from HofElement like __nr
        // Class.all_def_names.push(...Object.getOwnPropertyNames(HofElement.last).filter(x => x.startsWith("__")))

        //In case .last does not exist, caue earlyer parsing for observed attrs.
        Class.all_def_names.push(...from_parent,...["TEMP", '__nr', '__is_HofElement', 'innerHTML_0', '__own_exps_val', '__syncMap', '__arrRoot', '__unobserved', '__is_attr_write_back', '__syncHierarchy', '__before_own_init', '__options', '__meta']);
        Class.all_def_names = [...new Set(Class.all_def_names)];
        return Class.all_def_names;
    }

    /**Let html register the finished template with correctly scoped functions
     * you can give a Class manually, so you spare on HofElement.stash() unstash()
    */
    static supplyforLastTemp(temp = new Template(), Class = HofElement.last.constructor, uid = undefined, is_root = true) {
        //Save Templates for sub html 
        /**@type {SubHTML} */
        let sub_html;
        if (uid && (sub_html = Class.sub_htmls.get(uid))) {
            if (sub_html.template) throw Error(`Unexpected re-registering of sub template for class ${HofElement.last?.class?.name} with uid ${uid}`);
            //For Future Expansion, In case you would return a   html`` in a ${}, <ou could get it's parsed Template
            temp.arr_prop = sub_html.arr_prop;
            temp.arr_root_def = sub_html.arr_root_def;

            temp.is_dyn_exp_HTML = sub_html.is_dyn_exp_HTML;
            sub_html.template = temp;
            if (sub_html.arr_root_def) Class.arr_root_to_template.set(sub_html.arr_root_def, temp)
            Class.temp_uid_beginn += temp.func_depends.size;

            //Merge functions from inline Templates to global one
            if (!sub_html.parsed.merged && !sub_html.parsed.is_root && !sub_html.parsed.arr_root_def) {
                const root_template = Class.prototype.template || [...Class.sub_htmls].find(([k, v]) => v.parsed.is_root)?.[1]?.template;

                if (root_template) {
                    root_template.mergeTemplates(temp);
                    sub_html.parsed.merged = true;
                }
                else {
                    //A fix for the first one in case root does not exist yet: use the exp as replace.
                    const entries = temp.func_depends.entries();
                    for (const [uid, fn] of entries) {
                        HofElement.last.__own_exps_val.set(uid, fn);
                    }
                }

                }
            }

            if (!is_root) { return }
            if (HofElement.all_exist_TMP.get(Class.name) !== undefined) {
                throw Error(`Unexpected re-registering of template for class ${HofElement.last?.class?.name}`)
            }
            HofElement.all_exist_TMP.set(Class.name, temp);
            //define Template on class prototype  
            //writable: true to allow thing like  constructor(){ this.template=html`` }, otherwise error cause prototype is not writable
            DEF(Class.prototype, "template", {writable:true, value: temp, configurable: true });
            return temp;
        }


    /**
     * Every call of html``in template is extracted, parsed and saved under a uid in this map.
     * It is needed if you want to use more efficient Arrays via .map   
     * This happens per Class
     * @type {Map<String,SubHTML>} */
    static sub_html;

    /**Contains all array Gen IDX. Prevetns duplication, especially if .map got no named index as param  */
    static used_default_gen_idx = new Map();

    static uniqueIdx(from_idx = '#i', Class) {
        if (!Object.hasOwn(Class, 'used_default_gen_idx')) Class.used_default_gen_idx = new Map();

        if (from_idx[0] !== '#') from_idx = '#' + from_idx;
        if (!Class.used_default_gen_idx.has(from_idx)) {
            Class.used_default_gen_idx.set(from_idx, 1);
            return from_idx
        }
        const amount = Class.used_default_gen_idx.get(from_idx);
        const uniq_idx = from_idx == '#i' && amount < 17 ? '#' + String.fromCharCode(105 + amount) : from_idx + amount;

        Class.used_default_gen_idx.set(from_idx, amount + 1);
        return uniq_idx;
    }
    /**Gets a tString Token and decides, if it is a html template with Hof processing.  
     * By default it checks, if the previous token contains the html tag fn @example /html\s{0,}/.test(token?.prev?.value); 
     */
    ["__isHTMLTString"](tStringToken){
        return /html\s*/.test(tStringToken?.prev?.value);
    }
    /**
     * Decides if a html template is interpeted as a auto List and not a navie complete recalculate `${}` expression
     * @param {Token} tStringToken  
     * @param {Token} enclosingTExpToken -- the enclosing `${}` with the code
     * @param {{prop:String,lambda:Token}} foundListFn -- the property and code of the found list function 
     */
    ["__isAutoList"](tStringToken,enclosingTExpToken,foundListFn){
        return foundListFn!==null;
    }
    /**
     * A Map from the Array root def to the Template
     * @type {Map<String,Template>}
     */
    static arr_root_to_template;
    /**Parses all occurances of html\`\`fn to determine which exps must be retrun, neccessary for nested html\`\` like arrays 
     * Also Sets up the Replace Params if it detect a ${ prop.map( ... ) }
     * attaches the resulting Map to the class sub_htmls
     * @param {typeof HofElement } Class
     * @param {String} string
     * @param {HofOptions} options
     * @param {Map<String,String>|undefined} global_repl  
    */
    static parseAllHTML(Class, string, options, global_repl) {
        if (!Object.hasOwn(Class,'sub_htmls')) {
            Class.sub_htmls = new Map();
        }

        const parsed_sub_htmls = parseAllHTMLs(string,Class?.prototype?.["__isHTMLTString"],Class?.prototype?.["__isAutoList"]);

        let has_any_root = false;

        const has_ctx = Object.hasOwn(Class, 'ctx') || !HofElement.ctx.___is_empty;
        if (has_ctx) {
            global_repl ??= new Map();
            //Add global ctx
            const global_context_keys = Object.keys(HofElement.ctx).filter(key => !key.match(/^___|^_?add|^_?remove/));
            global_context_keys.forEach(key => global_repl.set(key, `constructor.ctx.` + key));

            //Add static ctx to global_repl Map
            if (Object.hasOwn(Class, 'ctx')) {
                Object.keys(Class.ctx).forEach(key => global_repl.set(key, `constructor.ctx.` + key));
            } else if (global_context_keys.length > 0) {
                Class.ctx = {};
            }

            global_context_keys.forEach(key => {
                if (Object.hasOwn(Class.ctx, key)) return;//Class ctx overrides global ctx
                Class.ctx[key] = HofElement.ctx[key]
            })
        }

        if (global_repl) {
            //replace the class name with constructor
            global_repl.set(Class.name||'anonymous', 'constructor')
        }

        for (const parsed_temp_exp of parsed_sub_htmls) {
            const { strs, exps, enclosing_lambda, enclosing_exp, parent_index ,is_array} = parsed_temp_exp;
            const uid = strs.map(str => str.replaceAll("\r\n", "\n").length) + "|explen:" + exps.length;
            //Interpret only as expression
            const enclosing_str = enclosing_exp?.toString?.();
            const enclosing_start = enclosing_str?.slice?.(2, 100);
            let is_exp = options.annos.exp_anno_re.test(enclosing_start)
            let is_fix = options.annos.fix_anno_re.test(enclosing_start)
            const rejectedArr = enclosing_lambda &&  !is_array;

            /** No auto list, but still maybee need for html fn to do something e.g. functions */
            const is_dyn_exp_HTML =  rejectedArr || is_fix || is_exp || enclosing_lambda?.non_simple_map;
            parsed_temp_exp.is_dyn_exp_HTML= is_dyn_exp_HTML;

            let combine = strs.map((str, i) => str + (exps[i] ? `\${${exps[i]}}` : '')).join("");

            if (!has_any_root) { has_any_root = parsed_temp_exp.is_root }

            let replaceMap = null;
            let arr_prop = undefined;
            let arr_root_def = undefined;

            //From global Replace Map
            if (global_repl) {
                replaceMap ??= new Map();
                parsed_temp_exp.replaceMap = replaceMap;
                global_repl.entries().forEach(([key, val]) => replaceMap.set(key, val));
            }
            //Collect Replace Map from parents
            let parent = parsed_sub_htmls[parent_index];
            
            if (parent) {
                replaceMap ??= new Map();
                parsed_temp_exp.replaceMap = replaceMap;
                while (parent) {
                    let parent_replaceMap = parent.replaceMap;
                    if (!parent_replaceMap) { break }
                    parent_replaceMap.entries().forEach(([key, val]) => replaceMap.set(key, val))
                    parent = parsed_sub_htmls[parent.parent_index]
                }
            }
            if (is_array && !is_dyn_exp_HTML) {

                replaceMap ??= new Map();
                parsed_temp_exp.replaceMap = replaceMap;

                //Remove the brace of the map
                const lambda_str = enclosing_lambda.lambda.toString(false).slice(1, -1).trim();
                const params = enclosing_lambda.params = extractParams(lambda_str);

                let enclosing_arr = enclosing_lambda.prop.replace(/^\s*this\s*\./, "");
                //Now Replace To get name in class  
                arr_prop = enclosing_arr.split(".").map(sub_prop => {
                    if (!replaceMap.has(sub_prop)) return sub_prop;
                    return replaceMap.get(sub_prop);
                }).reduce((a = '', sub_prop) => a + (sub_prop.startsWith("[") ? "" : ".") + sub_prop)


                const param_i = params.find(x => x.pos[0] == 1);
                const accessor = Class.uniqueIdx(param_i?.name, Class);
                const accessor_br = "[" + accessor + "]";
                if (param_i) replaceMap.set(param_i.name, accessor);

                // (the element or array param may be destructured)
                for (const param of params) {
                    let base = param.pos[0] === 0 ? arr_prop + accessor_br : param.pos[0] === 2 ? arr_prop : undefined;
                    if (!base) {
                        continue
                    }
                    const path = HofElement.paramPosToPath(param, 1, base);
                    replaceMap.set(param.name, path)
                }

                //will be used in sync to signal that this is a array root. The accessor shows, what name for the map index should be used
                arr_root_def = arr_prop + "[]" + accessor
                if (arr_root_def) {
                    Class.arr_root_to_template ??= new Map();
                    let arr_root_def_idx = arr_root_def;
                    let i = 1;
                    while (Class.arr_root_to_template.has(arr_root_def_idx)) { arr_root_def_idx = arr_root_def + i++; }
                    Class.arr_root_to_template.set(arr_root_def_idx, undefined);
                    arr_root_def = arr_root_def_idx;
                }
                parsed_temp_exp.arr_root_def = arr_root_def;

                //Give a warning if a join("xxx") was given, cause the str content of it will be ignored
                if (/.join\s*\(\s*\S{3,}\s*\)/.test(enclosing_str.slice(-20))) {
                    const join_str = enclosing_str.slice(-20).match(/.join\s*\(\s*(\S{2,})\s*\)/)?.[1]
                    console.warn(`A .join( ${join_str} ) was found, cause ${arr_prop} is detected as html list, the ${join_str} in .join() will be ignored.\nYou should use an empty string ore remove the .join().\nIf you want to use plain js map, remove the html tag in the map function`)
                }
            }

            
            // if(!is_dyn_exp_HTML){
                if (Class.sub_htmls.has(uid)) { throw Error("Clashing uid change uid Algorithm //to do or change string length you (could insert a empty space in html)") }
                Class.sub_htmls.set(uid, { js_str: combine, parsed: parsed_temp_exp, template: null, replaceMap, arr_prop, arr_root_def,is_fix,is_exp,is_dyn_exp_HTML });
            // }
        }
        /**@type {SubHTML[]} */
        const sub_htmls = [...Class.sub_htmls.values()];
        //Give each sub_html their beloning Sub Array, Also set arr_root_to_template already to undefined, to signal that this array_root_def was successfully parsed
        for (const sub_html of sub_htmls) {
            const { parsed: { parent_index, parent_exp_nr }, arr_root_def } = sub_html;
            /**@type {SubHTML} */
            let parent = sub_htmls[parent_index];
            if (!parent) continue;
            parent.sub_html ??= new Map();
            parent.sub_html.set(parent_exp_nr, sub_html);
            if(parent.arr_prop){
                sub_html.inside_arr=true;
            }
        }
        //Was a function Template, find root throug extracting the last one without parent
        if (!has_any_root) {
            for (let i = 0; i < sub_htmls.length; i++) {
                const sub_html = sub_htmls[i];
                if (sub_html.parsed.parent_index === undefined) {
                    sub_html.parsed.is_root = true; break;
                }
            }
        }
        return Class.sub_htmls;
    }

    /**This goes on first Object creation over all function and getter on prototype and parses their depenency Map
     * This info is neccessary for Template creation to detect following cases
     * ```
     * class {
     *    a=8;
     *    b="bbb"; 
     *    c=6;        
     *      
     *    get BBBB(){return this.b.repeat(10) }   
     *   
     *    bla(num) {  return this.a + this.c +num }   
     * 
     *    tempalte= html `  ${ this.bla(2) }   ${ this.BBBB } `
     * }
     * ```
     */
    static setUpFunctionOrGetterDepend(Class, first_obj) {

        // Manully defined depends for functions or getter, 
        let manuall_depends = HofElement.last.__fn_g_depends ?? Class.__fn_g_depends;
        if (manuall_depends) {
            manuall_depends = HofElement.__mapLikeToMap(manuall_depends);
        }
        /**@type {Map<string,string[]>} */
        const __fn_g_depends = new Map(manuall_depends);
        
        // merge global map with class map
        if(!HofElement.last?.__fn_g_depends && Class.__fn_g_depends !== HofElement.__fn_g_depends ){
            const baseMap =  HofElement.__mapLikeToMap( HofElement.__fn_g_depends)
            baseMap.entries().forEach( ([_,[key,val]])=> __fn_g_depends.has(key)?0:__fn_g_depends.set(key,val));
        }
        
        const proto_dec = Object.entries(Object.getOwnPropertyDescriptors(Class.prototype));

        //Just to more effiencently check here if im included
        const all_def_names = new Map(Class.all_def_names.map(prop => [prop, true]));

        const also_without_this = false;

        //Is needed for Getters in Getter or Fns
        const all_def_fn_g = new Set(proto_dec.map(fn_g_entry => fn_g_entry[0]));


        /**If in Function is again Function save back until all normal props are resolved and then add them @type {Map<string,string[]>}*/
        const subFN_depends = new Map();
        for (const [fn_name, { value, get }] of proto_dec) {
            // Manually given
            if(__fn_g_depends.has(fn_name))continue;

            if (!typeof value === 'function' && !get) { continue }
            if (/constructor|template/.test(fn_name)) { continue }

            const fn = value ?? get;
            if(!fn)continue;
            const [params, body] = extractParamsAndBody(fn);
            const parsed_var = parseAllVars(body, { class_fns: true })
            const all_Dub_depend = [];
            for (const prop of parsed_var) {
                const normed_prop = getNormalisedPath(prop);
                let removed_this = normed_prop;
                let first_access = normed_prop.split('.')[0];
                if (normed_prop.startsWith("this.")) {
                    removed_this = normed_prop.slice(5)// 5,cause  "this.".length == 5 
                    first_access = removed_this.split('.')[0];
                }
                else if (Object.hasOwn(Class.ctx, normed_prop.split('.')[0])) {
                    all_Dub_depend.push("constructor.ctx." + normed_prop);
                    continue
                }
                //When no leading this. and not in ctx it probalby a local scoped variable or parameter 
                else if (!also_without_this) { continue }


                if (!all_def_names.has(first_access) && !all_def_fn_g.has(first_access)) { continue }
                all_Dub_depend.push(removed_this);
            }
            if (parsed_var.class_fns.length > 0) {
                subFN_depends.set(fn_name, parsed_var.class_fns)
            }
            __fn_g_depends.set(fn_name, all_Dub_depend);
        }

        for (const [fn_name, fn_in_fns] of subFN_depends) {
            if (!__fn_g_depends.has(fn_name)) { __fn_g_depends.set(fn_name, []); }
            const depend = __fn_g_depends.get(fn_name);
            for (const sub_names of fn_in_fns) {
                const normed_prop = getNormalisedPath(sub_names);
                let removed_this = sub_names;
                if (normed_prop.startsWith("this.")) {
                    removed_this = normed_prop.slice(5)// 5,cause  "this.".length == 5 
                } else if (!also_without_this) { continue }

                depend.push(...__fn_g_depends.get(removed_this) ?? []);
            }
            __fn_g_depends.set(fn_name, [...new Set(depend)]);
        }
        //Go over __fn_g_depends and try to expand Getter within the dependency Array
        for (const [fn_name, dependencies] of __fn_g_depends) {
            let i = 0;
            for (const depend of dependencies) {
                const first_access = depend.split('.')[0];
                if (__fn_g_depends.has(first_access)) {
                    dependencies.splice(i, 1, ...__fn_g_depends.get(first_access));
                }
                i++;
            }
        }
        Class.__fn_g_depends = __fn_g_depends;
        return __fn_g_depends;
    }
    /** Transform to a valid Map from a more ergonomic form like Object or entries Array */
    static __mapLikeToMap(mapLike){
        try {
            if(Array.isArray(mapLike)){}
            else if (mapLike?.constructor?.name === Map.name) {
                mapLike =[... mapLike.entries()];
            }
            else if ( typeof mapLike === 'object') {
                mapLike = Object.entries(mapLike);
            }
            else throw Error();

            //Correct strings into string arrays
            for (let i= 0;i< mapLike.length;i++) {
                const [fn_g_name,dep_arr] = mapLike[i];
                //use the name -> may even be better for minifiers
                if(typeof fn_g_name ==='function'){
                    mapLike[i][0] = fn_g_name.name;
                }
                if (!dep_arr) {
                    //no dependencies
                    mapLike[i][1]=[];
                }
                else if(!Array.isArray(dep_arr)){
                    mapLike[i][1]=[dep_arr];
                }
            }
            return mapLike;
        }
        catch (e) {
            throw Error(`manuelly given function or getter depends must be a Map<string,string[]>, entries Array [['fn_g_name1',['depends1','...']]  ] or plain Object {[fn_g_name:string]:string|string[]}`);
        }
        
    }

    /**The global ctx. If you want to use primitiv shared State or want to def ctx only once, use this one */
    static ctx = {
        ___is_empty: true,
        ___last_added: Date.now(),
        /**
         * @example
         * HofElement.cxt._add( {my_shared_obj, other_shared_obj,}  )
         * @param {any} supplied_ctx 
         */
        _add(supplied_ctx, override_error = true) {
            if(typeof supplied_ctx==="function") supplied_ctx=HofElement.safeCtx(supplied_ctx);
            const entries = Object.entries(supplied_ctx);
            for (const [key, obj] of entries) {
                if (override_error && this[key]) { throw new Error(`ctx has already key ${key}`) }
                this[key] = obj;
            }
            if (entries.length === 0) return;
            this.___last_added = Date.now();
            this.___is_empty = false;

        },
        _remove(remove_ctx) {
            for (const key of Object.keys(remove_ctx)) {
                delete this[key];
            }
        },

        get add() { return this._add },
        set add(v) { this._add(v) },
        get remove() { return this._remove },
        set remove(v) { this._remove(v) },
    };
    /** extracts runtime ctx from lamdba fn str -> good for minifiers
      * @example 
      * class X{
      *  static ctx = safeCtx( ()=>( {locals,otherCtx, ...} ) )
      *  //Or as array
      *  safeCtx( ()=>[locals,otherCtx, ...] ) 
      * }
    */
    static safeCtx(fn){
        const obj = fn();
        const parsedNames = ((fn+"").match(/\{(.+)\}/)?.[1]?? (fn+"").match(/\[(.+)\]/)?.[1] ?? "")
            .split(',')
            .map(name=>(name.match(/:\s*(\S+)/)?.[1]??name).trim())
            .filter(Boolean);
        const ctx = {};
        let i=0;
        for(let key in obj){
            ctx[parsedNames[i]] = obj[key];   
            i++;
        }
        return  ctx;
    }

    /**With this function you can append Context to a given Class or by default the last created one.
     * It is yoused to automatically infer and collect the surrounding object, that are given in the html``
     * 
     * It is enough to only supply a String name. So in cases of evaluated exps ${} where the html`` didn't got a refernece to the object, 
     * the Framework can still notify the user what object he has to manually add to ctx 
     * @typedef {{path:String,obj:any,prop_name:String}} ctxDecs
     * @param {  (String|ctxDecs)[]} ctxs
      */
    static supplyContextNames(ctxs, Class = HofElement.last?.constructor) {
        if (!Class) return false;
        if (!Object.hasOwn(Class, 'ctx')) Class.ctx = {};


        //this helps deciding if  
        let any_ctx_found = false;

        for (const ctx of ctxs) {
            const only_name = typeof ctx === 'string';
            const path = getNormalisedPath(only_name ? ctx : ctx.path);
            if (only_name) { console.warn(`A context was detected that must be added manually:${path}`); continue }
            const obj = ctx.obj;
            const path_split = path.split('.');
            const first_access = (path_split?.[0]).trim();
            if (first_access === Class.name) { continue }
            any_ctx_found = true;
            ctx.prop_name = "constructor.ctx." + path
            if (!Class.ctx[first_access] && path_split.length == 1) {
                Class.ctx[first_access] = obj

                //Append the Context to each replace Map, so that all ${} detect it as used
                for (const sub_html of Class.sub_htmls.values()) {
                    if (!sub_html.replaceMap) { sub_html.replaceMap = new Map() }
                    sub_html.replaceMap.set(first_access, ctx.prop_name);
                    sub_html.replaceMap.dirty = true
                }
            }
        }
        return any_ctx_found;
    }
    /** This Registers the Component at the Context, so that you can recieve afterChange Events */
    __registerAtContext() {
        const Class = this.constructor

        //You have no Context, so return
        if (!Object.hasOwn(Class, 'ctx')) return;
        //IMPORTANT
        //observe all keys on ctx the Observe will do the share logik
        const ctx = Object.entries(Class.ctx);
        const not = [...HofElement.HofElement_props, ...this.__options.template_gen_ref_str, ...this.__unobserved];
        for (const [key, obj] of ctx) {
            if (key.match(/_?add|_?remove|^___/)) { continue }
            makeDeepObservable(Class.ctx[key], { not, __path: ['constructor', 'ctx', key], __root: this, __root_shareable: true })
        }
    }
    /**Tries to consume from  next parent template in DOM a property with the name. Can even be an objcet.
     * Parent must be registered before child, if it should be used in class member initialization block.
     * Otherwise consume in init()\
     * !! All parents need .TEMP enabled with __options.template_gen_ref so that this works !!\
     * !! Use object, cause only they are updated correctly. Not working: parent.ctx_name= <new value> !!
     * @example
     * class Parent {
     *  ctx_name = ['...'];//any object
     * } 
     * class Child {
     *   supplied = this.consume('ctx_name')
     * }
      */
    consume( prop_name,comp=this) {
        while(comp?.TEMP){
            if(comp.TEMP[prop_name])return  comp.TEMP[prop_name];
            comp=comp.TEMP;
            if(comp?.__options?.template_gen_ref===false)console.warn(`Tried to consume a value, but a parent template has disabled exposing TEMP reference with.\nfrom:${this}\nparent:${comp}`)
        };  
    }

    /**
     * Only neccssary to clean the shared obj
     */
    disconnectedCallback() {
        this.dispose()
        // console.log('Clean shared obj after disconnected:', this)

        cleanSelfFromSharedObs(this, []);
    }
    /**For impure templates, that contain things like lambda fn scoped to the specific obj or arr an array Template, you can't cache a pure class level template.
     * Instead you need to execute the html``fn for every custum element and save its exps_val. */
    static supplyOwnTemplExpsVal(uid, exps_val) {
        if (!HofElement.last) {
            return false;
        }
        
        const sub_htmls = HofElement.last?.constructor?.sub_htmls;
        if (!sub_htmls) { throw Error("No last Template") }
        
        if ( !sub_htmls ) { return  }
        
        const sub_html = sub_htmls.get(uid)
       
        //Defined in conditional 
        // if( !sub_html.parsed.is_root && !sub_html.parsed.arr_root_def) { return }
        
        /**@type {Template} */
        const sub_temp = sub_html?.template;
        if (!sub_temp) { throw Error("Expected a template") }
        
        
        const is_array = sub_temp.is_array;
        if(is_array)return
        
        //Merge concreted subhtml own values to this.__own_exps_val
        const entries = sub_temp.exps_val_nr_to_uid.entries();
        for (const [exps_val_nr, uid] of entries) {
            // if (is_array) {
            //     let own_exp_val_arr = HofElement.last.__own_exps_val.get(uid);
            //     if (!own_exp_val_arr) { HofElement.last.__own_exps_val.set(uid, own_exp_val_arr = []) }
            //     own_exp_val_arr.push(exps_val[exps_val_nr]);
            // }
            // else {
            HofElement.last.__own_exps_val.set(uid, exps_val[exps_val_nr]);
            // }
        }
    }

    /**Returns a list of property names that are on the last created obj accessable as prop|methode\
     * It's used during Template creation to differentiate what 'simple props' are, so that they don't need a annonymous function\
     * and to recognise what 
     * This includes methodes & g|setter from the prototype
     * 
     * Note: -currently only own Names and Methodes G|Setter on direct parent class
     *       -the order in which the Custom elements are defined have a impact on what is already in OwnPropertyNames -> needs class parser
     */
    static getLastCreatedProps(last_ele = HofElement.last) {
        if (!last_ele) { return [] }


        const ownNames = last_ele.constructor.all_def_names ?? Object.getOwnPropertyNames(last_ele);
        const proto = Object.getPrototypeOf(last_ele);
        const parentNames = Object.getOwnPropertyNames(proto);
        return [...ownNames, ...parentNames, ...['innerHTML', 'innerHTML_0',/*In Case you use 'class' for class*/'className', 'id']];
    }

    /**@returns {HofOptions} the Options are HofOptions plus some additional info about the obj  */
    static getLastCreatedTemplateOptions(uid, last_ele = HofElement.last) {
        if (!last_ele) { return {} }
        const ele = last_ele;
        /**@type {typeof HofElement} */
        const Class = last_ele.constructor;
        const sub_html = Class.sub_htmls?.get?.(uid);
        const replaceMap = sub_html?.replaceMap;
        const __fn_g_depends = Class.__fn_g_depends;
        if (Class.temp_uid_beginn === undefined) {
            Class.temp_uid_beginn = 0;
        } else {
            Class.temp_uid_beginn += 100;//Determins the max number of ${} in a expression, 100 is reasonable
        }
        const temp_uid_beginn = Class.temp_uid_beginn
        return { ownNames: HofElement.getLastCreatedProps(), ...HofOptions.default, ...ele.__options ?? {}, replaceMap, __fn_g_depends, sub_html:sub_html?.sub_html, temp_uid_beginn };
    }

    //Static utillity methods 

    /**@type {CSSStyleDeclaration|String} */
    static style;
    /** 
     * @type {CSSStyleSheet}
     * A constructed stylsheet for css on tag level */
    static styleSheet;
    static createClassStyle(tagName = "", style = "", save_style) {
        if (!tagName) return
        //is path ~ very low bar what a path is, but starts with ./ | / and no new line
        if (/^\s*\.?\/[^\n]*$/.test(style)) {
            console.warn("path detectet ->nothing happened //to do stub after a routing sytem", style);
            return
        }

        if (!HofElement.styleSheet) {
            HofElement.styleSheet = new CSSStyleSheet();
            document.adoptedStyleSheets.push(HofElement.styleSheet);
        }
        let css_str_val = "";
        if (typeof style === 'object') {
            css_str_val = Object.entries(style).map(([key, val]) => `${key.replaceAll(/([A-Z])/g, "-$1").toLowerCase()}:${val.split("!")[0]}`).join(";\n")
        }
        let global_style = "";
        if (typeof style === 'string') {
            css_str_val = style;
            //Allow global style for things like @keyframes, cause they are not allowed in a selector
            if (style.match(/\/\*\s*GLOBAL/i)) {
                [css_str_val, global_style] = style.split(/\/\*\s*GLOBAL\s\*\//i);
            }
            // if (HofOptions.default.style) {
            //     css_str_val = HofOptions.default.style + "\n" + css_str_val;
            // }

        }
        //Test if it already starts with the class tag or it must be injected.
        const start_re=new RegExp('^(?:\\s|/\\*.*?\\*/)*'+tagName,'is');
        const finished_style =start_re.test(css_str_val)?  css_str_val :`${tagName} {\n${HofOptions.default.style?HofOptions.default.style+';':''}${css_str_val}\n}`
        HofElement.styleSheet.insertRule(finished_style, HofElement.styleSheet.cssRules.length)
        // HofElement.styleSheet.replaceSync(`${tagName} {\n${css_str_val}\n}`)

        if (global_style) {
            HofElement.styleSheet.insertRule(global_style);
        }
        //Produce a style, without the parent for shadow elements
        if (save_style) {
            if (typeof style === 'object') {
                save_style.style_tag = `/* You used a style object, this only defines css for the elements itself,
If you don't need to apply css to the children fine,
if you want give the children css use a string with normal css */`;
                return
            }

            const parent_css = HofElement.styleSheet.cssRules[HofElement.styleSheet.cssRules.length - 1];
            //You have to replace a leading & from all sub selectores
            const sub_styles = [...parent_css.cssRules].map(sub_rule => `${sub_rule.selectorText.replaceAll("& ", "")}${sub_rule.cssText.replace(sub_rule.selectorText, "")} `).join("\n");
            const parent_var_keys = [...parent_css.style].filter(css_prop => css_prop.startsWith("--"));
            const root_var = parent_var_keys.length ?
                `
:root {
${parent_var_keys.map(css_var_name => `${css_var_name}: ${parent_css.styleMap.get(css_var_name)[0]}`).join("\n")}
} `
                : "";

            save_style.style_tag = `${root_var}\n${sub_styles}${global_style ? '\n' + global_style : ''}`
        }
    }

    /**Does `custumElements.define()` with all classes using their tagname or default name\
     * if you use in the class without a Parameter or with a tagname, it does the  customElements.define() Call for you
     * ```
     * AA class extends HofElement{
     *      static {this.define() }
     *      //Or via super and with optional tagname
     *      static {super.define('aaaa-aa') }
     * } 
     * ```
     * !!Info Call this as the last thing in your class, cause otherwise some class Props won't be initalised correctly
    */
    static define(...Classes) {
        //defien yourself on empty call
        if (typeof Classes[0] === 'string') { customElements.define(Classes[0], this); return }
        if (Classes.length === 0) { Classes = [this]; }
        for (const Class of Classes) {
            customElements.define(Class.tagName ?? HofElement.defaultTagName(Class), Class);
        }
    }

    /**Returns the default TagName for a Class or String Name */
    static defaultTagName(className = "") { if (className.name) className = className.name; return className.toLowerCase() + "-"; }

    /**A short version for .localName. Uses defaultTagName internally*/
    static get tag() { return HofElement.defaultTagName(this.name) }


    /**Prop that belong to HofElement, should not be observed,\
     * Observe uses the `filter()` fn from Util/helper.js to use regex -> more concise|easy  */
    static HofElement_props = [  /^__.*|Change|template|innerHTML_0/];
    /**Recursive function to Collect All Subdependencies, //Note: Maybe write a non-recursiv version */
    collectPaths(map, path,propagate_down=50, res = [],clearArrayRoots=false) {
        if(clearArrayRoots&&this.__arrRoot.has(path.join('.'))){
            const sub= this.handleArrayChange({trigger:'set'},path.join('.'),path);
            res.pop(); //remove the ArrayRoot
            res.push(...sub);return res;
        }
        if(propagate_down==0)return res;
        for (const [key, sub_map] of map) {
            if (key === "this") { continue }//special case for this
            const new_path = [...path, key];
           
            res.push(new_path);
            if (sub_map.size == 0) { continue }
            this.collectPaths(sub_map, new_path, propagate_down-1,res,clearArrayRoots);
        }
        return res;
    }
}
/**Goes over the Prototyp chain and Determins if I can set a prop or not */
function setAble(obj, prop, ret_desc = false) {
    let desc = Object.getOwnPropertyDescriptor(obj, prop);;
    let proto = obj;
    while (!desc && (proto = Object.getPrototypeOf(proto))) {
        desc = Object.getOwnPropertyDescriptor(proto, prop);
    }
    if (ret_desc) return desc;

    //Not yet here
    if (desc === undefined) return true;

    if ((desc.get && !desc.set)) return false;

    if (desc.writable === false) return false;

    return true;
}
/**Alias for HofElement */
// const HFML=HofElement;
/**Alias for HofElement */
// const HofHtmlElement=HofElement;


export {css, html, nohtml ,  makeDeepObservable,Template, Delete,ForceUpdate,laxJSON};
