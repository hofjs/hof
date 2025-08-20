import {  escapeRegExp, Queue } from "./helper.js";
import { new_js_parser, Token } from "./ScopeParser.js";

class ParamDesc {
    name = "";
    default = undefined;
    //For destrcutured params
    pos = undefined;
    rest = false;
    constructor(name, defaultVal, rest, pos, destr_type) { this.name = name; this.default = defaultVal; if (rest) this.rest = rest; if (pos) this.pos = pos; this.destr_type = destr_type }
    toString(pad = 10) {
        return Object.entries(this).map(
            ([key, val]) => `  ${key}:${(val + "").padStart(pad)}`
        ).join(";")
    }

}
/**Single param lambdas. They have no parenthesis and so neither a second param, restparams or defaultvalues and are, as all lambas, never generator functions.\
This makes it easy to extract the param name, just match the first =>, thats only preceded by one word and a optional async before.\
But they could have a async before their parameter.\
Examples    x=> 67+4*x  async z => {...}
*/
const single_param_lambda_re = /^(?:async\s+)?([^() ]+)\s*=>/;

/**
 * @param {Function|string} func 
 * @returns {ParamDesc[]} */
export function extractParams(func) {
    const fn_str = (typeof func === 'string') ? func : func.toString();
    if (fn_str === "") { const res = []; res.length_lv0 = 0; return res; }

    let _m;
    if (_m = fn_str.match(single_param_lambda_re)) {
        return [new ParamDesc(_m[1], undefined, false, [0])]
    }
    //For normal functions and for lambas with parethesis use the token-scope-parser and search or the first Parenthesis scope
    const brace_scope_res = new_js_parser.parseUntil(fn_str, 'Brace');
    /**@type {Token} */
    const brace_scope = brace_scope_res.found;

    if (!brace_scope) { const res = []; res.length_lv0 = 0; return res; }


    /** @type {ParamDesc[]}*/const paramDescs = [];
    const param_nr_lv0 = ExtractNamesFromToken(brace_scope, paramDescs, 0)
    paramDescs.length_lv0 = param_nr_lv0;
    return paramDescs;
}

function ExtractNamesFromToken(/** @type {Token}*/scope, paramDescs, level = 0, pos, type) {
    let paramNr = 0;
    let last_trailling_default = false;
    let is_nested_destr = false;
    let nested_destr_name;
    let _m;
    for (const token of scope) {
        if (token.type === 'Text') {
            const token_txt = token.toString();
            const has_comma = token_txt.includes(',');
            let params = token_txt.split(',');
            let index = 0;
            for (const param of params) {
                if (last_trailling_default) {
                    //In case there is no default yet
                    if (paramDescs.at(-1).default === undefined && (_m = param.match(/\s*=\s*(.*)/s))) {
                        paramDescs.at(-1).default = _m[1]
                    }
                    else {
                        paramDescs.at(-1).default += param.trim();
                    }

                    if (has_comma) last_trailling_default = false;
                    index++;
                    continue
                }
                _m = param.match(/^\s*(?<rest>\.\.\.\s*)?(?:(?<re_name>[$_\p{IDS}][\p{IDC}]*)\s*:\s*)?(?<name>[$_\p{IDS}][\p{IDC}]*)\s*(?:(\s*=\s*(?<defaultVal>\S*))|(?<endcolon>\s*:))?/su)
                index++;
                if (!_m || !_m?.groups?.name) { continue }
                let { re_name, name, defaultVal = undefined, rest, endcolon } = _m?.groups;
                is_nested_destr = endcolon && type == 'crlBrace';
                const next_pos_entry = re_name ? paramNr + "|" + re_name : paramNr;
                const new_pos = pos ? [...pos, next_pos_entry] : [next_pos_entry];
                if (is_nested_destr) { nested_destr_name = name; continue }
                paramDescs.push(new ParamDesc(name, defaultVal, rest !== undefined, new_pos, level > 0 ? type : undefined));
                paramNr++;
                //In case default value is scope itself, mark that you thad a = with no value
                if (index === params.length && !is_nested_destr) last_trailling_default = true;
            }
        }
        //Just give to toString as default
        else if (last_trailling_default) {
            /*Ignore commetns */
            if (token.type.includes('Com')) { continue }
            if (paramDescs.at(-1).default) {
                paramDescs.at(-1).default += token.toString();
            }
            else { paramDescs.at(-1).default = token.toString(); }
        }
        //token is a scope itself, with curly braces its destructuring
        else if (token.type == 'crlBrace' || token.type == 'sqBrace') {

            ExtractNamesFromToken(token, paramDescs, level + 1, [...(pos ?? []), paramNr + (nested_destr_name ? "|" + nested_destr_name : 0)], token.type);
            // last_trailling_default=true;
            paramNr++
        }

    }
    return paramNr;
}
/**
 * Extracts the parameter and Body String of a function 
 * @param {Function|string} func 
 * @returns {[params:string,body:string,has_curly:boolean]}*/
