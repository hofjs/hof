import { HofHtmlElement, item, list, html } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";

/**
 * Renders a list of persons with links to edit and delete a person
 * @attr persons - List of persons.
 * @attr edititem - Callback that is fired if a link to edit a person is clicked.
 * @attr deleteitem - Callback that is fired if a link to delete a person is clicked.
 */
export class PersonDataList extends HofHtmlElement {
    // Property
    persons = [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)];

    // Derived property
    get _filteredPersons() { return this.persons.filter(p => p.age as any > 20) }

    // Enum constants
    WEEKDAYS = ["Monday", "Tuesday", "Wednesday"];

    // Helper Function
    getBirthday(person) {
        let birthday = new Date();
        birthday.setFullYear(birthday.getFullYear() - person.age);

        return birthday.toLocaleDateString();
    }

    edititem = null;

    deleteitem = null;

    templates = [
        item(() => html`<h2>Full list</h2>`),
        list(this.persons, (person) => html`
            <li>
                ${person.name} - ${person.age} years (birthday: ${this.getBirthday(person)})
                [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
                [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
            </li>`
        ),
        item(() => html`<h2>Filtered list</h2>`),
        list(this._filteredPersons, (person) => html`
            <li>
                ${person.name} - ${person.age} years (birthday: ${this.getBirthday(person)})
                [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
                [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
            </li>`
        ),
        item(() => html`First rendering: test, expression: ${this.persons.length} ${this.WEEKDAYS}`)
    ];
}

customElements.define("person-data-list", PersonDataList)