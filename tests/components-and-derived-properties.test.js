import { HofHtmlElement } from "../lib/esm/hof.js";

let counterStore = null;
let counter1 = null;
let counter2 = null;

beforeAll(() => {
    counterStore = {
        // Regular property: If count changes, only depending parts of html are updated
        count: 1,

        countBeforeChanged(newValue, oldValue) {
            console.log(`counterStore.countBeforeChanged: ${oldValue} -> ${newValue}`);
            if (newValue <= 20)
                return true;
            else
                return false;
        },

        countAfterChanged(newValue, oldValue) {
            console.log(`counterStore.countAfterChanged: ${oldValue} -> ${newValue}`);
        },

        // Derived property: If count changes, inverted changes too
        // and depending parts of html are updated
        get inverted() { return -this.count; },

        // Regular method: This is not tracked and only evaluated on first rendering
        doubled() {
            return this.count * 2;
        },

        // Regular method: This is not tracked
        increment() {
            this.count++;
        },
    };

    class ChildComponent extends HofHtmlElement {
        test = null;
        value = null;

        valueBeforeChanged(newValue, oldValue) {
            console.log(`ChildComponent.valueBeforeChanged: ${oldValue} -> ${newValue}`);
            if (newValue % 2 == 0)
                return true;
            else
                return false;
        }

        valueAfterChanged(newValue, oldValue) {
            console.log(`ChildComponent.valueAfterChanged: ${oldValue} -> ${newValue}`);
        }

        testBeforeChanged(newValue, oldValue) {
            console.log(`ChildComponent.testBeforePropertyChanged: ${oldValue} -> ${newValue}`);
            if (newValue % 3 == 0)
                return true;
            else
                return false;
        }

        templates = [
            () => `Value: ${this.value}, ${this.test}`
        ];
    }
    customElements.define("child-component", ChildComponent)

    class CounterComponent extends HofHtmlElement {
        counterStore = counterStore;
        value = 0;

        counterStoreBeforeChanged(newValue, oldValue) {
            console.log(`CounterComponent.counterStore.counterStoreBeforeChanged: ${oldValue} -> ${newValue}`);
        }

        counterStoreBeforePropertyChanged(prop, newValue, oldValue) {
            console.log(`CounterComponent.counterStore.counterStoreBeforePropertyChanged: Property ${prop}: ${oldValue} -> ${newValue}`);
        }

        counterStoreAfterPropertyChanged(prop, newValue, oldValue) {
            console.log(`CounterComponent.counterStore.counterStoreAfterPropertyChanged: Property ${prop}: ${oldValue} -> ${newValue}`);
        }
        
        templates = [
            () => `
                <div>First rendered: ${new Date()}</div>
                <button onclick="${this.counterStore.increment}">++</button>
                <button onclick="${() => this.counterStore.count--}">--</button>

                <ul>
                    <li>Count: ${this.counterStore.count}</li>
                    <li>Inverted (updated): ${this.counterStore.inverted}</li>
                    <li>Doubled + 1 (not updated): ${this.counterStore.doubled() + 1}</li>
                </ul>

                Value: ${value}

                <child-component test="${this.counterStore.count}" value="${this.counterStore.count}"></child-component>
            `
        ];
    }
    customElements.define("counter-component", CounterComponent)
});

beforeEach(() => {
    counterStore.count = 1;
    counter1 = document.createElement("counter-component");
    counter2 = document.createElement("counter-component");
    
    document.body.appendChild(counter1);
    document.body.appendChild(counter2);
});

afterEach(() => {
    document.body.innerHTML = "";
    counter1 = null; counter2 = null;
});

test("value component property update reflects on UI of components that triggered update", () => {
    counter1.value = 20;

    expect(counter1.shadowRoot.innerHTML).toMatch("Value: 20");
});

test("value component property update does not reflects on UI of other components that did not trigger update", () => {
    counter2.value = 40;

    expect(counter1.shadowRoot.innerHTML).toMatch("Value: 0");
});

test("counterStore.count component property update reflects on UI of all components that reference counterStore", () => {
    counterStore.count = 10;

    expect(counter1.shadowRoot.innerHTML).toMatch("Count: 10");
    expect(counter1.shadowRoot.innerHTML).toMatch("Inverted (updated): -10");
    expect(counter1.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");

    expect(counter2.shadowRoot.innerHTML).toMatch("Count: 10");
    expect(counter2.shadowRoot.innerHTML).toMatch("Inverted (updated): -10");
    expect(counter2.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");
});

test("counterStore.increment component method call reflects on UI of all component that reference counterStore", () => {
    counterStore.increment();

    expect(counter1.shadowRoot.innerHTML).toMatch("Count: 2");
    expect(counter1.shadowRoot.innerHTML).toMatch("Inverted (updated): -2");
    expect(counter1.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");

    expect(counter2.shadowRoot.innerHTML).toMatch("Count: 2");
    expect(counter2.shadowRoot.innerHTML).toMatch("Inverted (updated): -2");
    expect(counter2.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");
});

test("counterStore.count component property update reflects on UI of component that triggered update", () => {
    counter1.counterStore.count = 10;

    expect(counter1.shadowRoot.innerHTML).toMatch("Count: 10");
    expect(counter1.shadowRoot.innerHTML).toMatch("Inverted (updated): -10");
    expect(counter1.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");
});

test("counterStore.count component property update does reflect on UI of other component that uses store", () => {
    counter1.counterStore.count = 10;

    expect(counter2.shadowRoot.innerHTML).toMatch("Count: 10");
    expect(counter2.shadowRoot.innerHTML).toMatch("Inverted (updated): -10");
    expect(counter2.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");
});

test("counterStore.increment component method call reflects on UI of component that triggered method", () => {
    counter1.counterStore.increment();

    expect(counter1.shadowRoot.innerHTML).toMatch("Count: 2");
    expect(counter1.shadowRoot.innerHTML).toMatch("Inverted (updated): -2");
    expect(counter1.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");
});

test("counterStore.increment component method call does reflect on UI of component that did not trigger method", () => {
    counter1.counterStore.increment();

    expect(counter2.shadowRoot.innerHTML).toMatch("Count: 2");
    expect(counter2.shadowRoot.innerHTML).toMatch("Inverted (updated): -2");
    expect(counter2.shadowRoot.innerHTML).toMatch("Doubled + 1 (not updated): 3");
});