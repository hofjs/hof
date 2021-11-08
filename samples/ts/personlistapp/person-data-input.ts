import { component } from "../../../lib/esm/hof.js";

export const PersonDataInput = component("person-data-input", {
    value: "",
    label: "",
    change: Function,

    render() {
        return () => `${this.label}: <input value="${this.value}" onchange="${this.change}" />`;
    }
}, "label");