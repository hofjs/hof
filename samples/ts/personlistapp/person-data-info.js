import { HofHtmlElement, html } from "../../../lib/esm/hof.js";
/**
 * Renders info about the first and last person of a list.
 * @attr value - List of persons.
 */
export class PersonDataInfo extends HofHtmlElement {
    constructor() {
        super(...arguments);
        this.value = [];
        // TypeScript transpiles ?. and ?? to expressions that use helper variables, which are not supported in template literals
        // (as a consequence this would not work)
        // templates = html`
        //     <br/><br/>Person Info
        //     <li>First Person: ${(this.value[0]?.name ?? "-") + " (" + (this.value[0]?.age ?? "") + ")"}</li>
        //     <li>Last Person: ${(this.value[this.value.length-1]?.name ?? "-") + " (" + (this.value[this.value.length-1]?.age ?? "") + ")"}</li>
        // `
        this.templates = html `
        <br/><br/>Person Info
        ${this.value.length > 0
            ? `<li>First Person: ${this.value[0].name} (${this.value[0].age})</li>
                <li>Last Person: ${this.value[this.value.length - 1].name} (${this.value[this.value.length - 1].age})</li>`
            : `<li>First Person: -</li>
                <li>Last Person: -</li>`}
    `;
    }
}
customElements.define("person-data-info", PersonDataInfo);
