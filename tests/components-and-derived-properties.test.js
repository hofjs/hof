import { component } from "../lib/esm/hof.js";

let CounterComponent = null;
let counter1 = null;
let counter2 = null;

beforeAll(() => {
    const counterComponentImplementation = {
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
        
        render() {
            // Derived variable as lambda expression: If count changes, tripled automatically
            // changes too and depending parts are updated
            const tripled = function() { return this.count * 3; };
    
            // Derived variable as function, indirectly depending on count
            const currentDate = function() { return new Date() || this.count }
            
            // Regular variable: This ist not tracked
            const PI = 3.14;
    
            // Regular function: This is not tracked and only evaluated once
            function someFunction() {
                return this.count;
            }
    
            return () => `
                <div>First rendered: ${new Date()}</div>
                <div>Last update of count: ${currentDate()}</div>
                <button onclick="${this.increment}">++</button>
                <button onclick="${() => this.count--}">--</button>
    
                <ul>
                    <li>Count: ${this.count}</li>
                    <li>Inverted (updated): ${this.inverted()}</li>
                    <li>Doubled + 1 (not updated): ${this.doubled() + 1}</li>
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
    counter1 = document.body.appendChild(new CounterComponent());
    counter2 = document.body.appendChild(new CounterComponent());
});

afterEach(() => {
    document.body.innerHTML = "";
    counter1 = null; counter2 = null;
});

test("counter component property update reflects on UI of component that triggered update", () => {
    counter1.count = 10;

    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Count: 10</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -10</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 60</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});

test("counter component property update does not reflect on UI of component that did not trigger update", () => {
    counter1.count = 20;

    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Count: 1</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -1</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 6</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});

test("counter component method call reflects on UI of component that triggered method", () => {
    counter1.increment();

    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Count: 2</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -2</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 12</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter1.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});

test("counter component method call does not reflect on UI of component that did not trigger method", () => {
    counter1.increment();

    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Count: 1</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Inverted (updated): -1</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Doubled + 1 (not updated): 3</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>Tripled * 2 (updated): 6</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>PI (not updated): 3.14</li>");
    expect(counter2.shadowRoot.innerHTML).toMatch("<li>SomeFunction (not updated): 1</li>");
});