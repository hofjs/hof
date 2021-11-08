import { component } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";

export const PersonDataList = component("person-data-list", {
    persons: [] as Array<Person>,
    
    createitem: null as (person: Person) => void,
    edititem: null as (person: Person) => void,
    deleteitem: null as (person: Person) => void,

    render() {
        return ["persons", (person: Person) =>
            `<li>
                ${person.name} - ${person.age} Jahre
                [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
                [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
            </li>`];
    }
});