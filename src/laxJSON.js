
/**A number like 45.4e3 Note: no \xab , this is no valid JSON number */
const number_re = /^\s*-?\d*(\.\d*)?((?:e|E)\d*)?\s*$/;
const type_re = /^\s*(?:true|false|null)\s*$/
const esc_new_line_re = /(?<!\\)\n/g;
const pure_string_re = /^\s*"(?:[^"]|\\.)*"\s*$/s;
/**
 *  A more lax `JSON` implementation. Double Quotes are not mandatorey.
 * It is used in Hof.js to infere obj from attributes.
 * ```
 * const obj = laxJSON( ` name: Nemo the Captain 
 *       age:  88,
 *      friends : [ { name:Martin }, { "name": "  Augusto  " }, null , true  ]
 *  `);  //  {"name": "Nemo the Captain", "age": 88, friends: [ {...}, {...}, null, true ]}
 *   
 * // to use backslash '\' for things like '\n' or for multiline keys  use it like a tag function
 * const obj2 = laxJSON` 
 * data: 1\n\n2\t\t3 
 * multiline: AAA
 *    BBB
 *    CCC
 * time: "2024-12-5"
 * `;// {"data": "1\n\n2\t\t3", "multiline": "AAA\n  BBB\n  CCC", "time": "2024-12-5"}
 * ```
 */
export function laxJSON(str = "") {
    //Better for escapes like \n like: laxJSON` key:a\na `
    if (str.raw) str = str.raw.join("");

    let in_tick = false;
    let JSON_str = str.replaceAll(/(?:(?:\\.|[^,:\[\]{}\s])+(?:\s+(?![^,:\[\]{}\s]+\s*(?<!\\):)(?:\\.|[^,:\[\]{}\s])+)*)|([,:\[\]{}\s]+)/g, (key, ..._m) => {
        //a Meta char
        if (_m[0] !== undefined) return in_tick ? key.replaceAll(esc_new_line_re, '\\n') : key;

        //Is primitve
        if (number_re.test(key) || type_re.test(key)) return key;

        //Escape the \n, cause JSON.parse needs a string with \\n
        key = key.replaceAll(esc_new_line_re, '\\n');

        //Remove addionally Bad escapes
        key = key.replaceAll(/(?<!\\)\\([,:\[\]{}\s])/g, "$1");
        //Already used Ticks, keep it
        if (/^"[^"]*"$/.test(key)) return key;
        if (/^"|"$/.test(key)) { in_tick ^= 1; return key }
        if (in_tick) { return key }
        return '"' + key + '"';
    });
    //A List of extrac features

    //Insert a surouning {} or []. Don't do this if primitve or String to emulate JSON.parse( " true  " )
    if (!/^\s*$/.test(JSON_str) && !/^\s*(?:\{.*\}|\[.*\])\s*$/sm.test(JSON_str) && !pure_string_re.test(JSON_str) && !number_re.test(JSON_str) && !type_re.test(JSON_str)) {
        // const is_obj = JSON_str.slice(0, JSON_str.indexOf(",")).includes(":");  // first , has : e.g. `  a:34, `-> obj; `23,` -> arr 
        const is_obj = /^[^,]*:/.test(JSON_str);
        JSON_str = is_obj ? "{" + JSON_str + "}" : "[" + JSON_str + "]"
    }

    // wrap numbers before colon like { 5 : null }
    JSON_str = JSON_str.replaceAll(/((?:"\s*:\s*\d+|[\{\[,\n])\s*)(\d+(?:\.\d*)?(?:(?:e|E)\d*)?)(\s*:)/g, '$1"$2"$3');

    //ACI Automatic Colon Insertion before every key  { "a": "no colon"  "x":42 } 
    JSON_str = JSON_str.replaceAll(/([\d"\]\}]|false|true|null)(\s*"[^":,]*"\s*:)/g, "$1,$2");

    //ATCD Automatic Trailling Colon Deletion
    JSON_str = JSON_str.replaceAll(/,(\s*[\}\]$])/g, "$1")

    return JSON.parse(JSON_str);
}