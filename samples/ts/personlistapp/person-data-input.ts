import { HofHtmlElement, html } from "../../../lib/esm/hof.js";

/**
 * Renders a label and a corresponding input field.
 * @attr value - Editable value.
 * @attr label - Label for input field.
 * @attr change - Event handler that is fired after used changed value.
 */
export class PersonDataInput extends HofHtmlElement {
    value = "";
    label = "";
    change = null;

    constructor() {
        super("label")
    }

    styles = `
        input { color: blue; }
    `;

    templates = html`
        ${this.label}: <input value="${this.value}" onchange="${this.change}" />
    `
}

customElements.define("person-data-input", PersonDataInput)