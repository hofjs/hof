import { Person } from "./Person.js";
export declare const personStore: {
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
