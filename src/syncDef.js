/**Here a classes that define how the SYNC attribute is constructed */

/**For creating the SYNC attr. Some props might sync with multipe attr,
 * to keep it compact, cache them here and after templated init create the sync attribute without redundancies */
export class SYNCList {
    prop_depends = new Map();
    registerProp(prop, subdepends = [], ...attrs) {
        let depends_list;
        if (depends_list = this.prop_depends.get(prop)) {
            depends_list.attrs.push(...attrs); return;
        }
        this.prop_depends.set(prop, { subdepends, attrs });
    }
    static registerOnElement(element, toSync, prop, subdepends = [], attr_names = []) {
        if (!element.__synclist) {
            element.__synclist = new SYNCList();
            toSync.add(element);
        }
        element.__synclist.registerProp(prop, subdepends, attr_names);
    }
    static coalesSubdepend(sp) {
        return '~.' + sp
    }
    static coalesProps([prop, { subdepends, attrs }]) {
        return `${prop[0] !== '#' ? '~.' + prop : prop}${subdepends.length ? ` { ${subdepends.map(
            SYNCList.coalesSubdepend).join(" ")} } ` : ""} ${attrs.map(attr => `${attr}`).join(" ")}`
    }
    /**Sequenc in which they are returned determines sequence in __applySync, value should be last */
    static getPrio(attrs){
        return attrs.findIndex(attr=>/value/.test(attr))===-1? 0:1;
    }
    toAttribute() {
        const sorted_depends=[...this.prop_depends]
            .map(p=>  {p[1].prio=SYNCList.getPrio( p[1].attrs); return p}  )
            .sort(  (a,b)=>a[1].prio -b[1].prio  )
        return sorted_depends.map(SYNCList.coalesProps).join(' | ')
    }
    get size() { return this.prop_depends.size }
}


export class Dependencies {
    /**@type {{textNode:Text,getter_key:string}[]} */
    simplePropertyTextNodes = [];
    /**@type {{element:HTMLElement,attr:string,getter_key:string}[] } */
    simplePropertyAttributes = [];

    // simplePropertyInnerHTML=[];

    /**@type {{textNode:Text,recalc:Function,params_fix:any,}[] } */
    evaluatedTextNodes = [];
    /**@type {{element:HTMLElement,attr:string,recalc:Function,params_fix:any,}[]}} */
    evaluatedAttributes = [];


}

/**For Nested Generic Counters. */
export class CounterContext {
    named_counter = new Map();
    base_path = "";
    implicit_counters = [];
    own_indices = [];
    /**Creates a new CounterContext, it starts at 0, if you give a parent Context, it will be integrate in the COunter, so that on Array Recalc the correct genric Indices can be inserted */
    constructor(indices, base_path, other_counter, new_implicite = false) {
        if (other_counter) {
            for (const [key, val] of other_counter.named_counter.entries()) {
                this.named_counter.set(key, val);
            }
            this.implicit_counters = [...other_counter.implicit_counters, 0];
        }
        if (new_implicite) {
            this.implicit_counters.push(0);
        }
        const start = 0;
        for (const index of indices) {
            this.named_counter.set(index, start);
            this.own_indices.push(index);
        }
        this.base_path = base_path;
    }
    /**Returns a CounterContext where all counters are increased with the specifeid amount */
    getIncCounter(add_nr) {
        const inc_counter = new CounterContext(this.own_indices, this.base_path);
        //Copies all including the inherited
        for (const [key, val] of this.named_counter.entries()) {
            inc_counter.named_counter.set(key, val);
        }
        //Copies own index, and then increments them
        for (const index of this.own_indices) {
            inc_counter.named_counter.set(index, this.named_counter.get(index) + add_nr);
        }
        //Incremetn the last implicite one
        inc_counter.implicit_counters = [...this.implicit_counters];
        inc_counter.implicit_counters[inc_counter.implicit_counters.length - 1] = this.implicit_counters.at(-1) + add_nr;
        return inc_counter
    }

