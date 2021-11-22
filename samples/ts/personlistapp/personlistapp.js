import { component } from "../../../lib/esm/hof.js";
import { PersonData } from "./person-data.js";
const f = PersonData;
console.dir(f);
component("app-root", {
    render() {
        return () => `Test`;
    }
}, "label");
