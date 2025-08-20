import { css, Delete, HofElement, HofOptions, html, makeDeepObservable, nohtml } from "../../lib/esm/hof.js";

/** ******* Logging Helper Class to see the difference */
class NamesComps extends HofElement {

    /** @attr */
    names = ['--'];
    
    add = "";
    /** will push the added value to the names array  */
    addAfterChanged() {
        console.log(`**** insert add ${this.add} into [${this.names}] of ${this.localName}`)
        this.names.push(this.add);
    };
    popNames() {
        console.log(`**** pop last from [${this.names}] of ${this.localName}`);
        this.names.splice(-1);
    };
    addNameZero(val='_bla'){
        if(!this.names[0])return;
        console.log(`**** modify name 0 '${this.names[0]}' of [${this.names}] of ${this.localName}`);
        this.names[0]+='_bla';
    }
    capitalize(str = "") {
        const capitalized = (str[0] || '').toLocaleUpperCase() + str.slice(1);
        console.log(`Capitalize '${str}' -> '${capitalized}'`);
        return '"' + capitalized + '", ';
    };

    static style = css` button { background-color:slateblue; color:white; border-radius:10px; padding:0.25rem;margin:0.25rem; }`;
}


/** You can build a simple list by returning a constructed HTML String of an array in any ${}.
 *      html`  <ul>   ${  liHTMLStr( this.items /*-> [1,2,3] ∗/  ) /* -> "<li>1</li>  <li>2</li>..." ∗/  }  </ul> `
 *  However, this will recalculate the whole list, even if a sinlge element of an array changes. 
 *  Therefore the Hof.js detects the use of map() on member properties arrays that return html`` templates. 
 *  They are updated more efficiently.
 *      html`  <ul> ${ 
 *                  arrayProp.map( (item,idx)=> 
 *                      html`<li> ${idx} ${item}</li>`  )  
 *             }</ul>`
*/


class SimpleList extends NamesComps {

    template = html`
    <input value=${this.add} placeholder="Add name and hit ENTER" >
    <button onclick=${this.popNames} >Pop</button>
    <button onclick=${_=>this.addNameZero('_bla')}>names[0]+="_bla"</button>
    
    <!-- A simple list that recalculates the whole innerHTMl of the <div> --> 
    <div> ${this.names.map(this.capitalize).join(" ")} </div>
    
    `;
}
customElements.define('simple-list', SimpleList);


class AutoList extends NamesComps {

    template = html`
    <input value=${this.add} placeholder="Add name and hit ENTER" >
    <button onclick=${this.popNames} >Pop</button>
    <button onclick=${_=>this.addNameZero('_bla')}>names[0]+="_bla"</button>
    
    <!-- This form with a .map() and a html is automatically detected and updates the <ul> efficiently depending on the change -->
    <div> 
        ${ this.names.map( (name) => html`
            <span> ${ this.capitalize(name) } </span>
        `) } 
    </div>
    `;
};

customElements.define('auto-list', AutoList);


// You also can use it directly in HTML file, but in an html tag string you may have the autocomplete of the Lit Extension
document.body.innerHTML = html`
    <h1>Efficient List Demo</h1>
    <p>Open the Dev-Tools with <kbd>CTR+SHIFT I</kbd> and look in the elements tab what part of the HTML changes, when you modify the <code>names</code> array</p>

    <hr>
    <p>A Simple List. Recals the whole \${} on change </p>
    <simple-list   names="[Arron, Berta, Charlie,]"  ></simple-list>
    <br>

    <hr>
    <p>A auto List. Note how it updates only the relevant part </p>
    <auto-list  names="[ Julia, Karl, Lambert,]" ></auto-list>
`;