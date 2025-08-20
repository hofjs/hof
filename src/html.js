import { extractParams, extractParamsAndBody, extractTemplateStringsParser, getNormalisedPath, isLambdaFunction, parseAllVars, ParsedTemplateSting, toJSPath } from "./ExtractParsing.js";
import { decodeHtmlEntities, escapeRegExp, Queue } from "./helper.js";
import { HofElement, HofOptions } from "./HofElement.js";
import { defaultParam, SYNCList } from "./syncDef.js";

export const css = String.raw;


export function html(strs, ...exps_val) {
    //Use the raw string to prevent some bugs
    const uid = strs.raw.map(str => str.length) + "|explen:" + exps_val.length;

    let temp = HofElement.getLastTempJS(uid);

    // Compose normal String like without funtion  before `` 
    if (!temp) {
        let str_res = "";
        let i = 0;
        for (const str of strs) {
            str_res += str + (exps_val[i] ?? "");
            i++
        }
        return str_res;
    }
    
    //Already created for this class
    if (temp.constructor.name === Template.name) {
        if(temp.is_dyn_exp_HTML){
            return temp.fill(exps_val);
        }    
        if (!temp.is_pure ) HofElement.supplyOwnTemplExpsVal(uid, exps_val);
        return temp;
    }

    const is_root = temp.is_root;
    /**@type {String|ParsedTemplateSting} */
    let impl = temp;

    const opt = HofElement.getLastCreatedTemplateOptions(uid);

    //Dureing Template Creation other Custom elements may be created, therfore save who you where
    // HofElement.stash();

    const currenTemplateEle = HofElement.getLast();

    temp = new Template(impl, exps_val, opt);

    HofElement.resetLastAs(currenTemplateEle);


    //Register the finished template, so that it can be reused
    HofElement.supplyforLastTemp(temp, undefined, uid, is_root)

    if (!temp.is_pure) HofElement.supplyOwnTemplExpsVal(uid, exps_val);
    if(temp.is_dyn_exp_HTML){
        return temp.fill(exps_val);
    }    

    return temp;
}
class ParamBuild {
    default = new Map();
    idx = new Set();
    idx_rename = new Map();
}

/** A HTML String and a function to  recreate it */
export class Template {
    html_str = "";
    toString() { return this.html_str }
    static domParser = new DOMParser();
    dom_temp = document.createElement("div");

    /**Here are the Objects stored, if the  ${} of html`` has become an array or object, it uses the Expression key */
    func_depends = new Map();

    /**Means it has no lamba expressions, that have to be extracted from the html`` on every obj creation */
    is_pure = true;

    /**Is a Template for created via map */
    is_array = false;


    arr_prop;
    arr_root_def;
    is_dyn_exp_HTML;
    /** allows to interpolate a template with html exps_val array @type { Map<number,{path:number[],attr:string,composFn?:Function}> } */
    __expsToAttrMap=new Map();
    registerExpToAttr(nr,elm,attr,composFn){
        if(!this.is_dyn_exp_HTML)return;
        const path = [];
        /** @type {HTMLElement} */
        let curElm =elm;
        let guard = 1000;
        if(attr?.[0]=="#"){ path.push( +attr.slice(1)),attr='data' }
        while(guard-- && curElm.parentElement){
            const index = Array.prototype.indexOf.call(curElm.parentElement.childNodes,curElm);
            path.push(index);
            curElm = curElm.parentElement;
        }
        const obj = {path,attr};
        if(composFn){obj.composFn = composFn }
        this.__expsToAttrMap.set(nr, obj );
    }
    fill(exps_val){
        /** @type { HTMLElement} */
        const dom =  this.dom_temp.cloneNode(true);
        dom.querySelectorAll("[sync]").forEach(elm=>elm.removeAttribute('sync'));

        for(const [nr,{attr,path}] of this.__expsToAttrMap){
            let elm =dom;
            let i=path.length-1;
            while(i>=0){
                elm = elm.childNodes[path[i]];
                i--;
            }
            // for <a ${ <exp> } >...
            if(Object.hasOwn( attr,'rm')){
                elm.removeAttribute(attr.rm??'');
                if( exps_val[nr]) elm.setAttribute(exps_val[nr],"")
             
            }
            else{
                if(typeof exps_val[nr]==='function')elm.removeAttribute(attr);
                elm[attr] = exps_val[nr];
            }
        }
        return [...dom.childNodes];
    }

    /**A Map from the ${} pos to potential subhtml with array @type {Map<number,import("./HofElement.js").SubHTML>} */
    sub_html;

    /**Map the nr in the html``fn to a uid used in the sync attr. 
     * Needed because some ${}, mostly lambdas or stateful object (like new Date()) and Array TEmplates, can't be saved once per class,
     * and must instead be collected from the ${} for every element
     * @type { Map <String,Number> }*/
    uid_to_exps_val_nr = new Map();

    /** The other way around
    * @type { Map <String,Number> }*/
    exps_val_nr_to_uid = new Map();

    /**Makes a deep copy of the dom_temp html to the $root obj
     * @param {HofElement} $root */
    copy($root) {
        const copy = this.dom_temp.cloneNode(true);
        $root.replaceChildren(...[...copy.childNodes]);
    }

    intitReplaceRe() {
        const options = this.options;
        if(!options.replaceMap){
            options.replaceMap=new Map([['html','constructor.html']])
        }
        const replaceMap = this.options.replaceMap;
        /**needed for html */
        if(!replaceMap.has('html')){
            replaceMap.set('html','constructor.html')
        }
        const nonEmptyEntries=[...replaceMap].filter(entry=>entry[0]!=="");
        options.replace_pos = new Array(nonEmptyEntries.length).fill(0);
        options.replace_re = new RegExp(`(?<!\\.\\s*)\\b(?:` + nonEmptyEntries.map(([from, to], i) => { options.replace_pos[i] = to; return `(${escapeRegExp(from)})` }).join('|') + `)\\b`, 'ms');
        replaceMap.dirty = false;
    }

