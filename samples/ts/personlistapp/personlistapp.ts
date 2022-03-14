import { HofHtmlElement, html } from "../../../lib/esm/hof.js";
import "./person-data.js";


class AppRoot extends HofHtmlElement {
    templates = html`
        <person-data></person-data>
    `
}

customElements.define("app-root", AppRoot)