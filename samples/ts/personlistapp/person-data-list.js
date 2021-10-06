import { component } from "../../../lib/esm/hof.js";
export const PersonDataList = component("person-data-list", {
    persons: [],
    createitem: null,
    edititem: null,
    deleteitem: null,
    render() {
        return ["persons", (person) => `<li>
                ${person.name} - ${person.age} Jahre
                [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
                [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
            </li>`];
    }
});