    /**Checks if prop is in Replace Map and returns as what entry */
    isInReplaceMap(prop = "") {
        if (this.options?.replaceMap?.dirty) { this.intitReplaceRe(); }
        const { replaceMap, replace_pos, replace_re } = this.options;
        if (!replaceMap || replaceMap.size === 0) return [];

        const _m = prop.match(replace_re);
        if (!_m) return undefined;
        const index = _m.slice(1).findIndex(Boolean);
        const replace_prop = replace_pos[index];

        const replaced = prop.replace(replace_re, replace_prop).replaceAll(/\s*|\?/g, "");
        return [prop, replaced.trim()];
    }
    /**find suitable defautl values */
    compInititVal(init_val,/** @type {HTMLElement} */element, anno_initial_value=false) {
        //for anno that binds to custom attr, so that nothing is displayed in text
        if(anno_initial_value)return "";

        if (this.options.temp_default === undefined) return init_val ?? "";


        if (typeof init_val === 'boolean') return init_val;
        //Not for functions, they already have a custum display str
        if (typeof init_val === 'function') { return init_val }
        if (this.options.temp_default === HofOptions.temp_default.first) { return init_val }
        if (this.options.temp_default === HofOptions.temp_default.type) {
            let html_type; let min_max;
            if (element.tagName === "INPUT" && element.type) {
                html_type = element.type;
                //Don't use min if it is itself a EXP_PLH
                if (!/EXP_§_/.test(element.min)) { min_max = element.min; }
                else if (!/EXP_§_/.test(element.max)) { min_max = element.max; }
            }
            let type = init_val?.constructor?.name ?? typeof init_val;
            //Catch Strings, that look like html Dates
            if (type == "String" && /^\d{1,4}-\d{1,2}-\d{1,2}/.test(init_val)) type = "Date";

            return (min_max || HofOptions.type_dflt[html_type]) ?? HofOptions.type_dflt[type];
        }
        return "";
    }
    /**Tries to get the class_dflt value first from HofElement.last, then from options.dflts */
    getDefaultValue(prop){
        const path_splitted= prop.split(".");
        return (HofElement.last && HofElement.prototype.__getPath.call(HofElement.last,path_splitted,path_splitted.length)) ?? this.options.dflts?.[prop];
    }

    /**Retruns for a prop the attr name via the regex that can be given in the __options */
    shorthandName(prop, shorthand_regex) {
        const path_splitted= prop.split(".");
        let attr_name= path_splitted[0];
        //for context take value_xxx from constructor.ctx.value_xxx
        if(path_splitted[0]==='constructor'&&path_splitted[1]==='ctx'){
            attr_name=path_splitted[2];
        }
        if (shorthand_regex) {
            const _m = attr_name.match(shorthand_regex);
            if (_m[1]) attr_name = _m[1];
        }
        return attr_name;
    }
    /**
     * @typedef {  {exp_rest:String,html:Boolean,no_html:Boolean,exp:Boolean,fix:Boolean,custum_attr:Boolean|String} } Annos
     */

