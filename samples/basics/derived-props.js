import {  HofElement, html,} from "../../lib/esm/hof.js";

/** Derived Properites can be . This makes the template more concise */ 

class DerivedProperties extends HofElement {
    /**  @attr */
    fname = "Foo";
    /**  @attr */
    lname = "Bar";

    /** @attr */
    key = 13;

    /** @attr */
    edit = false;

    get fullName(){ return this.fname+' '+this.lname }

    get CAPS(){return this.fullName.toLocaleUpperCase() }

    get reverse(){return [...this.fullName].reverse().join("") }

    get encrypted(){ return [...this.fullName].map( char=>{ 
        if(!char.match(/[a-z]/i))return char;
        const off= char.match(/[a-z]/)?97:65;
        return String.fromCodePoint( off + ((char.codePointAt()- off + this.key )%26) )}).join("")  
    }

    // declares the HTMl structure
    template = html`
        <h2>Hello World, ${this.fullName}!</h2> 
        <p><b>Shout:</b> ${this.CAPS}</p>
        <p><b>Reverse:</b> ${this.reverse}</p>

        <p><b>Encrypted:</b> ${ this.encrypted } </p>
        <details open=${this.edit}>
            <summary>Edit</summary>
            <form>
                <label>First Name: <input value=${this.fname}> </label>
                <label>Last Name: <input value=${this.lname}> </label>
                <label>Key: <input value=${this.key}> </label>

            </form>
        </details>
    `;
}

// Make as custom tag available
customElements.define("dervied-props", DerivedProperties );



document.body.innerHTML = html`
    <h1>Dervied Properties</h1>
    <p> Change the name parts to see how everything is automatically recalculated.</p>
    
    <dervied-props fname="Julius" lname="Caesar"  edit ></dervied-props>
    <dervied-props fname="Nemo" lname="Nonone"  ></dervied-props>
`;