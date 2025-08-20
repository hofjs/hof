/**A Refactored Scope Parser */
import { escapeRegExp } from "./helper.js";

export class Token {
    /**@param {Token}args*/ constructor(args) {
        Object.assign(this, args);
    }
    static dlft_types=['Root','Text','Brace','crlBrace','sqBrace','muComment','lnComment','sString','dString','tString','tExp','Regex']
    /**@type {'Root'|'Text'|'Brace'|'crlBrace'|'sqBrace'|'muComment'|'lnComment'|'sString'|'dString'|'tString'|'tExp'|'Regex'}*/
    type;

    /**How deep this Token is nested */
    depth = -1;

    get value() {
        if (this.is_text_like) { return this.#value??'' }
        return this.start + this.sub.map(sub => sub.value).join('') + (this.end??'');
    }
    /**@type {String} */
    set value(v = "") { this.#value = v }

    /**If this Token should behave as never having any sub-Token (like a Text Token)  */
    get is_text_like() { return this.start === undefined }

    /**A Array of all subtokens @type {Token[]}*/
    sub = [];

    /**@type {String} shows concrete String detected as start in case Regex was used in a Scope*/
    start;
    /**@type {String} shows concrete String detected as end in case Regex was used in a Scope*/
    end;

    /**Token Structure comes from sub Array. The Tokens form no linked List. 
     * The parent, next, prev refs are only here to allow convienient acces to next|prev|parent token. 
     */

    /**@type {Token}*/ parent;
    /**@type {Token}*/ next;
    /**@type {Token}*/ prev;
    
    /**this returns the token after this token in its parent, Opposed to next, which tries to go first to the children*/
    get after(){
        const idx_in_parent=this.parent?.sub?.findIndex?.((token)=>token===this); 
        return this.parent?.sub?.[idx_in_parent+1];
    }

    is_closed = false;

    #value;
    /**@type {String} Returns the same repräsentation as the corresponding fragment of initial txt*/
    toString() { return this.value }

    /**Gives you the String value of all your children 
     * analog to innerHTML
    */
    innerStr(){
        return this.sub.map(sub => sub.value).join('');
    }

    [Symbol.iterator](){
        let idx=0;
        return {
            next: () => ({ value: this.sub[idx++], done: idx>this.sub.length })
        };
    }

    /**@param {Token} token*/
    addChild(token) {
        if (this.sub.length) {
            let last_deep = this.sub[this.sub.length - 1];
            while (last_deep.sub[last_deep.sub.length - 1]) {
                last_deep = last_deep.sub[last_deep.sub.length - 1]
            }
            last_deep.next = token;
            token.prev = last_deep;
        }
        else {
            this.next = token;
            token.prev = this
        }
        this.sub.push(token);
        token.parent = this;
    }
}
class RootToken extends Token {
    /**@type {Token} */last_token;
    /**@type {String} */rest_text;
    /**@type {Scope[]} */stack;
}

/**A Token, that Signals if a Scope Start or end here */
export class ScopeMark {
    constructor(/**@type {ScopeMark}*/args) {
        Object.assign(this, args);
    }
    value;
    type = "";
    is_start = true;
    /**@type {Token} */
    for;
    depth = -1;
}

/**Infos needed once for Parseing, but not neccessary for every Token (like the RegExp and subscopes)  */
export class Scope {
    /**@param {Scope} args */ constructor(args) {
        Object.assign(this, args);
        //If your end is empty, you never need yourself
        if (this.end === "") {
            this.self = false;
        }
        const add_self = this.self && !this.sub_scopes.find(x => x == this)
        if (add_self) {
            this.sub_scopes.push(this);
        }
        if (this.esc === true) { this.esc = "\\" }
        this.re = this.reScopes();
    }

    /**@type {'Root'|'Text'|'Brace'|'crlBrace'|'sqBrace'|'muComment'|'lnComment'|'sString'|'dString'|'tString'|'tExp'|'Regex'}*/
    type;
    start = "";
    end = "";
    /**scope-end can be escaped, str|re uses given,  undefiend ^= false */
    esc;
    /**Allow self in scope like,  yes: "( ( 1 ) )"  no:" "+" " */
    self = true;
    /**If this Scope can be implicitly in a global Text Scope or not */
    global = true;

    /** @type {Scope[]}*/
    sub_scopes = [];
    /**Your Name used during toHTML() as attr 
     * @example
     * <span [this.cssName] ></span>
     */
    cssName = "";
    addSubScopes(...sub_scopes) {
        this.sub_scopes.push(...sub_scopes.filter(x => x !== this));
        this.re = this.reScopes();
    }
    /**@type {RegExp} */re;
    /**Takes a String or Regex and retruns a fitting String Repräasnetation, that can be used as a building block for creating new Regexe 
     * @example
     * //For Strings all regex Symbols will be Escaped
     * "(" >> "\("
     * //For Regex the enclosing '/' are removed
     * /<\w+\s*>/  >> "<\w+\s*>"
     * //Invalid Regex
     * new RegExp(  "(" + "|" + /<\w+\s*>/ )  // /(|/<\w+\s*>// 
     * //Works
     * new RegExp(  toRePart("(") + "|" + toRePart(/<\w+\s*>/) ) >> /\(|<\w+\s*>/
     * @param {String|RegExp} str_re*/
    static toRePart(str_re) {
        return typeof str_re === 'string' ? escapeRegExp(str_re) : str_re.source;
    }
    /**Returns a Regex, that from whichs first non-undefined match group you get the index of the scope in given arr 
     * @param {Scope[]} scopes @param {Scope} base_scope*/
    reScopes(scopes = this.sub_scopes) {
        const end_part = this?.end ? Scope.toRePart(this.end) : "";

        let any_scope = false;

        const is_root = this.type === 'Root';

        let str = scopes.reduce((a, x, i) => {
            if (is_root && !x.global) return a;
            const rePart = Scope.toRePart(x.start);
            if (rePart === end_part) return a;
            if (!any_scope) any_scope = true;
            return a + `${!i ? '' : '|'}(?<g${i}>${Scope.toRePart(x.start)})`
        }, '');

        str += !this?.end ? '' :
            (any_scope ? '|' : '') + `(?<END>${end_part})`;
        if (this.esc) {
            str = `(?<!${Scope.toRePart(this.esc)})(?:${str})`;
        }
        let res_re = new RegExp(str, 'sm');
        this.re = res_re;

        return res_re;
    }

    defaulttest(start,end,up_to_txt,tree){
        return true;
    }
    /**If you use Regexes, here you can check if the concrete Start|End fit together. Also to resolev special ambiguity like with js Regex, 
     * @typedef { (start:String,end:String,up_to_txt:String,tree:RootToken)=>Boolean } TestFN
     * @type {TestFN}
    */
    startTest;
}


const BRACE = new Scope({ type: 'Brace', start: `(`, end: `)` });
const CRLYBRACE = new Scope({ type: 'crlBrace', start: `{`, end: `}` });
const SQBRACE = new Scope({ type: 'sqBrace', start: `[`, end: `]` });
const DSTRING = new Scope({ type: 'dString', start: `"`, end: `"`, self: false, esc: true });
const SSTRING = new Scope({ type: 'sString', start: `'`, end: `'`, self: false, esc: true });
const TSTRING = new Scope({ type: 'tString', start: '`', end: '`', self: false, esc: true });
const TEXP = new Scope({ type: 'tExp', start: '${', end: '}', self: false });
const REGEXP = new Scope({ type: 'Regex', start: /(?<=[=:,\n+*(/!|&%^-]\s*)\//, end: '/', self: false, esc: true,startTest:(start,end,up_to_txt,tree)=> /[=:,\n+*(/!|&%^-]\s*$/.test(tree.last_token.value)});
const REGEXP_BRACE = new Scope({ type: 'REGEXP_BRACE',start: `[`, end: `]`, self: false, esc: true });
const COMMENT = new Scope({ type: 'lnComment', start: '//', end: /\n|$/ });
const MUCOMMENT = new Scope({ type: 'muComment', start: '/*', end: '*/' });
//Test Only
// const ASSIGNMENT = new Scope({ type: 'Assignment', start: /\S+\s*=/i, end: /;|\n|$/, self: true });
//Has empty end -> Only Pseudo Scope
// const NUMBER = new Scope({ type: 'Number', start: /\b(?:0[x|b])?\d+/i, });
// const BOOLEAN = new Scope({ type: 'Boolean', start: /true|false/, end: '', cssName: 'boolean' });
// const KEYWORD = new Scope({ type: 'keyword', start: /\b(var|let|this|const|class|extends|function|if|else|return|for|while|switch|case|break|continue|new|typeof|throw|try|catch)\b/ });
// const KEYWORD_2 = new Scope({ type: 'keyword_2', start: /\b(if|else|return|for|while|switch|case|break|continue|throw|try|catch|from|import|export|await|async)\b/ });

const dfl_js_scopes = [
    COMMENT, MUCOMMENT,
    DSTRING, SSTRING, TSTRING,
    REGEXP,
    BRACE, SQBRACE, CRLYBRACE,
    //Test Only
    // NUMBER, BOOLEAN, KEYWORD, KEYWORD_2, //Only Test for syntx Highlighting
];

// ASSIGNMENT.addSubScopes(...dfl_js_scopes);
BRACE.addSubScopes(...dfl_js_scopes);
CRLYBRACE.addSubScopes(...dfl_js_scopes);
SQBRACE.addSubScopes(...dfl_js_scopes);
TSTRING.addSubScopes(TEXP);
TEXP.addSubScopes(...dfl_js_scopes);

/*For rare case of  / [ / \] ]  /  
the / inside the sqBrace does not end the regex,
also the normal sqBrace cannot be escaped, the Regex on can, therefore other obj*/
REGEXP.addSubScopes(REGEXP_BRACE)

/**This takes a scopes Array and handles the Parsing*/
export class ScopeParser {
    /**@param {ScopeDesc[]} scopes  */
    constructor(scopes) {
        if (scopes) this.scopes = scopes;
        this.initGloabScope();
    }
    scopes = dfl_js_scopes;
    initGloabScope() {
        this.global_scope = new Scope({ type: 'Root', self: false, start: undefined, end: undefined, sub_scopes: this.scopes });
    }
    /**@type {Scope} */
    global_scope;
    /**
     * @param {string} txt -The text to parse 
     * @param {RootToken|Token} tree -A optional Root Token, if you want to continue from some where
     * @returns {RootToken|Token} */
    parse(txt,tree){
        return this.parseUntil( txt,undefined,tree)
    }
    /** 
     * @param {string} txt -The text to parse 
     * @param {String|Scope} until_first 
    * @param {RootToken|Token} tree -A optional Root Token, if you want to continue from some where
    * @typedef {{tree:Token,found:Token,rest_txt:String}} UntilResult aborst when it found until_first ,Is more efficient
    * @returns {UntilResult}
    */
    parseUntil(txt, until_first, tree = new Token({ type: 'Root', end: '', start: '' })) {
        tree.last_token ??= tree;

        let i = 0;

        let _m;
        tree.rest_txt = txt;

        let max_iter = 10000;
        let processed_txt = "";
        /**Open Scopes  @type {Scope[]*/
        const stack = tree.stack ?? [];

        let cur_scope = this.global_scope;
        let amalgated_txt="";
        while (_m = tree.rest_txt.match(cur_scope.re)) {
            if (!tree.rest_txt || max_iter-- < 0) { break };
            //For pseudo Scopes, that match empty String "";
            const is_pseudo = cur_scope.end === "";
            //in group name of the only not-undefined capture group is the index in the cur_scope.sub_scopes encoded or it's the END;
            const _m_group = is_pseudo ? '' : Object.entries(_m.groups).find(([key, val]) => val !== undefined)?.[0];
            //Means you found an end
            const is_close = is_pseudo || _m_group === 'END';

            const up_to_txt =amalgated_txt+tree.rest_txt.slice(0, _m.index);
            processed_txt += up_to_txt + _m[0];

            const depth = stack.length;
            if (up_to_txt) {
                tree.last_token.addChild(new Token({ type: 'Text', value: up_to_txt, is_closed: true, depth, i: i++ }))
            }
            const earlyOut = is_close && (until_first === cur_scope || until_first === cur_scope.type);

            if (is_close) {
                tree.last_token.is_closed = true;
                tree.last_token.end = _m[0];
                tree.last_token = tree.last_token.parent;
                stack.pop();
            }
            else {
                const index = _m_group.slice(1) << 0;
                const next_scope = cur_scope.sub_scopes[index];
                if(false === next_scope.startTest?.(_m[0],undefined,up_to_txt,tree)){
                    tree.rest_txt = tree.rest_txt.slice(_m.index + _m[0].length);
                    amalgated_txt = up_to_txt;
                    break;
                }
                else if(amalgated_txt){amalgated_txt=""}

                const token_opt = { type: next_scope.type, depth, i: i++ };
                const next_is_pseudo = next_scope.end === "";
                if (next_is_pseudo) {
                    token_opt.value = _m[0];
                    token_opt.is_closed = true;
                }
                else {
                    token_opt.start = _m[0];
                }
                const scope_tok = new Token(token_opt);
                if (next_scope.cssName) {
                    scope_tok.cssName = next_scope.cssName;
                }
                tree.last_token.addChild(scope_tok)
                //If Scope is not Pseudo, increase the Stack
                if (!next_is_pseudo) {
                    stack.push(next_scope);
                    tree.last_token = scope_tok;
                }
            }
            //set to next iter variables
            tree.rest_txt = tree.rest_txt.slice(_m.index + _m[0].length);
            cur_scope = stack.at(-1) ?? this.global_scope;

            if (earlyOut) {
                tree.stack = stack;
                /**@type {UntilResult} */
                const res = { tree, found: tree.last_token.sub.at(-1) };
                return res;
            }
        }
        if(until_first){
             /**@type {UntilResult} */
             const res = { tree, found: undefined };
             return res;
        }
        //Deal with excess Text
        if (tree.rest_txt) {
            tree.last_token.addChild(new Token({ type: 'Text', value: tree.rest_txt, is_closed: true, depth: 0, i: i++ }))
            tree.rest_txt = "";
        }
        //Make Root Closed if it's last child is closed
        tree.is_closed = tree.sub.at(-1).is_closed;
        return tree;
    }
}
export const new_js_parser = new ScopeParser();

//For debug in web console
// window.newScopeParser = ScopeParser;
// window.newToken = Token;
// window.ScopeDesc = Scope;