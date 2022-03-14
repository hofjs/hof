// Important: In order for resolution to work in the browser without additional loaders like tsloader
// library with js suffix must be included here (because there is no file named hof or hof.ts in the lib folder)
import { HofHtmlElement, html } from "../../../lib/esm/hof.js";

const counterStore = {
    value: 10,

    valueBeforeChanged(newValue) {
        if (newValue <= 20)
            return true;
        else
            return false;
    },

    valueAfterChanged(newValue, oldValue) {
        console.log(newValue);
        console.log(oldValue);
    },

    increment() { this.value++; }, 
    decrement() { this.value--; },

    get inverted() { return -this.value; },

    doubled() { return this.value * 2; },
};

class CounterComponent extends HofHtmlElement {
    counterStore = counterStore;
    
    templates = html`
        <div>First rendered: ${new Date()}</div>
        <button onclick="${this.counterStore.increment}">++</button>
        <button onclick="${() => this.counterStore.value--}">--</button>

        <ul>
            <li>Count: ${this.counterStore.value}</li>
            <li>Inverted (updated): ${this.counterStore.inverted}</li>
            <li>Doubled + 1 (not updated): ${this.counterStore.doubled() + 1}</li>
        </ul>
    `
}
customElements.define("counter-component", CounterComponent)