    fillGeneric(prop = "", param_idx) {
        let res = "";

        //makes "persons[#index].friends[#f_ind]"  =>  [ "persons[",  "#index",  "].friends[", "#f_ind", "]"]
        const splitted = prop.split(/(#[^\s\[\]]+)/g).filter(Boolean);
        let i = -1;
        let implicit_i = 0;
        let last_index;
        const is_relativ= prop[0]=="[";
        const last_implicite = this.implicit_counters[this.implicit_counters.length-1];

        //you use counter from right -> for potential infer from base
        // let amount_counters = 0;
        // let has_dups = false;
        // let dups = new Set();
        // for (const part of splitted) {
        //     if (part.startsWith("#")) {
        //         if (dups.has(part)) { has_dups=true};
        //         dups.add(part);
        //         amount_counters++;
        //     }
        // }
        // let implicit_start =has_dups? this.implicit_counters.length - amount_counters:0;
        let implicit_start =0;

        for (const part of splitted) {
            i++;
            //No genreic, just normal value
            if (!part.startsWith("#")) { res += part; continue }
            //last was array use implicite
            // if (has_dups&& splitted[i - 1]?.endsWith?.("[")) {
            //     last_index = this.implicit_counters[implicit_start + implicit_i];
            // }
            // for single generic default indices. also use last implicite
            //IMPROVE: causes problems on nested arrs witout given index 
            // else if (part === '#i') {
            //     last_index = this.implicit_counters.at(-1);
            // }
            // else {
            const replace = this.named_counter.get(part);
            last_index = replace ??  (is_relativ?last_implicite  :this.implicit_counters[implicit_start + implicit_i]);
            // }
            res += last_index;
            param_idx[part.slice(1)] = last_index;
            implicit_i++;
        }
        if (splitted.length === 1 && implicit_i === 1) {
            param_idx.__genric_Idx = last_index;
        }
        //Replace all [] , cause syncing needs  array.42 instead of array[42]
        res = res.replaceAll("[", ".").replaceAll("]", "");
        //Include base for generic [#i] uses
        if(is_relativ){res=this.base_path+res }
        return res;
    }
    /** retruns a object, that can be given as param to a exp ${}, so that the correct element is selected */
    toParamObj(check = true) {
        const res = {};
        //You use always default index #i,
        if (check && this.named_counter.size < this.implicit_counters.length) {
            console.warn(`You use some default index #i in nested   .map( x => html \`\` ). Use a named index in .map, so that you avoid potential collisions. Especially the Array can be omitted or replaced via the original \${}`);

        }
        for (const [key, val] of this.named_counter.entries()) { res[key.slice(1)] = val }
        return res;
    }
}
export function defaultParam(param_name, default_path) {
    let first_dot = param_name.indexOf(".");
    const param_root = param_name.slice(0, first_dot !== -1 ? first_dot : undefined);
    const tail = param_name.slice(first_dot); // .adress.loc

    const param_path = (first_dot !== -1 ? default_path.replace(tail, "") : default_path);
    return [param_root, param_path]
}


/**A object that holds infos how to recalc a certain syncing */
export class SyncDesc {
    static attr_filter = ['tagName',];

    // static split= /\s+/;

    /* Would allow to trim some space and use inline attr def
     at \s , : or before and after {}, so that "aaa{bb,cc}:dd,ee  {df:dg}" => ['aaa', '{', 'bb', 'cc', '}', 'dd', 'ee', '{', 'df', 'dg',  '}'] */
    static split = /\s+|,|:|(?=\{|\})|(?<=\{|\})/;

    static infer(sync_desc = "", element, generic_map, options) {
        let [prop, ...attrs] = sync_desc.split(SyncDesc.split).filter(x => x);
        let subdepends = [];
        const textNodeIndices = [];
        let recalc_type = "property";
        let arr_index_name = undefined;
        let only_init = false;
        let generic_value = undefined;
        const params_fix = {};
        if (attrs[0] === '{') {
            const end = attrs.slice(1).findIndex(x => x === '}');
            subdepends = attrs.slice(1, end + 1).map(sub_dpd => {
                let path = sub_dpd;
                if (path.startsWith("~.")) path = path.slice(2);

                const use_generic_accesor = /\[#[^[\] -]*\]/i.test(path);
                const use_generic_index = /^#[^[\] -]*$/i.test(path);
                if (use_generic_accesor || use_generic_index) {
                    path = SyncDesc.inferGenric(element, generic_map, path, params_fix);
                }
                if (use_generic_index) {
                    return undefined;//Index is no dependency
                }
                return path;
            }).filter(Boolean);
            attrs = attrs.slice(end + 2);
        }
        for (const attr of attrs) {
            if (attr.includes("#")) {
                const [name, pos] = attr.split("#");
                textNodeIndices.push(parseInt(pos) || 0);
            }
        }
        //Remove textnodes from attrbiutes
        attrs = attrs.filter(x => !x.startsWith("#") && !SyncDesc.attr_filter.includes(x))
        if (prop.startsWith("~.")) {
            recalc_type = "property";
            only_init = false;
            prop = prop.slice(2);
        }
        else if (/^#EXP/i.test(prop)) { recalc_type = "expression"; only_init = false; }
        else if (/^#FUN/i.test(prop)) {
            recalc_type = "function";
        }

        if (/\[\]/i.test(prop)) {
            recalc_type = 'array';
            [prop, arr_index_name] = prop.split("[]");
        }

        //Insert generic #i for Arrays
        const use_generic_accesor = /\[#[^[\] -]*\]/i.test(prop);
        const use_generic_index = /^#[^[\] -]*$/i.test(prop);
        if (use_generic_accesor || use_generic_index) {
            prop = SyncDesc.inferGenric(element, generic_map, prop, params_fix);
            if (use_generic_index) {
                only_init = true;
                generic_value = params_fix.__genric_Idx;
            }
        }

        //Default values if no attr| textNode was given
        if (attrs.length == 0 && textNodeIndices.length == 0) {
            if (options.dynamic_html_default) {
                attrs.push('innerHTML')
            }
            else {
                textNodeIndices.push(0)
            }
        }
        //Special Case textarea with inner HTML, the Textnodes change on .value set so you need to use .value instead of firest textNode , therefore it's also not recommended to use here multiple TextNodes
        if (element.localName === "textarea" && textNodeIndices.length === 1 && !attrs.includes("value")) {
            textNodeIndices.splice(0);
            attrs.push("value");
        }
        if (element?.hasAttribute?.("contenteditable") && element.getAttribute("contenteditable")!=="false" && textNodeIndices.length === 1) {
            textNodeIndices.splice(0);
            attrs.push("innerHTML");
        }

        return { prop, recalc_type, attrs, subdepends, textNodeIndices, only_init, generic_value,  params_fix, arr_index_name };
    }

    /**
     * @param {HTMLElement} element 
     * @param {Map<HTMLElement,CounterContext>} generic_map 
     * @returns { {index:number,prop:string} }
     */
    static inferGenric(element, generic_map, prop, param_idx, geric_key = '__i') {
        const counterContext = generic_map.get(element);
        if (!counterContext) {
            param_idx['i'] = Array.prototype.indexOf.call(element?.parentElement?.children ?? [], element);
            return prop;
        }
        return counterContext.fillGeneric(prop, param_idx);
    }
}
