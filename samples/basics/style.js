import {  css, HofElement, HofOptions, html,} from "../../lib/esm/hof.js";


/** You can use external CSS. You can also use the static style prop of a class to generate once a style sheet for it.
 *  
 */

class BasicStyle extends HofElement {
    /** Takes any string, css tag fn only for better syntax highlighting and autocomplete */
    static style = css`
        /** for the component itself */
        &{
            display: inline-block;
            padding: 0.5rem;
            margin: 0.5rem;
            border: solid 1px #444;
            border-radius: 0.15rem;
            transition: all 1s;
        };
       
        p:nth-of-type(2n+1),.info{
            color: var(--rnd-color);
        }    
        .info:hover {
            font-size: large;
        }
        p {
            line-height: 1.5;
        }
        span {
            font-style: italic;
        }
    `;
    // would also work, even with interpolations, because it takes any string
    // static style = ` p { color: red }  ${`span { color: green }`} `; 


    width= 300+ ((Math.random()*40)|0)-10;
    rndColor= Math.random()>0.3? 'royalblue':'salmon';
    
    // non-static style is applied to the style attribute !! less efficient !!;
    // can be used for CSS varibles
    style = `width:${this.width}px ; --nr:${ this.__nr };--rnd-color:${ this.rndColor }`;

    template = html`
    
    <p>Nr=${this.__nr};width=${this.width};rndColor=${this.rndColor};</p>

    <p> And a <span class="info">second</span> paragraph is <span>here</span></p>    
    <p> The third paragraph is <span>here</span></p>    
    <p> paragraph is <span>here</span></p>    
    <p> paragraph uses <span class="external">external &lt;style&gt;</span> CSS</p>    

    <!-- also possible, but less efficient -->
    <!-- <style>...</style> -->
    `;
}

customElements.define("basic-style",BasicStyle);


/** You can set always inserted style in the HofOption default opject */
// HofOptions.default.style = "display: block";


document.body.innerHTML= html`
    <h1>CSS</h1>
    <style>
        /* Will affect the component */
        basic-style{
            .external {
                color: red;
                font-size: larger;
            }
        }
        
    </style>

    <basic-style></basic-style>
    <basic-style></basic-style>
    <basic-style></basic-style>

`;