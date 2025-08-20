/***
 * Logic Helper methods for the Hof.js lib
 */
export const DEF = Object.defineProperty;
/** Replaces & < > throug their html entitie escape &amp;amp; &amp;lt; &amp;gt;
 *In a  Hof.js template it also acts as an anotation to indicate that the ${} has no HTML
 @example
 html` <p> ${ nohtml, '<b> No HTML interpolation text ... </b>' } </p> `
*/
export function nohtml(strs, ...exps) {
    let result = "";
    let i = 0;
    if(Array.isArray(strs)){
        for (const str of strs) {
            result += str + (exps?.[i] ?? "");
            i++
        }
    }
    else {
        result=strs;
    }
    result = result.replaceAll(/&/g, "&amp;");
    result = result.replaceAll(/</g, "&lt;");
    result = result.replaceAll(/>/g, "&gt;");
    result = result.replaceAll(/"/g, "&quot;");
    return result;
}

/**Code to supply Dummies for browser only env to prevent crash.  -> maybee you want to just use laxJSON */
try {document;}
catch(e){
    // console.warn('document is not defined are you in a node env?',e);
    const dummyObj = {dumpBrowserDummy:true};
    const dummyClass = class DummyClass{};
    const dummyFn=()=>dummyObj;
    Object.assign(globalThis,{document:dummyObj,DOMParser:dummyClass,HTMLElement:dummyClass,customElements:dummyFn})
}

const decoder_elm = document.createElement?.('div');
/**
 * Use DOM Element to decode HTML entities
 * @example 
 * decodeHtmlEntities("&quot;Hello &amp; Welcome&#33;&quot;")
 * // "Hello & Welcome!"
 * @param {String} str 
 */
export function decodeHtmlEntities(str) {
    str = str.replaceAll(/&.{1,6};/g, (html_enti) => {
        decoder_elm.innerHTML = html_enti;
        return decoder_elm.textContent || '';
    });
    decoder_elm.textContent = "";
    return str;
}
export function isPrimitive(value) {
    return (value === null) || (typeof value !== 'object' && typeof value !== 'function');
}
export function isPrimitiveWraper(value) {
    return value !== value.valueOf();
}
/**Filters from a String Array all matches with an other String|Regex Array
 * (Matces only == ,so 45 == '45' -> true)
 * ```
 * let keys= ['abc','def','hij','ABC' ,'Mario','Wario','Mariooo!' , '123','44444','567', 5 , 6 ,7 ]
 * let not= ['abc' , 'hij' , /^[mw]ario/i , '123' ,'6' ]
 * filter(keys,not); //['def', 'ABC', '44444', '567', 5, 7]
 * ```
*/
export function filter(keys = [], not = []) {
    return keys.filter(key => !not.some(a_not => a_not?.test?.(key) || key == a_not))
}
/**
 * Same as filter, but with an obj
 */
export function filterObj(obj = {}, not = []) {
    const filtered_obj = {};
    Object.entries(obj).filter(([key,]) => !not.some(a_not => a_not?.test?.(key) || key == a_not)).forEach(([key, val]) => filtered_obj[key] = val)
    return filtered_obj;
}
/**Escapes the characters that have special meaning in a regex
 * Modifyed from [Stackoverflow](https://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript)\
 * Has a option, to automaticly detect if it was the to String of a regex and does not escape. when /aa?.*bb/.toString() -> "/aa?.*bb/"
 */
export function escapeRegExp(text, retriveRegex = true) {
    if (text[0] == '/' && text.at(-1) == '/' && text.length > 2) { return text.slice(1, -1) }
    return text.replace(/[-[\]{}()*+?.,\\\/^$|#]/g, '\\$&');
}
/** Will flow over after calling dequeue with max Number value, uses internal a Map*/
export class Queue {
    #map = new Map();
    #head = 0;
    #tail = -1;//for inital ++ ,it's -1
    constructor(...items) {
        for (const item of items) { this.#map.set(++this.#tail, item); }
    }
    /**Puts the item at the end of the queue */
    set enqueue(item) { this.#map.set(++this.#tail, item); }
    /**Calls enqueue on all items */
    enqueueAll(...items) { for (const item of items) { this.enqueue = item; } }
    /**Show  next|oldest item in Queue, no internal action */
    get peek() { return this.#map.get(this.#head) }

    /**Show N-th  next|oldest item in Queue, no internal action */
    peekN(N = 0) { return this.#map.get(this.#head + N) }
    /**Removes next|oldest item from the Queue and returns it*/
    get dequeue() { const res = this.#map.get(this.#head); if (this.#map.delete(this.#head)) { this.#head++ }; return res }

    dequeueN(N = 0) {
        if (N == 0) return;
        const res = this.#map.get(this.#head + N - 1);
        for (let i = N; i > 0; i--) {
            if (this.#map.delete(this.#head)) { this.#head++  };
            if (this.#map.size===0) break;
        }
        return res;
    }

    /**Size of the internal Map */
    get length() { return this.#map.size }
    *[Symbol.iterator]() {
        let i = this.#head;
        while (i < this.#tail) {
            yield this.#map.get(i++);
        }
    }
    /**Enqueus a item at the head of the Queue */
    set enqueueHead(item) { this.#map.set(--this.#head, item); }
    /**Enqueus a item at the head of the Queue , for multi insert, enqueues the block as a whole, not the elements one by one*/
    enqueueHeadAll(...items) { for (let i = items.length - 1; i > -1; i--) { this.#map.set(--this.#head, items[i]); } }
    /**Enqueues all items at the begining of the Queue, like `Array.prototype.unshift()`, Same as `enqueueHeadAll()` */
    unshift(...items) {
        for (let i = items.length - 1; i > -1; i--) { this.#map.set(--this.#head, items[i]); }
    }
    setInternalMapOffset(offset,val,){
        this.#map.set(offset+this.#head,val);
    }
    /**Reset, lose all items, is then like a fresh Queue */
    reset() {
        this.#map.clear();
        this.#head = 0;
        this.#tail = -1;
    }
}


