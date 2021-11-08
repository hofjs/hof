import { Person } from "./Person.js";
import "./person-data-input.js";
import "./person-data-list.js";
import "./person-data-info.js";
export declare const PersonData: new () => import("../../../lib/esm/hof.js").HofHtmlElement & {
    selected: Person;
    persons: Person[];
    changeName(value: any): void;
    changeAge(event: any): void;
    create(): void;
    edit(person: Person): void;
    remove(person: Person): void;
    save(): void;
    findIndex(person: Person): number;
    render(): () => string;
};
