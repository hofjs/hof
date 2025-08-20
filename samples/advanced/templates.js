import {  css, HofElement, html,} from "../../lib/esm/hof.js";


/** Basic Syntax need the 'this.'. This can be shortend by using a lambda function destructureing the 'this.'
 *  This still has autocomplete and the type of the props. It also works for derived props (JS-Getter).
 */

class BasicTemplate extends HofElement {
    name = "Nemo";

    template = html`
        <p>Hello World, ${this.name}!</p> 
    `;
}
customElements.define('basic-template',BasicTemplate);


class ShortenTemplate extends HofElement {
    fname = "Rosa";
    lname = "Star";
    get fullName(){ return this.fname+" "+this.lname }

    address = {
        street: 'Rainbow Boulevard 23',
        city: 'Mars',
        zip:55055,
    };

    /** nested destructuring is supported -> only city is much shorter this.address.city, especially if used multiple times */
    template = ( { fname,lname,fullName,address, address:{city,street,zip} }=this )=>html`
        
        <p>Hello ${fullName} [first: ${fname};last: ${lname}] </p>
        <p>Address ${street}, ${city}, ${zip} </p>
        <p>Address JSON: ${ JSON.stringify(address) }</p>
    `;
}

customElements.define('shortend-template',ShortenTemplate);

/** You can also nest html``-Template strings inside ${}. This allows for conditional Templates. */
class ConditionalTemplate extends HofElement {
    name="Nemo";
    age= 10;
    
    template = html`
    Hello: ${this.name}; age=<input value=${this.age}>
    ${
        this.age>=18?
            html`<p>You are old enough ${this.name}: Santa Clause does not live at the North Pole</p>`:
            html`<p class="error">!You are too young ${this.name}! Call your parent for this</p>`
    }
    `;
    static style=css`.error {color:red }`
}
customElements.define('conditional-template',ConditionalTemplate);


document.body.innerHTML= html`
    <h1>Different Templates</h1>

    <h2>Basic</h2> 
    <basic-template></basic-template>
    <h2>Shortend</h2> 
    <shortend-template></shortend-template>
    <h2>ConditionalTemplate</h2> 
    <p>Change the age to see the rerender</p>
    <conditional-template name="Mario" age="40"></conditional-template>
    <conditional-template name="Link" age="17"></conditional-template>
`;