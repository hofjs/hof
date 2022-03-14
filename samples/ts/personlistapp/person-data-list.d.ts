import { HofHtmlElement } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";
/**
 * Renders a list of persons with links to edit and delete a person
 * @attr persons - List of persons.
 * @attr edititem - Callback that is fired if a link to edit a person is clicked.
 * @attr deleteitem - Callback that is fired if a link to delete a person is clicked.
 */
export declare class PersonDataList extends HofHtmlElement {
    persons: Person[];
    get _filteredPersons(): Person[];
    WEEKDAYS: string[];
    getBirthday(person: any): string;
    edititem: any;
    deleteitem: any;
    templates: (Function | {
        list: (Object & Partial<import("../../../lib/esm/hof.js").ObjectObservable>)[] & Partial<import("../../../lib/esm/hof.js").ArrayObservable<Object & Partial<import("../../../lib/esm/hof.js").ObjectObservable>>>;
        htmlRenderFunc: Function;
        parentElement: string;
        renderParentElementOnEmptyList: boolean;
    })[];
}
