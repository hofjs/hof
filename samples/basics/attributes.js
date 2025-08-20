// import { css, Delete, HofElement, HofOptions, html, makeDeepObservable ,nohtml} from "../../lib/esm/hof.js";
import { HofElement, html, css, Delete, HofOptions, makeDeepObservable, nohtml,laxJSON } from "../../lib/esm/hof.min.js";


const defaultPers = {name:"NEMO",age:-1,address:{city:'N/A'},zip:-1};

/**
 * The class props function as attributes and can be set from a parent component or directly from HTML
 * Properties set from another HOf component stay objects.
 * Otherwise Hof.js tries to extract an it from the attribute string. The class defualt value is used as a reference 
 */

class Person extends HofElement {

    /** Your IDE/editor may give you with this @attr JS Doc and an Extension autocomplete and hover info in a html`` string 
     * @attr */
    name = "";
    /** @attr */
    age = -1;
    /** @attr */
    address = {
        street: 'N/A',
        city: 'N/A',
        zip:-1,
    };

    edit = false;

    template = html`
    <article>
        <span><b>Name:</b> ${this.name} |</span>
        <label>
            <b>Age:</b> 
            <span hidden=${this.edit} >${this.age}</span> 
            <input value="${this.age}" 
                onchange="${ (ev)=>this.age=ev.target.value}"
                hidden=${ !this.edit }
            >
        </label>
        <button onclick=${ ()=>this.edit=!this.edit }>
            ${ this.edit? "Show":"Edit"}
        </button>
        |
        <b>Address:</b> ${this.address.street}, ${this.address.city}, ${this.address.zip}

    </article>
    `;
}
customElements.define('person-',Person);


class City extends HofElement {
    class="city";

    name="NO_NAME";
    zip= -1;
    persons = [ defaultPers, defaultPers,defaultPers];
    
    mainStreet = "NO_MAIN_STREET";

    /** boolean props can be set with boolean string (<tag capital="true"> or <tag capital="false">) or value-less (<tag  capital >, capital==true) */
    capital = false;

    template= html`
   
    <h1>City: ${this.name}</h1>
    <p><b>Zip:</b> ${this.zip}</p>
    <p><b>is Capital:</b> ${this.capital}</p>

    <hr>
    <b>Inhabitants:</b>
    <ul>
        ${  this.persons.map(  (person,i)=>  html`
            <!-- 
                attributess don't need a quote, the \${ } is enough as for 'age'
                Also interpolation like in id is possible 
                address will recieve the exact obj given here  -->
            <person-   name="${person.name}"
                age=${person.age}
                id="${this.name}Person${i}"
                address=${ person.address ?? {...this,street:this.mainStreet,  city:this.name, }  }
            ></person->
        `) }
    </ul>
    `;
}
customElements.define('city-',City);

// you can use the laxJSON parser for the attributes seperate
const obj= laxJSON`  { age:34, name: Foo Bar , list: [1,2,null, true, false, "in quotes", no quotes ]   } `
// console.log(obj);