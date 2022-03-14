import { Person } from "./Person.js";
export const personStore = {
    selected: new Person(),
    persons: [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)],
    changeName(value) { this.selected.name = value; },
    changeAge(event) { this.selected.age = event.target.value; },
    create() { this.selected = new Person(); },
    edit(person) { this.selected = Object.assign({}, person); },
    remove(person) { this.persons.splice(this.findIndex(person), 1); this.create(); },
    save() {
        if (this.selected.id) // Existing person?
            this.persons.splice(this.findIndex(this.selected), 1, this.selected);
        else
            this.persons.push(new Person(this.selected.name, this.selected.age));
        this.create();
    },
    findIndex(person) { return this.persons.findIndex(p => p.id == person.id); },
};
