import { HofHtmlElement } from "../../../lib/esm/hof.js";
/**
 * Renders a label and a corresponding input field.
 * @attr value - Editable value.
 * @attr label - Label for input field.
 * @attr change - Event handler that is fired after used changed value.
 */
export declare class PersonDataInput extends HofHtmlElement {
    value: string;
    label: string;
    change: any;
    constructor();
    styles: string;
    templates: string;
}
