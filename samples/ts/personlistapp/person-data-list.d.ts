import { Person } from "./Person.js";
export declare const PersonDataList: new () => import("../../../lib/esm/hof.js").HofHtmlElement & {
    persons: Person[];
    createitem: (person: Person) => void;
    edititem: (person: Person) => void;
    deleteitem: (person: Person) => void;
    render(): (string | ((person: Person) => string))[];
};