export function extractParamsAndBody(func, trim = true) {
    const fn_str = (typeof func === 'string') ? func : func.toString();
    if (fn_str === "") { return ['', '', false]; }
    /**Tells you, if the body of the fn has a enclsing curly Brace. for lambdas this is intresting if you want to recreate them via new Function */
    let has_curly = true;
    let _m;
    if (_m = fn_str.match(single_param_lambda_re)) {
        const arrow_i = fn_str.indexOf("=>");
        let body_str = fn_str.slice(arrow_i + 2);
        has_curly = /\s*\{/.test(body_str);
        //Replace potential a curly Brace
        body_str = body_str.replaceAll(/^\s*\{|}\s*$/g, "")
        if (trim) { body_str = body_str.trimEnd() }
        return [_m[1], body_str, has_curly]
    }
    let tree = new_js_parser.parse(fn_str);

    let param_str;
    let body_str;
    let arrow_i;
    let current_len = 0;
    for (const token of tree) {
        const is_str = token.type === 'Text';
        const as_str = token.toString();
        current_len += as_str.length;

        if (param_str === undefined) {
            if (token.type == "Brace" && token.is_closed) {
                param_str = as_str.slice(1, -1);
                if (trim) { param_str = param_str.trim() }
            }
        }
        else if (token.type == "crlBrace" && token.is_closed) {
            body_str = as_str.slice(1, -1);;
            if (trim) { body_str = body_str.trim() }
            break
        }
        else if (is_str && (arrow_i = token.toString().indexOf('=>')) > -1) {
            body_str = fn_str.slice(current_len - as_str.length + arrow_i + 2);
            has_curly = /\s*\{/.test(body_str);
            //Replace potential a curly Brace
            body_str = body_str.replaceAll(/^\s*\{|}\s*$/g, "")
            if (trim) { body_str = body_str.trimEnd() }
            break
        }
    }

    return [param_str ?? "", body_str ?? "", has_curly];
}

/** @param {Function|string} func  */
export function isLambdaFunction(func) {
    const body = (typeof func === 'string') ? func : func.toString();
    if (body === "") { return false }
    if (single_param_lambda_re.test(body)) { return true }

    const res = new_js_parser.parseUntil(body, 'Brace');
    if (!res.found) { return false }

    if (/^\s*=>/.test(res.tree.rest_txt)) { return true }

    return false;
}


const js_var_re = /[_$\p{IDS}][_$\p{IDC}]*(?:\s*\??\s*\.\s*(?:[_$\p{IDS}][_$\p{IDC}]*|\[\s*\d+\s*\]))*/sugd;
export function parseAllVars(string = "", { only_class_var = false, class_fns = false } = {}, tree) {
    if (!string) { let res = []; res.class_fns = []; return res }

    if (!tree) {

        tree = new_js_parser.parse(string);
    }
    if (only_class_var) {
        //only use first brace which is class NAME extends sss  {  ... }<-- only this 
        tree = tree.sub.find(sub_tok => /crlBrace/i.test(sub_tok.type));
    }
    let allNames = [];

    //Simple addon for class function extended dependency parsing
    const class_fns_arr = [];

    let queue = new Queue(...tree);
    let max_iter = 10000;
    let token;
    while ((token = queue.dequeue) && (max_iter-- > 0)) {
        if (/tString/.test(token.type)) {
            queue.enqueueHeadAll(...token.sub.filter(sub_tok => /tExp/i.test(sub_tok.type)));
            continue
        }
        if (/String|Comment|Regex/.test(token.type)) {
            continue;
        }

        if (token.type!=='Text') {
            //Don't go depper if you only search for class vars
            if (only_class_var) continue;

            queue.enqueueHeadAll(...token);
        }
        else if (!only_class_var) {
            const token_str=token.value;
            let _m = [...token_str.matchAll(js_var_re)];
            if (_m.length == 0) continue;
            const last_index = _m.at(-1).indices[0][1];
            _m = _m.map(x => x[0]).filter(x => !/^(?:return|async|await|catch|try|import|typeof|if|else|new|let|const|Number|String|Boolean|Math|JSON|BigInt|Date|Array)$/.test(x));

            // look if the rest str after last match could be continud with [] or ()
            if (token_str.slice(last_index).match(/\s*(\?\s*\.\s*)?$/u)) {
                let n_peeked = 0;
                let next_token;
                do { next_token = queue.peekN(n_peeked++); } while (isComOrWH(next_token));
                if (next_token && /SqBrace/i.test(next_token.type)) {
                    let sqbrace_path_tokens = new Queue(...next_token);
                    let sqbrace_token;
                    let sqbr_str;
                    let vaild_accessor = true;
                    while (vaild_accessor) {
                        sqbrace_token = sqbrace_path_tokens.dequeue
                        //Try to use the next token  on same level after this brace. Needed for trailling Paths like user.[0].name or sequencial Array Accesses like arr [0] [3] ...  
                        if (sqbrace_token === undefined) {
                            _m[_m.length - 1] += '.' + sqbr_str;
                            let next_Nth_token
                            let full_continuation_path = false;
                            do {
                                next_Nth_token = queue.peekN(n_peeked++);
                                full_continuation_path = false;
                                if (next_Nth_token?.type === 'Text') {
                                    const next_Nth_token_str=next_Nth_token.value;
                                    let _match = next_Nth_token_str.match(/^(?:\s*\??\s*\.\s*[_$\p{IDS}][\p{IDC}]*)+/us)
                                    const path_continue = _match?.[0]?.trim?.();
                                    if (path_continue) {
                                        _m[_m.length - 1] += path_continue;
                                        //If the continuation Path goes only has a trailling WS, try match next SqBrace Token like user[0].name[6].length ...
                                        const rest = next_Nth_token_str.slice(_match?.[0].length);
                                        full_continuation_path = /^\s*$/.test(rest);
                                        if (!full_continuation_path) {
                                            queue.setInternalMapOffset(n_peeked - 1, rest);
                                        }
                                    }
                                }
                            }
                            while (full_continuation_path || isComOrWH(next_Nth_token));
                            if (next_Nth_token == undefined || !/SqBrace/.test(next_Nth_token.type)) {
                                //Remove the already used peeled Tokens from the global Queue 
                                queue.dequeueN(n_peeked - 1);
                                break;
                            }
                            sqbrace_path_tokens.enqueueAll(...next_Nth_token);
                            sqbr_str = "";
                            continue;
                        }
                        if (/Comment/.test(sqbrace_token.type)) { continue }
                        if (!sqbr_str && /[^T]String/i.test(sqbrace_token.type)) {
                            sqbr_str = sqbrace_token.toString(false).slice(1, -1);
                            continue
                        }
                        else if (sqbrace_token?.type === 'Text') {
                            let _m;
                            const sqbrace_token_str=sqbrace_token.value;
                            if (!sqbr_str && (_m = sqbrace_token_str.match(/\s*(\d+)\s*/))) {
                                sqbr_str = _m[1];
                                continue
                            }
                            // Allow Whitespace
                            if (/^\s*$/.test(sqbrace_token_str)) { continue }
                        }
                        //For other tokens
                        vaild_accessor = false;
                        break;
                    }
                }
                // was a function like this.date.toLocalString( ... ), remove the last name, cause its fn
                if (_m.length && next_token && /^Brace/i.test(next_token.type)) {
                    const fn_call_str = _m[_m.length - 1];
                    const fn_call_path = fn_call_str.split('.');
                    const without_fn = fn_call_path.slice(0, -1).join('.');
                    if (class_fns && fn_call_path.length <= 2) { class_fns_arr.push(fn_call_str) };
                    if (without_fn && !/^\s*this\s*\??\s*$/.test(without_fn)) _m[_m.length - 1] = without_fn;
                    else {
                        _m.pop();
                    }
                }
            }
            allNames.push(..._m);
        }
        else {
            const token_str=token.value;
            const pre_equals = token_str.split(/;|\n|\r\n/).filter(x => x !== "" && !x.match(/^\s*static/)).map(sub_str => sub_str.match(/([^+=: ]+)\s*(?:=|:)/)?.[1]).filter(Boolean);
            const not_def = token_str.match(/[_$\p{IDS}][\p{IDC}]*(?=\s*;)/gu);
            if (not_def) pre_equals.push(...not_def);
            for (const pre_equal of pre_equals) {
                let _m = pre_equal.match(js_var_re) ?? [];
                allNames.push(..._m);
            }
        }
    }
    allNames = [...new Set(allNames)];
    if (class_fns) { allNames.class_fns = [...new Set(class_fns_arr)]; }
    return allNames;
}
/** Test if a Token is a Commetn or Empty Whitespace. */
function isComOrWH(token) {
    return token && (token.type === 'Text' && /^\s*$/.test(token.value) || /Comment/.test(token.type));
}

const path_split = /\s*(?:\?\s*)?\.|(?:\s*\?\s*)?(?=\[)/;
/**Retruns for a js path like user.age[0]?.['aaa'] a simplified standart, without any ? or [] 
 * ```
 * getNormalisedPath("user  ?.friends  .  age   [67]  ?. [7] ?.  [  'orc'  ] ")
 * // -> 'user.friends.age.67.7.orc'
 * ```
*/
export function getNormalisedPath(js_prop = "") {
    const splitted = js_prop.split(path_split);
    return splitted.filter(x => /\S/.test(x)).map(path => {
        path = path.replaceAll("?", "");
        let trimed = path.trim();
        //Remove [] and potential ''
        if (trimed.startsWith('[')) trimed = trimed.slice(1, -1).trim();
        if (/^['"`]/.test(trimed)) trimed = trimed.slice(1, -1);
        return trimed;
    }).join('.');
}
const is_number_re = /^\s*\d/
/**
 * Gets a normalised path like ['user','names','5'] and makes a vaild JS path of it 'user.names[5]'
 * 
 * @param {String[]} normed_path 
 * @param {boolean} [leading_combine=false] if you should start with a leading '.' for non numeric paths like ['user','age'] => false:  'user.age' ; true:  '.user.age'
 */
export function toJSPath(normed_path, leading_combine = false) {
    let res = leading_combine ? "" : is_number_re.test(normed_path[0]) ? `[${normed_path[0]}]` : normed_path[0];
    for (let i = leading_combine ? 0 : 1; i < normed_path.length; i++) {
        res += is_number_re.test(normed_path[i]) ? `[${normed_path[i]}]` : "." + normed_path[i];
    }
    return res;
}


/**
 * 
 * @typedef {{prop:String,lambda:string[],params:any[],non_simple_map:boolean}} EnclosingLambda
 * @param {string} string 
 * @param {(token) => boolean} __isHTMLTString 
 * @param {(token,token,EnclosingLambda) => boolean} __isAutoList 
 * @param {Token} tree 
 * @typedef {{strs:string[],exps:string[],is_root:boolean,enclosing_exp:string[]|null,enclosing_lambda:EnclosingLambda|null,is_array:boolean,parent_index:number|undefined,parent_exp_nr:number|undefined}} ParsedHTMLExp -- like `ParsedTemplateSting`, but more internal information
 * @returns {ParsedHTMLExp[]}  
 */
export function parseAllHTMLs(string = "",__isHTMLTString ,__isAutoList,tree) {
    if (!string) return [];

    if (!tree) {
        tree = new_js_parser.parse(string,);
    }
    const all_htmls = [];

    let max_iter = 10000;
    let token = tree;
    //enqueueHeadAll goes inorder over the tree
    let enclosing_exp = null;
    while (token = token.next) {
        if (max_iter-- == 0) { break };

        if (/tExp/i.test(token.type)) {
            enclosing_exp = token;
        }
        if (/tString/i.test(token.type) && __isHTMLTString(token)) {
            if(token.depth<=enclosing_exp?.depth){
                enclosing_exp=null
            }
            // const enclosing_str = enclosing_exp?.innerStr?.();
            let enclosing_str;
            let parentTExp=token;
            let max = 100;
            //index of ${} in parent
            let parent_exp_nr;
            while( parentTExp.parent && max-->0){
                parentTExp= parentTExp.parent;
                if(parentTExp.type==='tExp'){
                    const tString = parentTExp.parent;
                    parent_exp_nr = tString.sub.filter(subtoken=>subtoken.type==='tExp').findIndex( subtoken=>subtoken===parentTExp );
                    enclosing_str = parentTExp.innerStr();
                    enclosing_exp = parentTExp;
                    break;
                }
            }       
            
            //Index in Result                  
            const parent_index = enclosing_str && all_htmls.findIndex(({ exps }) => {
                parent_exp_nr = exps.indexOf(enclosing_str);
                return parent_exp_nr !== -1;
            })

            const enclosing_lambda = enclosing_exp && findMapInExp(enclosing_exp);
            const strs_exps = tokenToParsedObj(token);
            const is_array = __isAutoList(token,enclosing_exp,enclosing_lambda);
            /**@type {ParsedHTMLExp} */
            const res = {
                strs: strs_exps.strs, exps: strs_exps.exps,
                is_root: /(?<=([^\.]template\s*(:[^=]+)?=\s*(\w+\s*=>)?\s*((\w)+?\.)?\s*html\s*))/m.test(token.prev.value),
                enclosing_exp,
                enclosing_lambda,
                is_array,
                parent_index,
                parent_exp_nr,
            }
            all_htmls.push(res);
        }

    }

    return all_htmls;
}
const lose_js_map = /([\w$\[\]'"`]+(?:\s*(\?\s*)?\.\s*[\w$\[\]'"`]+)*)\s*(\?\s*)?\.\s*map\s*(\?\s*\.\s*)?$/;
/**find the first occourance of arr.map( ... ) in a Tree*/
export function findMapInExp(exp_tree, max_depth = 100) {
    const map = { prop: "", lambda: "",non_simple_map:false };
    let i = 0;
    let found_map = false;
    for (const sub_tok of exp_tree) {
        i++;
        if (/[^T]String|Comment|Regex/i.test(sub_tok.type)) { continue; }
        if (!found_map) {
            let _m;
            if (sub_tok.type==='Text') {
                if(_m = sub_tok.value.match(lose_js_map)){
                    map.prop = _m[1].replaceAll(/\?|\s/g, "");
                    found_map = true;
                }
                // found a any .map array
                else if(_m = sub_tok.value.match(/\.\s*map\s*(\?\s*\.\s*)?$/)){
                    /** @type {string} */
                    const value = exp_tree.value
                    const _m_start =  value.match(new RegExp(escapeRegExp(_m[0])));
                    map.non_simple_map= true;
                    if(_m_start)map.prop= value.slice(2,_m_start.index); // from the '${' to .map
                    found_map = true;
                }
            }
        }
        else if (/^Brace/i.test(sub_tok.type)) {
            map.lambda = sub_tok;
            /* remove potential doble Brace */
            if(sub_tok.sub.length==1 && /^Brace/i.test(sub_tok.sub[0].type)){
                map.lambda = sub_tok.sub[0];
            }

            found_map = false;
            return map;
        }
    }
    return null;
}


export class ParsedTemplateSting {
    /**@type {String[]} */
    strs = [];
    /**@type {String[]} */
    exps = [];
    is_root = false;
    is_array = false;
    arr_root_def = "";
    parent_exp_nr = 0;
    parent_index = 0;
}

/**This extracts the Template string expressions via a Scope-Parser
 * Trailling start and ends are allowed, as long as there is no Scope parser block
 * @param {string} js_str a string that starts with a js   \`\`-str like  " \` AA ${45} BB \` "
 * @param {boolean} [tmp_exp_form=false] specifies if you get a scope parser array token (default) or a obj with seperate strs exps like  {strs:[],exps:[]}
 * @returns {ParsedTemplateSting}
 */
export function extractTemplateStringsParser(js_str, tmp_exp_form = true) {
    const parse_res = new_js_parser.parseUntil(js_str, "tString");
    /**@type {Token} */
    const tString = parse_res.found;
    if (tmp_exp_form) {
        return tokenToParsedObj(tString);
    }
    return tString;
}

/**Takes a TString Token and Converts it to a res obj. Converts exps to Strings and inserts empty str where neccessary, so that you have the from of a TemplateStringsArray  
 * @param {Token} tStr_token 
*/
function tokenToParsedObj(tStr_token) {
    const res = { strs: [], exps: [] }
    if (!tStr_token) return res;
    //To keep the balance, insert "" after two consecutive ${} or at start
    let last_is_exp = true;
    for (const part of tStr_token) {
        if (part.is_text_like) { res.strs.push(part.value); last_is_exp = false }
        //Also remove the  ${} around 
        else {
            res.exps.push(part.toString(false).slice(2, -1));
            if (last_is_exp) { res.strs.push("") };
            last_is_exp = true
        }
    }
    //TemplateStringsArray have a empty str after ending ${} `xxx ${2}`  -> ['xxx ',''] [2]
    if (res.strs.length == res.exps.length) { res.strs.push("") }
    return res;
}

//helper for testing of functions
// publish( extractParams, extractTemplateStringsParser, parseAllVars, parseAllHTMLs, getNormalisedPath, toJSPath, extractParamsAndBody, isLambdaFunction)