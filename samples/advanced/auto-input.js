import {  css, HofElement, html,} from "../../lib/esm/hof.js";


/** 
 * Hof.js will automatically generate a onchange handler for <input value>, <selet value>, <textarea> or  <tag contenteditable> if it is a simple property
 */
class AutoInput extends HofElement {
    text = "my input";

    template = html`
        <p>text= ${this.text}</p>
        <!-- verbose manuall way -->
        manuall: <input 
            value=${ this.text } 
            onchange=${
                (chng_event)=>{this.text= chng_event.target.value}
            } 
        > 

        <!-- the same but automatically generated -->
        Auto: <input value=${ this.text }>
    `;
}
customElements.define('auto-input',AutoInput);

/** A reasonable type is also automatically infered and set. Manully set type have precedence */
class AutoInputType extends HofElement {
    /** @attr */
    str = "Text Text";
    /** @attr */
    num = 42;
    /** @attr */
    bool = true;
   
    /** Shortend syntax is accounted for */
    template = ( {str,num,bool}=this )=>html`
      <p>
        <b>val:</b> ${ str } <b>type:</b> ${ typeof str }
        <br>

        Minimal: <input value=${ str }> 
        
        <!-- manuall type has precedence -->
        Manuall Type <input type="password" value=${ str }> 

        <!-- uses oninput instead of onchange (for all input-types possible)-->
        Oninput: <input  value=${ str } oninput> 

      </p>
      <p>
        <b>val:</b> ${ num } <b>type:</b> ${ typeof num }
        <br>
        <!-- uses type=number -->
        <input value=${ num }> 
        <input type="range" value=${ num }> 
        <input type="text" value=${ num } placeholder="type=text"> 
        
        progressbar:
        <progress max="100" value=${num}> <!-- fallback --> ${num}%</progress>
      </p>
      <p>
        <b>val:</b> ${ bool } <b>type:</b> ${ typeof bool } 
        <br>
        <!--  type=checkbox  -->
        <input checked=${ bool }> 

        <input type="button" value="toogle" checked=${bool}>
        
        <button checked=${bool}> 
            <!-- <img src="potetial img">  -->
            <svg viewBox="0 0 16 16" width="10"  fill="none" stroke="yellow">
                <circle cx="6" cy="6" r="4"/>
                <circle cx="10" cy="6"  r="4"/>
            </svg>
            <b>T</b>oggle
        </button>
        

        <p>special case of boolean <code>type="text"|"search"</code> box. Use for <code>false</code>: empty,"false","no","nil" and for <code>true</code>: "true", non-empty text</p>
        <input type="text" value=${ bool } placeholder="false,true"> 
        
        <input type="search" value=${ bool } placeholder="has ESC delete"> 
      </p>
    `;

    static style = css`
        /** toogle button style */
        button, input[type="button"] {
            border: solid 1px #444;
            border-radius: 0.2rem;
            &[checked]{
                background-color: royalblue;
                color: whitesmoke;
            }
        }
    `;
}

customElements.define('auto-input-type',AutoInputType);


class AutoOther extends HofElement {
    name="Link";
    monster = "Kraken";
    description = "";
    effectivWeapon = "Harpun";

    template= html`
        <h3>Stats of ${this.name}</h3>
        <p title="${this.description}">
            <b>Describe yourself [length=${this.description.length}]:</b> <br>
            <!-- only works if \${} is only child of textarea or contenteditable -->
            <textarea placeholder="leave a note here">  ${ this.description  }   </textarea>
        </p>
        <p>Echo Description: ${ this.description } </p>
        <p title="you have ${this.effectivWeapon}">
            <b>Favorite Weapon:</b>
            <span contenteditable  > 
                 ${ this.effectivWeapon  }   
            </span>
        </p>
        <p>Echo Weapon: ${ this.effectivWeapon } </p>
        <p>
            <b>Favorite Monster: </b> ${this.monster} 
            <select value=${ this.monster }>
                <option>Kraken</option>
                <option>Vampyr</option>
                <option>Bigfoot</option>
                <option>Werwolf</option>
            </select>  
        </p>
    `;
    static style = css`
    [contenteditable]{ padding: 4px; }
    `;
}
customElements.define('auto-other',AutoOther);

document.body.innerHTML= html`
    <h1>Automatic Input Event Handler</h1> 
    
    <hr>
    <p> A minimal example </p>
    <auto-input></auto-input>
    <hr>
    <p> The type is infered </p> 
    <auto-input-type str="Text Text" num=42 ></auto-input-type>

    
    <hr>
    <p> More complicated auto-input with &lt;select&gt;, &lt;textarea&gt; and &lt;tag contenteditable&gt; </p> 
    <auto-other></auto-other>
`;