    /**
     * This Extracts the relevant Annotaions. It allso returns the remaining exp part.
     * This allows, so that simple Prop with exp like ${ 'html', this.user.data } are not interpreted as Evaluated Dependencies, that are more expensiv 
     * @returns {Annos}
     */
    extractAnnos(exp = "") {
        const res = { exp_rest: exp, html: false, no_html: false, exp: false, fix: false, custum_attr: false };

        const annos_m = exp.match(this.options.annos.any_anno);
        if(!annos_m)return res;
        const whole_anno = annos_m[1]||annos_m[3];
        const relevant_anno =  annos_m[2]||annos_m[4];
        if (whole_anno.match(/this/)) { return res }
        res.exp_rest = exp.slice(whole_anno.length);
        const { no_html_anno_re = /['"`]?no_html['"`]?/, use_html_anno_re = /['"`]?html['"`]?/, exp_anno_re = /(['"`])?exp\1?/i,  fix_anno_re = /(['"`])?fix\1?/i } = this.options.annos;

        let _m
        //for future use ,right now & | | mean the same 
        for (const anno of relevant_anno.split(/\||&/)) {
            if (no_html_anno_re.test(anno)) { res.no_html = true; continue }
            if (use_html_anno_re.test(anno)) { res.html = true; continue }
            if (exp_anno_re.test(anno)) { res.exp = true; continue }
            if (fix_anno_re.test(anno)) { res.fix = true; continue }
            if (_m = anno.match(/'[^']+'|"[^"]+"|`[^`]+`/)) {
                res.custum_attr = _m[0].slice(1, -1);
            }
        }
        return res;
    }

    /**Number assigned uids */
    uid_i = 0;
    getSyncUid(type = 'f') { return `#${type}-${(this.uid_i++ + '')}` }

    /**@type {HofOptions} */
    options;
    /**
     * 
     * @param {String|ParsedTemplateSting} js_temp_str 
     * @param {*} exps_val 
     * @param {*} options 
     */
    constructor(js_temp_str, exps_val, options = {}) {
        let { strs, exps = [] } = ((js_temp_str.strs && js_temp_str) || (typeof js_temp_str==='string'&&{strs:js_temp_str} ) || (  extractTemplateStringsParser(js_temp_str, true)) )?? {};



        if (js_temp_str?.is_array) this.is_array = js_temp_str.is_array;
        if(js_temp_str?.is_dyn_exp_HTML){this.is_dyn_exp_HTML=js_temp_str?.is_dyn_exp_HTML}

        //Create the dom fragment with unique numbered placeholder for exps, resolve the exps only after DOM Parser, to have Context
        let html_str = "";
        let i = 0;
        /**!! Cannot be in the final html & must be a valid HTML tag, attr & content */
        const exp_plh = "EXP_§_";
        const exp_plh_end = "§";  //An unique end to aviad merging of the number with surrounding text
        const exp_plh_re = /EXP_§_(?<nr>\d+)§/;
        const exp_plh_re_case_i = /EXP_§_(?<nr>\d+)§/i;//to match tag names
        const exp_plh_re_case_i_g = /EXP_§_(?<nr>\d+)§/ig;
        const simple_exp_plh = /^\s*EXP_§_(?<nr>\d+)§\s*$/i;
        for (const str of strs) {
            html_str += str + (exps[i] ? exp_plh + i + exp_plh_end : '');
            i++;
        }

        //Old There are waring I can't disable at e.g.  <input  type=number value="EXP_§_4§">
        // this.dom_temp.innerHTML = html_str;
        {
            const html_doc = Template.domParser.parseFromString(html_str, 'text/html')
            this.dom_temp.replaceChildren(...html_doc.body.childNodes);
            
            //Append a potential leading empty space text node -> special good for arrays 
            let _m;
            if(_m=html_str.match(/^\s+/)){
                this.dom_temp.insertAdjacentText('afterbegin',_m[0]);
            }
        }


        this.options = options;
        const { wrap_tag, arr_wrap_tag, arr_el_wrap_tag, dynamic_html_default, replaceMap, sub_html, temp_uid_beginn, shorthand_regex } = this.options;
        if (temp_uid_beginn) this.uid_i = temp_uid_beginn;
        this.sub_html = sub_html;

        //Replace exps from function params to class props
        this.intitReplaceRe();

        //Iterative traverse all HTML elements
        const ele_to_visit = new Queue(this.dom_temp);
        let max_iter = 1000;
        /**@type {HofElement }*/let visited_ele;

        /**Set of elements that have a synclist and must convert it to attribute later */
        const toSync = new Set();


        while ((visited_ele = ele_to_visit.dequeue) && max_iter-- > 0) {
            let _m;
            if (visited_ele.nodeType == Node.TEXT_NODE) {
                /**@type {Text} */
                let textNode = visited_ele;

                const parent = textNode.parentElement;
                if(!parent)continue;
                let node_index = Array.prototype.indexOf.call(parent.childNodes, textNode);

                let max_iter_tn = 1000;
                while ((_m = textNode.data.match(exp_plh_re)) && max_iter_tn-- > 0) {
                    const nr = Number(_m.groups.nr);
                    //if ${} is not at start, split Text Node in two and returns second one, 
                    const exp_node = _m.index > 0 ? (node_index++, textNode.splitText(_m.index)) : textNode;

                    let attr = '#' + node_index;
                    let el_for_Sync = parent;

                    //If after the ${} is more text splite exp_node
                    if (_m[0].length < exp_node.data.length) {
                        textNode = exp_node.splitText(_m[0].length);
                        node_index++;
                    }

                    let [initial_value, prop_name, sub_depend, attr_name, annos, is_arrRoot] = this.calcDependencies(exps[nr], exps_val?.[nr], nr, el_for_Sync, attr,);

                    const exp_val_is_arr = Array.isArray(initial_value);


                    const use_html = (!annos.no_html) && ((Template.hasHTML(exps_val?.[nr]))||Template.hasHTML(exps?.[nr]) || dynamic_html_default || annos.html);
                    //if it uses html, replace the Text Node with wrap_tag (default span) or directly on the parent, if only  <parent>\s*EXP_PLH\s*</parent>
                    if (use_html || is_arrRoot) {
                        //innerText, cause it does not display comment; ; for svg elements use the textContent
                        const on_parent = parent.childElementCount===0 && (parent.innerText??parent.textContent).match(simple_exp_plh) ;
                        let wrap_el = on_parent ? parent : document.createElement(is_arrRoot ? arr_wrap_tag : wrap_tag);
                        if (is_arrRoot) {
                            if (annos.exp) {
                                wrap_el.innerHTML = "#EXP-ARR"
                            }
                            else if (exp_val_is_arr) {
                                for (let i = 0; i < initial_value.length; i++) {
                                    const copy = initial_value[0].dom_temp.cloneNode(true);
                                    wrap_el.append(...copy.childNodes);
                                }
                            }
                            else { wrap_el.innerHTML = initial_value; }
                        }
                        else {
                            wrap_el.innerHTML = initial_value;
                            this.handleAllEmptyTextNode(wrap_el)
                        }
                        if (!on_parent) {
                            if(prop_name){
                                parent.replaceChild(wrap_el, exp_node);
                            }
                            //Has no dependencies -> only use the children 
                            else{
                                node_index+= Math.max(0 , wrap_el.childNodes.length - 1); //You are already one
                                exp_node.replaceWith(...wrap_el.childNodes);
                            }
                        }
                        
                        attr_name = 'innerHTML';
                        el_for_Sync = wrap_el;
                    }
                    if (prop_name) { SYNCList.registerOnElement(el_for_Sync, toSync, prop_name, sub_depend, attr_name); }

                    exp_node.data = use_html ? "" : initial_value;
                }
                continue;
            }

            if (visited_ele.nodeType === Node.COMMENT_NODE) {
                continue;
                // console.log("here was a comment:",visited_ele)
            }

            // localName is the tagName in small 
            if (_m = visited_ele.localName.match(exp_plh_re_case_i)) {
                const nr = Number(_m.groups.nr);
                const exp_val_tag_name = exps_val?.[nr] ?? 'No_EXPS_VAL_TAGNAME' + nr;
                console.warn("dynamic tag are not supported adn could lead to shifts in the HTML!!!",`\nat ${exps?.[nr]} ${exp_val_tag_name}`)
                visited_ele.outerHTML = `${exp_val_tag_name}${visited_ele.innerHTML}${exp_val_tag_name}`;
                // this.calcDependencies(exps[nr], exps_val?.[nr], nr, visited_ele, 'tagName', toSync)
            }

            const initial_attrs = [...visited_ele.attributes];

            //To know when to abort overwrite of dynamic named attr cuase the the fixed ones after it should have a higher pri
            const remain_attr = new Set(initial_attrs.map(x => x.name));

            //Go over all attrbiutes and find expression placeholder
            for (const { name, value } of initial_attrs) {
                let initial_value;
                let initial_name;
                remain_attr.delete(name);
                if (exp_plh_re_case_i_g.test(name)) {
                    let last_exp_plh = [];
                    let last_nr = [];
                    initial_name = name.replaceAll(exp_plh_re_case_i_g, (_, nr) => { last_exp_plh.push(_); last_nr.push(nr); return exps_val?.[nr] ?? 'No_EXPS_VAL_ATTR_VALUE' + nr });
                    if (name !== initial_name) { 
                        // only for solo ones like ${...} not  a${...}b
                        if(last_nr.length>0)this.registerExpToAttr(+last_nr[0],visited_ele,{rm:initial_name});
                        visited_ele.removeAttribute(name) 
                    }
                    const next_equ_re = new RegExp(last_exp_plh.at(-1) + "[^\\s=>]*(?:\\s*=)?", 'i');
                    let _m = html_str.match(next_equ_re);
                    /**Test if there was no = after the attr in the original, like <p ${ok}   ${not_ok}="..." > 
                     * Just testing attr value isn't enough, cause it is allways "", even if no value was given
                     * Then you can use  Property-Value-Shorthand for attr like
                     * ```
                     * value="aa bb";
                     * <input ${value} >  => <input value=${value}  > 
                     * ```
                     */
                    const is_shorthand = _m[0].endsWith("§") || _m[0].endsWith(">"); //second one is special case for <input ${...}> ->  'EXP_PLH§NR§>'
                    const val = exps_val?.[last_nr.at(-1)];
                    let prop_name = exps?.[last_nr.at(-1)].trim();
                    let on_this = false;
                    let norm_prop = getNormalisedPath(prop_name);
                    if (norm_prop.startsWith("this.")) { on_this = true; norm_prop = norm_prop.slice(5); }
                    else {
                        [, norm_prop] = this.isInReplaceMap(norm_prop) ?? []; if (norm_prop) on_this = true;
                    }

                    if (is_shorthand && last_exp_plh.length == 1) {

                        const is_simple = simple_prop_re.test(prop_name);
                        if (!is_simple) { on_this = false; }
                        //Do it for all Keys of object
                        if (!is_simple && typeof val === 'object') {
                            const keys = Object.keys(val);
                            for (const key of keys) {
                                const attr_name = this.shorthandName(key, shorthand_regex);
                                if (!attr_name) { continue }
                                if (on_this) {
                                    SYNCList.registerOnElement(visited_ele, toSync, norm_prop + "." + key, [], [attr_name]);
                                }
                                //No binding, just set the attr
                                else {
                                    if (remain_attr.has(attr_name)) continue
                                    visited_ele.setAttribute(attr_name, val[attr_name])
                                }
                            }
                            initial_name = undefined;
                        }
                        else if ( is_simple) {
                            initial_name = this.shorthandName(norm_prop ?? prop_name, shorthand_regex);
                            initial_value = typeof val === 'function' ?"" : val;
                            if ( on_this) SYNCList.registerOnElement(visited_ele, toSync, norm_prop, [], [initial_name]);
                            
                        }
                        else {
                            //Interpret as a HTML ATTR string like <input  ${ `  attr1="value1"  attr2="value2"    ` } >
                            const val_str = "" + val;
                            // -> split at =
                            const name_val_pairs = [...val_str.matchAll(/(\S+)\s*=\s*([^"'\s]+|"[^"]*"|'[^']*')/g)];
                            let last_end_idx= 0;
                            for (let { 1: attr_name, 2: value,index } of name_val_pairs) {
                                //Detect up to attr names not matched by RegExp like    ${ `onlyName1   key="value "  onlyName2 ...`  } 
                                const up_to_attr_str = val_str.slice(last_end_idx, index);
                                if(up_to_attr_str){ 
                                    up_to_attr_str.match(/\S+/g)?.forEach?.(
                                    name=>visited_ele.setAttribute(name,'')
                                )};
                                // Is Overriden anyway -> ignore
                                if (remain_attr.has(attr_name)) continue
                                if (value[0] === '"' || value[0] === "'") { value = value.slice(1, -1) }
                                
                                const decode_value = decodeHtmlEntities(value);
                                visited_ele.setAttribute(attr_name, decode_value);
                            }
                            if (name_val_pairs.length > 0){
                                initial_name = undefined;
                                //use rest attr names
                                const rest_attr = val_str.slice(name_val_pairs.at(-1).index + name_val_pairs.at(-1)[0].length);
                                rest_attr.match(/\S+/g)?.forEach?.(
                                    name=>visited_ele.setAttribute(name,'')
                                )
                            }
                            /** look if it is a fix conditional attributte */
                            else if(val&& typeof val==='string'){
                                visited_ele.setAttribute(val,"");
                            }
                        }

                    }

                }
                if (exp_plh_re.test(value)) {
                    //only one EXP placeholder in this attr value like <tag attr='  ${'bla blbfb'}  '>  ->  <tag attr='  EXP_§_3_§  '>
                    if (_m = value.match(simple_exp_plh)) {
                        const nr = Number(_m.groups.nr);
                        // initial_value = exps_val?.[nr] ?? 'No_EXPS_VAL_ATTR_VALUE' + nr;
                        [initial_value] = this.calcDependencies(exps[nr], exps_val?.[nr], nr, visited_ele, initial_name ?? name, toSync)
                    }
                    else {
                        // has string parts and or multiple ${} in a attr like <tag style='color:${this.color};display:${this.dsp}'>  ->  <tag style='color:EXP_§_3_§;display:EXP_§_4_§'>
                        const attr_exps = [];
                        const attr_exps_val = [];
                        const nrs = []
                        const attr_exp = value.replaceAll(exp_plh_re_case_i_g, (_, nr) => {
                            nr = Number(nr);
                            attr_exps.push(exps[nr]);
                            attr_exps_val.push(exps_val?.[nr]);
                            nrs.push(nr);
                            return "${" + exps[nr] + "}";
                        });
                        const attr_exp_val = value.replaceAll(exp_plh_re_case_i_g, (_, nr) => exps_val?.[nr])
                        initial_value = this.calcCompoundDependencies(attr_exp, attr_exp_val, attr_exps, attr_exps_val, nrs, visited_ele, initial_name ?? name, toSync);
                    }
                }
                if (initial_value !== undefined || initial_name?.trim?.()) {
                    if(typeof initial_value ==='object'|| typeof initial_value ==='function' ){
                        // initial_value=JSON.stringify(initial_value);
                        // initial_value="";
                        visited_ele.removeAttribute(initial_name ?? name);
                    }
                    else{
                        visited_ele.setAttribute(initial_name ?? name, initial_value ?? value);
                    }
                }
            }
            //Handle manual text node bounds
            if(visited_ele.getAttribute("SYNC")){
                this.handleEmptyTextNode(visited_ele,visited_ele.getAttribute("SYNC"),)
            }
            //Enqueue all ChildNodes
            ele_to_visit.enqueueHeadAll(...visited_ele.childNodes);
        }

        for (const ele of toSync) {
            if (!ele.__synclist) continue;
            const sync_val = ele.__synclist.toAttribute();
            let old_sync = ele.getAttribute("SYNC") ?? "";
            if (old_sync) old_sync += " | ";
            ele.setAttribute("SYNC", old_sync + sync_val);
        }

        if (this.is_array) {
            const dom_temp = this.dom_temp;
            //if not a single wrapping DOM tag with no TextNodes around (= could have Text)
            //No problem, if other Nodes are empty TextNodes
            if (dom_temp.children.length !== 1 || [...dom_temp.childNodes].some(node => node.nodeType === Node.TEXT_NODE && ! /^\s*$/.test(node.data))) {

                // Only Text or has Multiple DOM Elements -> Wrap in wrap tag
                const wrap_el = document.createElement(arr_el_wrap_tag ?? wrap_tag);
                if (dom_temp.attributes.sync) {
                    wrap_el.setAttribute("SYNC", dom_temp.attributes.sync?.value);
                    dom_temp.removeAttribute("SYNC");
                }
                wrap_el.replaceChildren(...dom_temp.childNodes);
                dom_temp.append(wrap_el);


            }
        }
        this.html_str = this.dom_temp.innerHTML;
        this.options = { '__': 'cleared_After_init' }
    }
    [Symbol.toString]() { return this.html_str }
    static isOn(obj) { return obj?.constructor?.name === Template.name }

    /**Determines what type the exp is, sets the beloning depends, returns the initial value 
     * @typedef { [init_val:any,prop_name:String, sub_depend:String[],attr_name:String, annos:Annos, is_arrRoot:Boolean] } CalcedDepend
     * @returns {CalcedDepend}
    */
    calcDependencies(exp = "", exp_val, nr, element, attr_name, toSync) {
        this.registerExpToAttr(nr,element,attr_name);

        const is_fn = typeof exp_val === 'function';
        let is_lambda = is_fn && isLambdaFunction(exp_val);
        if(is_lambda){ this.is_pure=false }
        const is_obj = typeof exp_val === 'object';

        const annos = this.extractAnnos(exp);

        exp = annos.exp_rest;
        let initial_value = is_fn?"":exp_val;
        
        let anno_initial_value=false;
        if (annos.custum_attr){ attr_name = annos.custum_attr;anno_initial_value=true;}
        if (annos.fix) return [exp_val, , , attr_name, annos, false];
        let prop_name;
        let sub_depend = [];
        const is_exp = annos.exp  || !is_fn;
        //A exp from a function
        const is_fn_exp =(is_fn&& (attr_name[0]==='#')&&!this.arr_prop )
        let _m;
        const sub_html = this.sub_html && this.sub_html.get(nr);
        const is_arrRoot =  sub_html && !annos.exp && sub_html.parsed.is_array && !sub_html.parsed.is_dyn_exp_HTML;
        ;

        let is_simple = false;
        let exp_func;
        //Is array map ${}
        if (is_arrRoot) {
            prop_name = sub_html.arr_root_def
        }
        if (_m = exp.match(simple_prop_re)) {
            is_simple = true;
            const starts_this = _m[1] === 'this';
            if (starts_this) {
                prop_name = exp.replaceAll(/\s|\?/g, "").replace(/this\s*./, "");
                prop_name = getNormalisedPath(prop_name);
                const first_access = prop_name.split('.')[0];
                this.definedTest(first_access, prop_name);
            }
            else {
                const normedExp = getNormalisedPath(exp);
                const [, replace_name] = this.isInReplaceMap(normedExp) ?? [];
                //Remove the this
                if (replace_name) {
                    prop_name = replace_name.startsWith("this.") ? replace_name.slice(5) : replace_name;
                }
                //Is some Context
                else {
                    if (this.options.auto_context) {
                        const context_req = [{ path: exp, obj: exp_val, prop_name }];
                        const res = HofElement.supplyContextNames(context_req);
                        is_simple = res;
                        if (res) {
                            prop_name = context_req[0].prop_name;
                        }
                        // console.warn(`Detected js var in simple prop form from context: ${exp} , right now only initial val is taken, they will not be synced, but you could give them to a class var`)
                        //no syncing
                        // return [initial_value ?? this.options.undefined_val, , annos, is_arr];
                    }
                    else {
                        is_simple = false;
                    }
                }
            }

           
            const first_access = prop_name && prop_name.split('.')[0];
            //Don't do this for functions, cause you don't want them to be reassigned when any value in it changes
            if (!is_fn && this.options.__fn_g_depends?.has?.(first_access)) {
                sub_depend.push(... this.options.__fn_g_depends.get(first_access));
            }
        }
        //Try to resole as Expression or Funktion
        if (!is_simple) {
            const param_info = new ParamBuild();
            const param_dflt_str = this.extractSubDepends(is_fn&&!is_exp ? exp_val : exp, sub_depend, true, param_info, is_fn && is_exp);
            //Just a constant no syncing neccessary
            if (!is_fn && !is_obj && sub_depend.length === 0) {
                return [initial_value ?? this.options.undefined_val, , sub_depend, attr_name, annos, is_arrRoot];
            }


            //Make a destructured object for replace params used for array like (x,i)=> html `<li> ${i} </li> `
            const exp_params_arr = param_dflt_str ? [param_dflt_str] : [];

            /**To avoid line break and unexpected undefined retrun
             *   retrun 
             *       34+this.xxx  */
            const exp_st_trim = exp.trimStart();

            exp_func = is_exp ? new Function(...exp_params_arr, `return ${exp_st_trim}`) : exp_val;

            //If you have Params to supply to Function
            if (is_fn&&!is_exp &&!is_fn_exp && param_dflt_str) {
                //Parse and cache
                if (!exp_val.parsed) { exp_val.parsed = extractParamsAndBody(exp_val) }
                let [base_fn_params, base_fn_body,has_curly] = exp_val.parsed;

                //Just to avoid duplication of params in base_fn_params
                //DUMP
                const base_fn_params_filtered = base_fn_params.split(",").reduce(
                    (a, p) =>{const param_str= p.trim();return param_info.default.has(param_str)||param_info.idx.has(param_str) ? '' :a + (a ? ',' : '') + param_str}
                    , '');

                //Just to make body intend more pretty
                base_fn_body = "\t" + (is_lambda &&!has_curly ? 'return ' : '') + base_fn_body.split(/\r?\n/).map(line => "\t" + line.trim()).join("\n").trim();

                const scoped_params = "\n/*Injected Params of the surrounding Map Function*/\n" +
                    param_dflt_str
                    + ",\n/*The Original Params of your Function*/\n\t" + base_fn_params_filtered

                try{
                    exp_func = new Function(scoped_params, base_fn_body);
                    exp_func.__supplied_params = true;
                }
                catch(e){
                    console.warn(`Failed to inject scope in a Function, cuase I could not create async Function.\nYou can ignore this warning for only toplevel|pure Templates without nesting (e.g. Array List Fn)`)
                }
            }

            const uid = is_arrRoot ? prop_name : this.getSyncUid( (is_exp||is_fn_exp) ? "EXP" : is_lambda ? "FUN-LAMBDA" : "FUN");
            prop_name = uid;
            // names = [uid, ...all];
            this.func_depends.set(uid, exp_func);
            if (is_fn) {
                this.uid_to_exps_val_nr.set(uid, nr);
                this.exps_val_nr_to_uid.set(nr, uid);
            }

            if (is_obj) { this.uid_to_exps_val_nr.set(uid, nr); this.exps_val_nr_to_uid.set(nr, uid); }
        }
        //For text nodes, it's not yet clrear which elements you need to attach the syncing, so just retrun props here and decide later
        if (toSync) {
            SYNCList.registerOnElement(element, toSync, prop_name, [...new Set(sub_depend)], attr_name);
        }

        if (is_arrRoot && sub_html && Template.isOn(sub_html.template)) {
            this.mergeTemplates(sub_html.template, element);
            //Use a init value, that aren't Templates
            if( ! Template.isOn( exp_val?.[0]) ){
                if(Array.isArray( exp_val)){
                    exp_val=exp_val.join("");
                }
                //If you have a join('.') still try to get the length from the class
                else if(typeof exp_val==='string'){
                    const class_dflt= this.getDefaultValue(sub_html.arr_prop);
                    exp_val=new Array(class_dflt.length);
                    exp_val[0]=sub_html.template;
                }
            }
        }
        initial_value   =  (typeof exp_val!=='object')  && !is_arrRoot  ? this.compInititVal(exp_val, element,anno_initial_value) : initial_value;
        return [initial_value ?? this.options.undefined_val, prop_name, sub_depend, attr_name, annos, is_arrRoot];
    }
    /**Calculates the dependencies for a consisting of multiple ${} or with string parts
     * Will generate a expression that returns the compound string and retruns the inital value. Used for attributes
     * like    "color:${this.color};display:${this.dsp}"
     * @param {string} attr_exp the whole compound exp as js string
     * @param {string} attr_exp_val the whole compound exp as computed string
     * @param {string[]} exps the ${} exps as js string
     * @param {any} exps_val 
     * @param {number[]} nrs the place of the exps in the html``fn
     * @param {HTMLElement} element 
     * @param {string} attr_name 
     * @param {HTMLElement[]} toSync all HTML elements, that have a sync attr that will be computed at the end
     */
    calcCompoundDependencies(attr_exp, attr_exp_val, exps, exps_val, nrs, element, attr_name, toSync) {
        //Save Objects 
        let any_obj = exps_val.some((x, i) => {
            const is_obj = typeof x === 'object' || typeof x === 'function';
            if (is_obj && !simple_prop_re.test(exps[i])) {
                const obj_uid = this.getSyncUid('OBJ');
                this.func_depends.set(obj_uid, x);
                this.uid_to_exps_val_nr.set(obj_uid, nrs[i]);
                this.exps_val_nr_to_uid.set(nrs[i], obj_uid);
            };
            return is_obj
        });
        let sub_depend = [];
        // let exp_params_arr = [];
        const param_builder = new ParamBuild();
        for (const exp of exps) {
            this.extractSubDepends(exp, sub_depend, false, param_builder, true)
        }
        sub_depend = [...new Set(sub_depend)];

        //Just a constant no syncing neccessary,
        if (!any_obj && sub_depend.length === 0) { return attr_exp_val }

        const param_dflt_str = this.StrfromParams(param_builder);
        const exp_params_arr = param_dflt_str ? [param_dflt_str] : [];

        //Make a destructured object for replace params used for array like (x,i)=> html `<li> ${i} </li> `
        // exp_params_arr = exp_params_arr.length > 0 ? ["{" + exp_params_arr.join(",") + "}={}"] : [];

        const exp_func = new Function(...exp_params_arr, `return \`${attr_exp}\``);
        const uid = this.getSyncUid("EXP");
        this.func_depends.set(uid, exp_func);

        SYNCList.registerOnElement(element, toSync, uid, sub_depend, attr_name);
        return this.compInititVal(attr_exp_val, element);
    }
    /**Test if ypu should interpret the str as html
     * !!! Still very dump !!!
     */
    static hasHTML(str = "") {
        return /<[^<>]+>/.test(str);
    }
    /**
     * Merges the anonymous ${} expression dependency of two Templates
     * @param {Template} other_temp 
     * @param {HTMLElement} at_ele  maybe used in future to avoid redundancy
     */
    mergeTemplates(other_temp, at_ele) {
        for (const [key, val] of other_temp.func_depends) {
            if (this.func_depends.has(key)) { throw Error("unexpected duplicat uid for anonymous ${} expression while merging Templates") }
            this.func_depends.set(key, val);
        }
    }
    /**Throws a Error, if prop is not defiende on Component */
    definedTest(first_access, prop_name) {
        //Currently just allow all private prop like  this.#xxx, they don't work anyway
        if (this.options.only_defined && !this.options.ownNames?.includes?.(first_access) && !first_access[0]==='#' ) {
            throw Error(`this.${prop_name} is not included in this component\nYou can still use it, if you disable the option only_defined.\nNote: The prop may have no g|setter attached, if no attr with ${prop_name} is set in html definition`);
        }
        return true;
    }
    /**Calcs the Subdependencies of a ${} js str. You can give a sub_depend or  array, to operate on it */
    extractSubDepends(exp, sub_depend = [], make_param_str = true,
        param_builder = new ParamBuild(), fun_as_exp = false,
    ) {
        const ignoreFNParams=new Set();
        /** this avoid conflicts if a parameter name matches a replaceMap entry */
        if(typeof exp ==='function'){
            exp=exp+"";
            const res = extractParams(exp);
            res.forEach( p=> ignoreFNParams.add(p.name)  );
        }
        //Dump , does not detect if in comment, string or regex
        // sub_depend.push(...exp.match(any_this_g)?.map(path => path.startsWith("this") ? path.slice(5).replaceAll(/\s|\?/g, "") : path) ?? []);

        let parsed_sub_dep = parseAllVars(exp, { class_fns: true });
        const class_fns = parsed_sub_dep.class_fns;

        parsed_sub_dep = [...new Set(parsed_sub_dep.map(p => getNormalisedPath(p)))];

        const { default: p_defaults, idx, idx_rename } = param_builder;
        parsed_sub_dep = parsed_sub_dep.map(prop => {
            if (prop === "this") return prop;
            if(ignoreFNParams.has(prop))return;
            if (prop.startsWith('this.')) {
                const normed_path = prop.slice(5);
                this.definedTest(normed_path.split(".")?.[0], prop);
                const first_access = normed_path.split('.')[0];
                //For Getter
                if (this.options.__fn_g_depends?.has?.(first_access)) { sub_depend.push(...this.options.__fn_g_depends.get(first_access)) }
                return normed_path
            }
            const [prop_res, replace_name,] = this.isInReplaceMap(prop) ?? [];
            if (prop_res) {
                // remove generic index # e.g. list[#i] => list[i] 
                const param_dflt = replace_name.replaceAll(/#[^\s#\[\]]+/g, (m) => { m = m.slice(1); idx.add(m); return m })
                const mod = defaultParam(prop_res, param_dflt)
                if (replace_name[0] !== '#') { p_defaults.set(mod[0], mod[1]) }
                //was a rename like i=#j or my_idx=#my_idx1
                else if (prop_res !== replace_name.slice(1)) {
                    idx_rename.set(prop_res, replace_name.slice(1))
                }
            
                /** always inject html in params, but never use it as dependency */
                if(prop==='html'){ return false};

                return replace_name;
            }
        }).filter(Boolean);

        //Find getters
        for(const prop_or_replacArr of parsed_sub_dep){
            const prop = Array.isArray( prop_or_replacArr)?prop_or_replacArr[1]:prop_or_replacArr;
            //if getter, check the subdependencies
            const first_access =    prop.split('.')[prop.startsWith("constructor")?2:0];
            if (first_access && this.options.__fn_g_depends?.has?.(first_access)) {
                parsed_sub_dep.push(...this.options.__fn_g_depends.get(first_access));
            }
        }

        //For Funtctions
        for (const fn_name of class_fns) {
            let normed_fn = getNormalisedPath(fn_name);
            const [prop_res, replace_name,] = this.isInReplaceMap(normed_fn) ?? [];
            if (replace_name) {
                const param_dflt = replace_name.replaceAll(/#[^\s#\[\]]+/g, (m) => { m = m.slice(1); idx.add(m); return m })
                const mod = defaultParam(prop_res, param_dflt)
                if (replace_name[0] !== '#') p_defaults.set(mod[0], mod[1]);
                normed_fn = replace_name;
            }
            const starts_this = normed_fn.startsWith("this."); 
            const first_access =(starts_this?normed_fn.slice(5) : normed_fn).split('.')[0];
            const in_fm_g_depends = this.options.__fn_g_depends?.has?.(first_access);
            //look for context
            const ctx_first_access = normed_fn.startsWith('constructor') ? normed_fn.split('.').slice(2).join("."): '';
            const ctx_in_fm_g_depends = ctx_first_access && this.options.__fn_g_depends?.has?.(ctx_first_access);

            if (!starts_this && prop_res === undefined && !in_fm_g_depends && !ctx_in_fm_g_depends ) continue;
            
            if (prop_res === undefined  && starts_this) { normed_fn = normed_fn.slice(5) }

            if (in_fm_g_depends) {
                parsed_sub_dep.push(...this.options.__fn_g_depends.get(first_access))
            }
            else if(ctx_in_fm_g_depends){
                parsed_sub_dep.push(...this.options.__fn_g_depends.get(ctx_first_access))
            }
            //If it is a expression also update it if you have a starting this.
            else if (fun_as_exp && starts_this) {
                parsed_sub_dep.push('this');
            }
        }

        parsed_sub_dep = [...new Set(parsed_sub_dep)];
        sub_depend.push(...parsed_sub_dep);

        if (!make_param_str) return;
        const str=this.StrfromParams(param_builder)
        return str;
    }
    StrfromParams(param_builder = new ParamBuild()) {
        const { default: p_dflt, idx, idx_rename } = param_builder;
        const any_idx = idx.size > 0;
        const any_param = p_dflt.size > 0;
        p_dflt.delete("this")
        if (!any_idx && !any_param) return "";

        const param_str = `{${any_idx ? '\n\t' : ''}${[...idx].map(i => `${i}=0`).join(",\n\t") + [...idx_rename].map(([name, dflt]) => `,\n\t${name}=${dflt}`).join("")}${any_idx && any_param ? ',' : ''}\n\t${any_param ? "_ele=this,\n\t" + [...p_dflt].map(([name, dflt]) => `${name}=_ele.${toJSPath(dflt.split("."))}`).join(",\n\t") : ''}\n}={}`
        return param_str
    }
     /**for manually created Templates, where no default values where given, auto insert a 0th textNode or splits the last on\
     * true means, you can continue normally, false means, no textNode was inserted and you should continue*/
     handleEmptyTextNode(element, sync_desc=element.getAttribute('SYNC'), debug_help = "") {
        //Insert always a first textNode for all elements with  any sync
        if (element.childNodes.length === 0) { element.append(new Text('')); }
        
        
         let largest = sync_desc.matchAll(/#(\d+)/g).reduce((max, { 1: num_str }) => num_str > max ? num_str << 0 : max, -1)
        //No text nodes
        if(largest===-1)return;
        
        
        if (element.childNodes.length>largest) { return true }

        const {auto_split_textNodes,auto_split_regex,auto_split_grp_to_last:keep_grp}=this.options
        //Split last TextNode after at N whitespaces
        if (auto_split_textNodes && element.lastChild?.nodeType === Node.TEXT_NODE) {
            /** Finds largest textNode index in element sync  e.g. "#2#4 #3 #0" => 4 */
            // const keep_grp = auto_split_grp_to_last;
            let lastIndex = element.childNodes.length - 1;
            /**@type {Text}*/let node = element.lastChild;
            let _m;
            while (lastIndex++ < largest + 1 && (_m = node.data.match(auto_split_regex))) {
                const mod = keep_grp && _m[1] ? _m[0].length - _m[1].length : 0;
                node = node.splitText(_m.index + mod);
                if (_m[0].length > 0) { node.data = node.data.slice(_m[0].length - mod) }

            }
            if (element.childNodes.length > largest) return true;
            //Just split the last text node, until enough are there
            while(element.childNodes.length<=largest){
                node=node.splitText(node.data.length);
                node.data=" ";
            }
            return true;
        }

        console.warn(`Index out of Range: You potentialy refer to a textnode that does node exist${debug_help ? ' at syncing:' + debug_help : ''}.
If you used a the auto_split_regex option, your regex does not split Template as you expected.\nAt index ${largest ?? textNodeIndex} on element\n%o`, element)
        
        return false;
    }
    /**Handles empty text nodes recursivly */
    handleAllEmptyTextNode(element){
        const ele_to_visit = new Queue(element);
        /**@type {HofElement }*/let visited_ele;
        while(visited_ele=ele_to_visit.dequeue){
            if(visited_ele.hasAttribute("SYNC"))this.handleEmptyTextNode(visited_ele);
            ele_to_visit.enqueueHeadAll(...visited_ele.children);
        }
    }   
}
function ellipsis(str, max_len = 10) {
    return str.slice(0, max_len) + (str.length > max_len ? ' ... ' : '')
}

//No [ 1 ]
//const simple_prop_re = /^\s*([$_\p{IDS}][\p{IDC}]*)\s*(?:\??\s*\.\s*[$_\p{IDS}][\p{IDC}]*\s*)*$/mu;
const simple_prop_re = /^\s*([$#_\p{IDS}][\p{IDC}]*)\s*(?:(?:\??\s*\.\s*(?:[$#_\p{IDS}][\p{IDC}]*|\[\s*\d+\s*\])|\[\s*\d+\s*\])\s*)*$/su;
// const any_this_g = /\bthis\s*(?:\??\s*\.\s*[$_\p{IDS}][\p{IDC}]*\s*?)+/mug;
// const simple_prop_re = /^\s*this\s*(?:\??\s*\.\s*[$_\p{IDS}][\p{IDC}]*\s*|\s*\[\s*(?:i\d?|\d*|0x[A-Za-z]+|0b[01]+|(?:(?<str>['"`])[^\[\]]*?\k<str>))\s*\]\s*)+$/mu;
const any_this_g = /\[\s*i\s*\]|\bthis\s*(?:\??\s*(?:\.\s*[$_\p{IDS}][\p{IDC}]*|\s*\[\s*(?:i\d?|\d*|0x[A-Za-z]+|0b[01]+|(?:(?<str>['"`])[^\[\]]*?\k<str>))\s*\])\s*?)+/mug;

