import { css,  HofElement, html } from "../../lib/esm/hof.js";


class ObjConverter extends HofElement {
    name="";
    icon="";
    count=0;
    /** hook called on init after Attrs are parsed */
    init(){ 
        this.icon||=this.name;
        if(!this.hasAttribute("scale") && (this.icon10||this.icon100)){this.scale=false}
    }
    detailed=true;
    base = 10;
    get baseUnderflow(){return  this.count < this.base}
    
    setPlace(val,place=0){
        const places= [this.countB0,this.countB1,this.countB2].map((x,i)=>i==place?val:x);
        this.count= places.reduce((a,x,i)=>a+ x* this.base**i ,0);
    }
    get countB0(){ return this.count%this.base }
    set countB0(val){ this.setPlace(val,0)}
    set countB1(val){ this.setPlace(val,1)}
    set countB2(val){ this.setPlace(val,2)}

    get countB1(){ return Math.floor(this.count/this.base)% this.base }
    icon10;
    get countB2(){ return Math.floor(this.count/this.base**2) }
    icon100;
    scale= true;

    template = html`
    <!-- total -->

    <input class="count"  value=${this.count}>
    <span class="icon">${this.icon}</span>
    <span class="name">${this.name}</span>
    <span hidden=${ !this.detailed ||this.baseUnderflow} data-scale=${ this.scale } > =

        <!--decimal places   -->
        <span class="b2" hidden=${!this.countB2}>
            <input value=${this.countB2}> ×<span class="icon">${this.icon100 || this.icon10 || this.icon}</span> +
        </span>
        <span class="b1" hidden=${this.baseUnderflow}>
            <input value=${this.countB1}> ×<span class="icon">${this.icon10 || this.icon}</span> +
        </span>
        <span class="b0" >
            <input value=${this.countB0}> ×<span class="icon">${this.icon}</span> 
        </span>
    </span>
        
    `;
    
    static style= css`&{
        display: block;

        input{width: 4em;}
        [data-scale="true"]{
            span {vertical-align: middle;}
            .b2 .icon { font-size:5em }
            .b1 .icon { font-size:2.5em }
        }
       
    }`;
}
customElements.define("obj-converter", ObjConverter );