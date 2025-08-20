import {  css, HofElement, HofOptions, html,} from "../../lib/esm/hof.js";

/** 
 * Pass any function to an attribute an it will be assinged to the JS-prop of the element.
 * This behaviour can be used for all DOM-Events. 
 * The this will be the component. 
 */

class SimpleCounter extends HofElement {
    count = 5;


    dec(clk_event){
        console.log('dec',clk_event); 
        if(this.count)this.count--; 
    }
    
    changeCount(chng_event){
        console.log('changeCount',chng_event);
        this.count= chng_event.target.value;
    }

    template = html`
        <!-- (internally:  button.onclick = this.dec ) -->
        <button onclick=${ this.dec }>-</button>
        ${this.count} 
        <!-- Inline  (internally:  button.onclick = ()=>this.count++ ) -->
        <button onclick=${ ()=>this.count++ }>+</button>

        <b>Set free: </b> <input type="number" value=${this.count} onchange=${ this.changeCount } >

        <!-- Alternative: use HTML inline Event-Handler and the TEMP references to the current component -->
        <button onclick="this.TEMP.count=42; console.log('inline HTML-Handler with TEMP',this.localName,this.TEMP.localName); ">
           Set to 42
        </button>
    `;
}

// Make as custom tag available
customElements.define("simple-counter", SimpleCounter );
