import {  css, HofElement, html,} from "../../lib/esm/hof.js";


/** if the attr name and the varibale name in the ${} match it is  */

class BaseAttrShortHand extends HofElement {
    value = "My value";

    title_forPA = "My Title for paragraph A";
    title_forPB = "My Title for paragraph B";
    /** Note: HTML attributes would also be on the Component itself, which is probably unintendet */
    // title = "My Title";

    onclick_PA(ev){console.log('click paragraph A',ev)}

    template= html`
    
    <p>Value: ${ this.value }</p> 
    <!-- both are the same -->
    Longform: <input value=${ this.value } >

    Shorthand: <input ${ this.value } >
    

    <p>Hover the paragraphs</p>
    <!-- Everything after the first _ is ignored. So different shorthands can be used for the some attribute -->
    <p ${ this.title_forPA   }   ${ this.onclick_PA }  > paragraph A</p>
    <p ${ this.title_forPB   } > paragraph B</p>
    `;
}

customElements.define("base-attr-shorthand",BaseAttrShortHand);



const title= `Attr grp 1`;
const editPlain= 'contenteditable="plaintext-only"';

/** No simple short hands that are object interpret the keys as attributes */
class ObjAttrShortHand extends HofElement {
  
    /** reuse mulitple attributes */
    inputRangeAttrs = {
        type: 'range',
        placeholder: "my placeholder",
        style:"color:slategreen;",
        min: 0,
        max: 255,
    }

    template= html`

    <!-- a valueless attr \${} is detected, but no single prop path can be found.
        -> 
     Intead it will unzip the object and interpret the result as HTML -->
    <input   ${   {type:'password', placeholder:'type a password...'}   }   >

    <!-- Here the "" is important, 
     only \${ this.inputRangeAttr } does not unzip the obj and instead assign to the inputRangeAttrs attribute -->
    <input  ${  "",this.inputRangeAttrs  }   >
    
    <input  ${  "",this.inputRangeAttrs  }   >
    
    <input  ${  "",this.inputRangeAttrs  }   >
    
    <!-- Simple prop path detected ->  Attr Shorthand , no unzipping of object -->
    <input  ${  this.inputRangeAttrs  }   >

    <!-- Use local vars for init -->
    <div 
        ${ title }  
        ${ /* \${} return paresed as HTML Attr str */ `style="color:slategrey; "`  }
        ${ /* is interpreted as HTML Attr str, cause no simple path */ ""||editPlain}
        >
My contenteditable div
 </div>
    `;
}

customElements.define("obj-attr-shorthand",ObjAttrShortHand);




document.body.innerHTML = html`
    <h1>Attribute Shorthands</h1>
    <h2>Base Shorthands</h2>
    <base-attr-shorthand></base-attr-shorthand>
    <h2>Object Shorthands</h2>
    <obj-attr-shorthand></obj-attr-shorthand>
`;