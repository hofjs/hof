import { HofHtmlElement, html } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";
import { personStore } from "./person-store.js";
import "./person-data-input.js";
import "./person-data-list.js";
import "./person-data-info.js";
/**
 * Renders a ui to manage a list of persons, e.g. to add, update and delete persons of a list.
 * @attr personStore - Store object that contains list of persons, currently selected person and CRUD operations to modify list of persons.
 */
export class PersonData extends HofHtmlElement {
    constructor() {
        super();
        this.personStore = personStore;
        this.templates = html `
        <fieldset>
            <person-data-input label="Name" value="${this.personStore.selected.name}" change="${(event) => this.personStore.changeName(event.target.value)}"></person-data-input>
            <person-data-input label="Age" value="${this.personStore.selected.age}" change="${(event) => this.personStore.changeAge(event)}"></person-data-input>
            <button onclick="${this.personStore.save}">Speichern</button>
        </fieldset>                    

        ${this.personStore.persons.length} persons in list
        <person-data-list persons="${this.personStore.persons}" edititem="${this.personStore.edit}" deleteitem="${this.personStore.remove}"></person-data-list>
        
        <a href="#" onclick="${this.personStore.create}">Neu</a>

        <person-data-info value="${this.personStore.persons}"></person-data-info>  
    `;
        fetch('https://jsonplaceholder.typicode.com/todos?_limit=10')
            .then(response => response.json()).then(list => list.map(todo => new Person(todo.title, todo.id))).then(x => this.personStore.persons = x);
    }
}
customElements.define("person-data", PersonData);
