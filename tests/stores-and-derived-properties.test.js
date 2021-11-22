import { component } from "../lib/esm/hof.js";

let CounterComponent = null;
let counterStore = null;
let counter1 = null;
let counter2 = null;

beforeAll(() => {
    counterStore = {
        // Regular property: If count changes, only depending parts of html are updated
        count: 1,
    
        // Derived property: If count changes, inverted changes too
        // and depending parts of html are updated
        inverted: function() { return -this.count; },
    
        // Regular method: This is not tracked and only evaluated on first rendering
        doubled() {
            return this.count * 2;
        },
    
        // Regular method: This is not tracked
        increment() {
            this.count++;
        },
    };
    
    const counterComponentImplementation = {
        counterStore,
        
        render() {
            // Derived variable as lambda expression: If count changes, tripled automatically
            // changes too and depending parts are updated
            const tripled = function() { return this.counterStore.count * 3; };
    
            // Derived variable as function, indirectly depending on count
            const currentDate = function() { return new Date() || this.counterStore.count }
            
            // Regular variable: This ist not tracked
            const PI = 3.14;
    
            // Regular function: This is not tracked and only evaluated once
            function someFunction() {
                return this.counterStore.count;
            }
    
            return () => `
                <div>First rendered: ${new Date()}</div>
                <div>Last update of count: ${currentDate()}</div>
                <button onclick="${this.counterStore.increment}">++</button>
                <button onclick="${() => this.counterStore.count--}">--</button>
    
                <ul>
                    <li>Count: ${this.counterStore.count}</li>
                    <li>Inverted (updated): ${this.counterStore.inverted()}</li>
                    <li>Doubled + 1 (not updated): ${this.counterStore.doubled() + 1}</li>
                    <li>Tripled * 2 (updated): ${tripled() * 2}</li>
                    <li>PI (not updated): ${PI}</li>
                    <li>SomeFunction (not updated): ${someFunction()}</li>
                </ul>
            `;
        }
    };
    CounterComponent = component("counter-component", counterComponentImplementation);
});

beforeEach(() => {
    counterStore.count = 1;
    counter1 = document.body.appendChild(new CounterComponent());
    counter2 = document.body.appendChild(new CounterComponent());
});

afterEach(() => {
    document.body.innerHTML = "";
    counter1 = null; counter2 = null;
});

test("counter store property update reflects on UI of component that triggered update", () => {
    counter1.counterStore.count = 10;

    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Count: 10</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -10</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 60</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});

test("counter store property update reflects on UI of component that did not trigger update", () => {
    counter1.counterStore.count = 20;

    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Count: 20</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -20</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 120</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});

test("counter store method call reflects on UI of component that triggered method", () => {
    counter1.counterStore.increment();

    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Count: 2</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -2</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 12</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});

test("counter store method call reflects on UI of component that did not trigger method", () => {
    counter1.counterStore.increment();

    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Count: 2</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -2</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 12</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});