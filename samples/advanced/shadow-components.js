import {  css, HofElement, HofOptions, html,} from "../../lib/esm/hof.js";


/** 
 * To isolate the component from hte surrounding HTML you can use shadow Components. 
 *      They won't recieve the surrounding CSS
 *      Their content will form an own document, and is not availabel to the outside e.g. via querySelector
 */

class BasicShadow extends HofElement {
    name = "Nemo";

    /** options enables Shadow DOM  @type {HofOptions} */
    __options = { 
        shadow_DOM: true,
        // can also take shadow Root options
        // shadow_DOM: {mode:"open", delegatesFocus: true },
    };

    template = html`
        <p>Hello from the dark side, <span>${this.name}</span>!</p> 
    `;

     static style = css`
        /** won't spill outside of the component */
        p:hover{
            color: slategrey;
            &:after{
                content:"shadow p";
            }
        }
        span {
            color: darkred;
        }
    `;
}
customElements.define('basic-shadow',BasicShadow);

/**************** Slots */

const li = (strs,...exps)=>{const e=document.createElement("li");e.innerHTML=String.raw({raw:strs},...exps) ;return e}

class SlotsComp extends HofElement {
    __options = { 
        shadow_DOM: true,
    }
    name = "UNNAMED";
    open = true;
    player = "Joe";
    foe = "Jane";
    score = [0,0];
    

    atk(p="player",f="foe"){
        const logSlot = this.shadowRoot.querySelector("slot:not([name])"); 
        const assignedHTML = logSlot.assignedNodes();
        const htmlLog= [...assignedHTML].find(node=>node?.matches?.('.log')) ?? this.shadowRoot.querySelector(".log");
        const rnd = Math.random();
        htmlLog.append (li`${this[p]} attacks ${this[f]} and ${rnd>0.25? `hits for ${this.score[p=="player"?0:1]++, (rnd*15)|0} HP`:'misses...'}`);
    }

    template = html`
        <details ${this.open}>
            <summary>
                <slot name="heading">
                    <h2>Match <i>${this.name}</i></h2>
                </slot> 
            </summary>
            <p>Score ${this.score[0]}:${this.score[1]}</p>
            
            <slot name="player">
                <!-- fallback -->
                ${this.player}
            </slot>
            
            <button onclick=${()=>this.atk("player",'foe')}>ATK</button>
            vs.
            <button onclick=${()=>this.atk('foe','player')}>ATK</button>
            
            <slot name="foe">
                ${this.foe} 
            </slot>
            
            <!-- unnamed default slot -->
            <slot>
                <ol class=log></ol>
            </slot>
        </details>
    `;
    static style = css`
        &{
            display: block;    
            max-width: 400px;
            margin: 1rem;
        }
        summary *{display: inline-block}
        h1, h2, h3 {
            text-decoration: underline wavy;
            color: purple;
        }
        .log :nth-child(even){ 
            background-color: lightblue;
        }
    ` ;
}

customElements.define('slots-comp',SlotsComp);


document.body.innerHTML= html`
    <h1>Shadow Components</h1>
    <p>You can use Shadow DOM to isolate the CSS and Document from the external influences</p>
    <h2>A Basic Shadow Component</h2> 
    
    
    <style>
        p { color: teal; }
    </style>
    
    <p>Outside before paragraph (in outside CSS teal)</p>

    <basic-shadow name="Anakin Skywalker"></basic-shadow>
    
    <p>Outside after paragraph</p>
    


    <h2>Slots</h2> 
    
    <slots-comp name="Basic Encounter" open=false score="0,0" player="Nemo" foe="Molerat"></slots-comp>

    <slots-comp name="Epic Beastial Encounter" score="3,2" player="Nemo" foe="Bear">
        <span slot="player" style="color: royalblue">  fab<u>u</u>less <b>N</b>emo </span>
        
        <span slot="foe" style="color:darkred">  <s>IN</s>vincable <i>Bear</i> </span>
        
        <!-- appended unnamed default slot at the end -->
        <hr>
        <h3>A Fancy Description</h3>
        <p>Long a ago Nemo encountered a Bear...</p>
        <h3>Log</h3>
        <ul class=log>
            <li>Nemo attacks Bear and he misses...</li>
            <li>Bear scratches Nemo for 12 HP</li>
        </ul>
    
    </slots-comp>


   
`;