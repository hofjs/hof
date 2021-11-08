import { component } from "../../../lib/esm/hof.js";
import { Person } from "./Person.js";

export const PersonDataInfo = component("person-data-info", {
    value: [] as Array<Person>,

    render() {
        return () => `
            <br/><br/>Person Info
            <li>First Person: ${(this.value[0]?.name ?? "-") + " (" + (this.value[0]?.age ?? "") + ")"}</li>
            <li>Last Person: ${(this.value[this.value.length-1]?.name ?? "-") + " (" + (this.value[this.value.length-1]?.age ?? "") + ")"}</li>
        `;
    }
});