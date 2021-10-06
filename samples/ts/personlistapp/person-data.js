import { component } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";
import "./person-data-input.js";
import "./person-data-list.js";
import "./person-data-info.js";
export const PersonData = component("person-data", {
    selected: new Person(),
    persons: [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)],
    changeName(value) { this.selected.name = value; },
    changeAge(event) { this.selected.age = event.target.value; },
    create() { this.selected = new Person(); },
    edit(person) { this.selected = person; },
    remove(person) { this.persons.splice(this.findIndex(person), 1); this.create(); },
    save() {
        if (this.selected.id) // Existing person?
            this.persons.splice(this.findIndex(this.selected), 1, this.selected);
        else
            this.persons.push(new Person(this.selected.name, this.selected.age));
        this.create();
    },
    findIndex(person) { return this.persons.findIndex(p => p.id == person.id); },
    render() {
        return () => `
            <fieldset>
                <person-data-input label="Name" value="${this.selected.name}" onchange="${(event) => this.changeName(event.target.value)}"></person-data-input>
                <person-data-input label="Age" value="${this.selected.age}" onchange="${(event) => this.changeAge(event)}"></person-data-input>
                <button onclick="${this.save}">Speichern</button>
            </fieldset>                    
            
            ${this.persons.length} Personen in der Liste
            <person-data-list persons="${this.persons}" edititem="${this.edit}" deleteitem="${this.remove}"></person-data-list>
            
            <a href="#" onclick="${this.create}">Neu</a>

            <person-data-info value="${this.persons}"></person-data-info>  
        `;
    }
});
