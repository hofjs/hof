import { HofHtmlElement } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";
import "./person-data-input.js";
import "./person-data-list.js";
import "./person-data-info.js";
/**
 * Renders a ui to manage a list of persons, e.g. to add, update and delete persons of a list.
 * @attr personStore - Store object that contains list of persons, currently selected person and CRUD operations to modify list of persons.
 */
export declare class PersonData extends HofHtmlElement {
    personStore: {
        selected: Person;
        persons: Person[];
        changeName(value: any): void;
        changeAge(event: any): void;
        create(): void;
        edit(person: any): void;
        remove(person: any): void;
        save(): void;
        findIndex(person: any): number;
    };
    constructor();
    templates: string;
}
