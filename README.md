# Hof.js - High Observability Framework

Hof.js is a modern framework for the development of Single Page Applications, which breaks with many current approaches and allows a development close to the web standards. It was created by Walter Kern and is maintained by [Hof.js contributors](https://github.com/hofjs/hof/graphs/contributors).

## Key features
This framework has the following advantages, among others:
* **Extremely simple implementation** of complex apps based on Web Components and other web standards such as template strings is supported, which means that only minimal code is required to write even complex components and apps.
* **Automatic deep state observability** of variables, i.e. persons.push(newPerson) or even person.address.name=newName are recognized and lead to the rerendering of the UI - but only exactly those parts of the UI that depend on person.address.name - and all this without the overhead of a Virtual DOM or Virtual Proxies.
* **Incremental enhancement of existing web applications** because individual components can be added to any web application created with another framework, as they are just web components.
* **Functional development is supported** as an alternative to class-based approaches.
* **Easy start of development with no dependencies is possible**, because no transpiler, CLI or tool is needed. It is enough to include the framework which is only a few KB in size.
* **IDEs provide best support even without extensions/plugins** since the code is pure JS.

## State of this framework

This framework is in early alpha and not production ready. Features can change at any time. Use at your own risk.

## Introductory example

### Implementation of a simple counter component

```js
component("counter-component", {
    count: 10,

    increment() { this.count++; },

    render() {
        const heading = "Counter";

        return () => `
            <h1>${heading}</h1>            
            <div>Count: ${this.count}</div>
            <button onclick="${this.increment}">++</button>
            <button onclick="${() => this.count--}">--</button>`;
            <div>Last update: ${new Date()}</div>
    }
});
```
Description:
* Function **component()** creates a new Web Component with tag **&lt;counter-component&gt;**.
* Property **count** with **default value 10** is created. This gets **exposed as html attribute and js property**.
* Method **increment** is provided to **add 1** to observed property.
* For decrementation, the method body **this.count--** is provided **inline**.
* In predefined function **render**, **markup is returned** as a lazy evaluable function:
    * **Properties and methods** can be **referenced in template strings**.
    * **A change** of a property **rerenders only the smallest part of the component that depends on the property**, in the example the div element.
    * **Local variables** like **heading** can be used. Like properties, they support **deep observability**. However they should be avoided in favor of simple render functions and component nesting.
    * **Abitrary JS expressions are supported** within template literals, e.g. **new Date()**.

Main advantages:
* **No special syntax** has to be learned:
  * **Pure HTML with standard attributes** instead of composition syntx like JSX with special attribute names
  * **Pure template strings with ${} expressions** instead of special binding syntax such as {binding}, [binding], ...
  * **No magic keywords or directives** such as ng-if, ...
* **Attributes** are **named** as in **regular HTML markup**:
  * **Pure HTML element attributes** instead of JS attribute names (onclick instead of onClick) and no special constructs like @click, on:click etc.
* **Observability** of variables is **automatically handled** by the framework:
  * **Variables do not have to be made trackable** via approaches like useState() or proxies first, but a **new value can be assigned directly via this.variable = newValue**.
  * **If a state variable is changed**, the smallest part of the **UI that depends on the state variable is re-rendered**.
  * **Array changes and sub...subproperty changes are also automatically observable** and re-render exactly the parts of the UI that depend on them.
  * **Calculated properties can simply be defined as pure functions**! Callbacks to value changes are also supported (even in pure JS objects).
* **Simple development** is supported:
  * **No transpiler infrastructure** is needed as valid JavaScript is used directly.
  * **IDEs provide best support even without extensions/plugins** since the code is valid JS.



## Derived and watched properties/variables

### Derived properties/variables

**Derived properties and variables** can be defined, which **are recalculated and trigger a partial rerendering whenever one of the dependent variables or properties changes its value**.

Derived properties are simply **defined by assigning an function instead of an initial value to a named property or variable**. In the example, **inverted** and **tripled** are **automatically recalculated whenever the value of the variable count** changes. 

```js
component("counter-component", {
    // Regular property: If count changes, only depending parts of html are updated
    count: 10,

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
        // Derived variable: If count changes, tripled automatically
        // changes too and depending parts are updated
        const tripled = function() { return this.count * 3; };
        
        // Regular variable: This ist not tracked
        const PI = 3.14;

        // Regular function: This is not tracked and only evaluated once
        function quadrupeled() {
            return this.count * 4;
        }

        return () => `
            <div>Last update: ${new Date()}</div>
            <button onclick="${this.increment}">++</button>
            <button onclick="${() => this.count--}">--</button>

            <ul>
                <li>Count: ${this.count}</li>
                <li>Inverted (updated): ${this.inverted}</li>
                <li>Doubled + 1 (not updated): ${this.doubled() + 1}</li>
                <li>Tripled * 2 (updated): ${tripled * 2}</li>
                <li>Quadrupled (not updated): ${quadrupeled()}</li>
                <li>PI (not updated): ${this.PI}</li>
            </ul>
        `;
    }
});
```

### Watched properties/variables

The framework supports **hooks** to watch property changes and optionally abort them. They have the **name of the property followed by** the suffix **BeforeChanged** or **AfterChanged**. If a **property named count** changes, the **following hooks are called** by the framework:

```js
countBeforeChanged(newValue, oldValue) // called before new value is applied to property - adoption of new value can be aborted by returning false
countAfterChanged(newValue, oldValue) // called if and after new value was successfully applied to property
```

This concept can be illustrated by the following example code which limits the counter to a maximum value of 20.

```js
component("counter-component", {
    // Regular property: If count changes, only depending parts are rerendered
    count: 10,

    countBeforeChanged(newValue, oldValue) {
        if (newValue <= 20)
            return true;
        else
            return false;
    },

    countAfterChanged(newValue, oldValue) {
        console.log(newValue);
    },

    // ...
}
```


## Stores

### Basic concept

In other frameworks, the **concept of stores allows to share state between different components** without the need to pass down state from a parent to various deeply nested child components.

**This framework does not include a store concept, because its deep observability functionality makes concepts like that obsolete.** Simple JavaScript objects can be used to externalize state.

To simplify understanding, corresponding objects are referred to here as Store, even if they are pure JS objects.

The following example illustrates the basic concept.

```js
const counterStore = {
    value: 10,

    increment() { this.value++; }, 
};

component("counter-component", {
    counterStore,
    
    render() {
        let doubled = function() { return this.counterStore.value * 2; }
        return () => `
            <div>${new Date()}</div>
            <div>Count: ${this.counterStore.value}</div>
            <button onclick="${this.counterStore.increment}">++</button>
            <button onclick="${() => this.counterStore.value++}">++</button>
            <div>Double count: ${doubled}</div>
        `;
    }
});
```

Corresponding markup of html page:
```html
<html>
    <head>...</head>
    <body>
        <h1>Counter app (function style)</h1>
        <counter-component></counter-component>
        <counter-component count="20"></counter-component>
    </body>
</html>
```

As you can see, instead of a count variable, an object is used as a property, which is defined outside the component. The object can contain any properties and also methods for defined changing of the properties. The code here works analogous to the previous examples, i.e. when a property of the referenced counterStore is changed, the part of the using component that depends on the changed property is automatically updated. Because both counter components share the same external object, by clicking one of the counter components the other is although updated.

In contrast to other frameworks no special concepts such as mutators or actions are required, because the same observability concept used in components is used here.

All observability concepts explained in the component-oriented examples above are available here. This means derived properties and local variables work not only within a component but also within referenced objects such as the counterStore object. The same applies to the BeforeChanged and AfterChanged hooks.

```js
const counterStore = {
    value: 10,
    doubled: function() { return this.value * 2 },

    valueBeforeChanged(newValue, oldValue) {
        if (newValue <= 20) return true;
        else return false;
    },
    valueAfterChanged(newValue, oldValue) {
        console.log(newValue);
    },

    increment() { this.value++; }, 
    decrement() { this.value--; },
};

component("counter-component", {
    counterStore,
                
    render() {
        return () => `
            <div>${new Date()}b</div>
            <div>Count: ${this.counterStore.value} <button onclick="${() => this.counterStore.value++}">++</button></div>
            <div>Double count + 1: ${this.counterStore.doubled+1}</div>
        `;
    }
});
```

### Advanced hooks

In the above example, the familiar hooks were used within stores. Often, however, it may be a requirement that alternatively or additionally each component that uses a store can decide which value changes it wants to accept from the store. Using the familiar hooks within the component would not help here because they only fire when the property changes. In the above example, the value of the counterStore variable remains the same because only its property value changes.

However, this framework offers **additional hooks** that can be used to react not only to changes in the value of a property, but also to **changes in the value of subproperties**. These are not only usable in the context of stores, but also with classical components with more complex properties, but especially helpful with stores. The following code illustrates the concept.

```js
const counterStore = { ... };

component("counter-component", {
    counterStore,

    counterStoreBeforePropertyChanged(propName, newValue, oldValue) {
        return false;
    },

    counterStoreAfterPropertyChanged(propName, newValue, oldValue) {
        console.log(propName + ": " + newValue);
    },
                
    render() {
        return () => `
            <div>${new Date()}b</div>
            <div>Count: ${this.counterStore.value} <button onclick="${() => this.counterStore.value++}">++</button></div>
            <div>Double count + 1: ${this.counterStore.doubled+1}</div>
        `;
    }
});
```

As you can see, instead of counterStoreBeforeChanged or counterStoreAfterChanged simply **counterStoreBeforePropertyChanged** or **counterStoreAfterPropertyChanged** is used. These hooks return the **affected property as the first parameter** and then the **new and old value as second and third parameter**. The **hook BeforePropertyChanged allows**, analogous to BeforeChanged, **to cancel the transfer of a value** via its return value. Thus the value in the Store can change, but a component can decide independently whether it wants to take over a value or not.

By combination of hooks on level of stores and components thus global restrictions for all using components can be combined with component-specific restrictions.


## Complex example with nested components

An **important feature** of this framework is that **when adding, updating oder deleting elements of an array**, the framework detects this and **updates exactly the part of the UI that is affected** (i.e. even without concepts such as key attributes of other frameworks, **not the entire list is re-rendered, but only an element is inserted, deleted or changed!**). There is **no need for approaches such as list = [...list, newItem]** and so on. The **framework recognizes array alterations such as push, splice** etc.

This concept and many other features such as component nesting, state management, propagation and hoisting will now be demonstrated using a complex CRUD application for managing a list of people.


### Data class "Person"

The code below shows a simple implementation of a class to store a person.

```js

class Person {
    constructor(name, age) {
        if (typeof(name) != "undefined" && typeof(age) != "undefined")
            this.id = Person.counter++; // New object gets new id
        else
            this.id = ""; // Temporary object doesn't get an id

        this.name = name || ""; this.age = age || "";
    }
}
Person.counter = 1;

```

The class **Person** is a **plain old javascript object** and does not use any features of this framework.

### Top level component "&lt;person-data&gt;"

**This component creates a UI with** a list of persons and renders besides the **list of persons also an editing area**, where the data of a selected person of the list can be changed. Using another link, the editing area can be switched to **"New mode"**, which empties the input fields and, after entering data and clicking Save, a new person can be added to the list.
```js
component("person-data", {
    selected: new Person(),
    persons: [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)],

    changeName(value) { this.selected.name = value; },
    changeAge(event) { this.selected.age = event.target.value; },

    create() { this.selected = new Person(); },
    edit(person) { this.selected = person;  },
    remove(person) { this.persons.splice(this.findIndex(person), 1); this.create(); },
    save() {
        if (this.selected.id) // Existing person?
            this.persons.splice(this.findIndex(this.selected), 1, this.selected);
        else
            this.persons.push(new Person(this.selected.name, this.selected.age));

        this.create();
    },
    findIndex(person) { return this.persons.findIndex(p => p.id == person.id);  },
    
    render() {
        return () => `
            <fieldset>
                <person-data-input label="Name" value="${this.selected.name}" onchange="${(event) => this.changeName(event.target.value)}"></person-data-input>
                <person-data-input label="Age" value="${this.selected.age}" onchange="${(event) => this.changeAge(event)}"></person-data-input>
                <button onclick="${this.save}">Speichern</button>
            </fieldset>                    
            
            <person-data-list persons="${this.persons}" edititem="${this.edit}" deleteitem="${this.remove}"></person-data-list>
            
            <a href="#" onclick="${this.create}">Neu</a>

            <person-data-info value="${this.persons}"></person-data-info>  
        `;
    }
});
```

**The above code defines a new Web Component, which composes the whole application**. It includes simple HTML elements as well as other Web Components in its markup:
* The **component person-data-input is referenced to render a label including an input field**. This is used to display and change the name or age of a selected person.
* The **component person-data-list is used to display the current list of persons**.
* As you can see in the code, the **state is simply passed down** by assigning the respective value to an attribute of the Web Component, e.g. the value of this.selected.name is passed to the value attribute of the component person-data-input.
* **Event handlers do not require any special features** either, but **can simply be passed to a component via attribute**.

Hints:
* As you can see in changeName and changeAge, **it is not necessary to copy the original object like in other frameworks**, so that the framework notices a change and executes a new rendering. **For instance, no statement such as this.persons = [...persons, newPerson] is needed here to register a change to the original object**. This is automatically handled by the framework and makes development easier, more efficient and less error-prone.
* The supported **observability is so powerful that it works even for deeply nested objects**, unlike other frameworks. For example, **for a person.address.street object, street could be changed and all parts of the UI that depend on it would be automatically re-rendered**. The implementation is smart enough that, for example, if person.address is changed, parts of the UI that depend on person.address.street or person.address.zip are automatically rerendered, but not the parts of the UI that depend on person.company.


### Data entry component "&lt;person-data-input&gt;"
```js
component("person-data-input", {
    value: "",
    label: "",
    onchange: null,

    render() {
        return () => `${this.label}: <input value="${this.value}" onchange="${this.onchange}" />`;
    }
}, "label");
```

This component defines 3 properties and thus attributes:
* Via **label** the **text to be output** is determined, which tells the user what value to enter, e.g. name or age.
* Via **value** the current and changeable **value is received and bound to an input field**.
* Finally, via **onchange** a callback is received, which **is called when the user has entered a new text value**.
* As a **third parameter to the component function**, "label" is specified to **control the tag that is used as root element of the web component**. If the 3rd parameter is omitted, a "div tag" ist rendered.

### Data list component "&lt;person-data-list&gt;"
```js
component("person-data-list", {
  persons: [],
  
  edititem: null,
  deleteitem: null,
  
  render() {
      return ["persons", (person) =>
          `<li>
              ${person.name} - ${person.age} Jahre                            
              [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
              [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
          </li>`];
  }
});
```

As you can see, the implementation of the list component is very simple:
* A property and thus attribute **persons is defined to receive the list to be displayed**.
* **Additionally 2 properties are defined to receive event handlers** that are called when a user clicks on the corresponding links to the list element.
* If you don't want to returne a simple string, but **generate HTML based on an iterable or array** for each element, then you **simply return an array with the name of the property as the first parameter and the function to be rendered as the second**. In this scenario you can specifiy an parameter in brackets that refers to the element of the current iteration within the template.

### Data info component "&lt;person-data-info&gt;"
```js
component("person-data-info", {
    value: [],

    render() {
        return () => `
            <br/><br/>Person Info
            <li>First Person: ${(this.value[0]?.name ?? "-") + " (" + (this.value[0]?.age ?? "") + ")"}</li>
            <li>Last Person: ${(this.value[this.value.length-1]?.name ?? "-") + " (" + (this.value[this.value.length-1]?.age ?? "") + ")"}</li>
        `;
    }
});
```

This component demonstrates how complex databinding expressions can be. It should be noted that any JS code is possible in an expression.

## More features

This framework offers further features, which will be presented here in an overview.

### Initialization logic

Initialization logic can be specified within the **construct method**.

```js
    component("person-data", {
            // ...

            construct() {
                fetch('https://jsonplaceholder.typicode.com/todos/1')
                    .then(response => response.json())
                    .then(json => this.selected.name = json.title);
            }

            // ...
    });
```

### Services

There is no special feature for the implementation of services. So these can be realized as Plain Old JavaScript Objects. However, it is recommended to retrieve data in the **construct method of the root component** of the app, so that after assigning the asynchronously loaded data to a reactive property, the state is automatically passed to the child components.


```js
    component("person-data", {
            // ...

            construct() {
                fetch('https://jsonplaceholder.typicode.com/todos/1')
                    .then(response => response.json())
                    .then(json => this.selected.name = json.title);
            }

            // ...
    });
```


### Routing

Routing is supported by [HofRouter](https://github.com/hofjs/hofrouter), a class specifically designed to be used with this framework. HofRouter also focusses on web standards based usage. This means you can use classic &lt;a&gt; elements instead of special router components. To achieve this, you can specify the destination routes for links using a router protocol. Alternatively, programmatic routing is possible via the HofRouter class. Similar to the illustrated observability concepts, there are also hooks that are called before or after navigation and that can be used to cancel navigation. Additionally, nested routing of arbitrary level is supported.


### Class style components

As an alternative to the **Function Syntax** shown above, all components can be defined using the **Class Syntax**. This is closer to the implementation and shows the connection to Web Components, since here it is to be derived from a base class.

```js
customElements.define('counter-component', class extends HofHtmlElement {
    constructor() { super('div'); super.useAutoProps(); }

    count = 10;

    render() {
        super.renderContent(() => `
            <div>${new Date()}</div>
            <div>Current value: ${this.count} <button onclick="${() => this.count++}">++</button></div>
        `);
    }
});
```

For details, please refer to the examples.


## Restrictions

Custom elements inherit many events from HtmlElement. If an attempt is made to overwrite a standard event in a custom element, this usually does not work, or even a getter access to set a new event handler causes the property to be executed. Therefore, **in all components implemented using this framework**, classic **event identifiers with prefix "on" should be avoided** and, for example, **instead of "onchange"**, an **event should only be named "change"**.



## Why a new framework?

**Current popular frameworks** offer powerful concepts for the implementation of component-oriented applications. However, the components they realize are framework-specific constructs and do not conform to the Web Component standards by default. For most frameworks, this brings the **following disadvantages**:
* **No use of individual created components** in a Web application without the complete associated framework to use and/or the Web application on it to convert
* **Need to learn a complete framework with its own concepts**, with the knowledge becoming obsolete in case the respective framework dies.
* **Knowledge about pure modern JS falls into the background.**
* **Partially problematic interoperability with framework-external components like WebComponents** (e.g. problematic two-way binding in connection with Custom Elements)
* **Binding of properties and events is solved differently depending upon framework** and it is worked with attributes deviating from the regular HTML element attributes, e.g. prefix "on".

In addition, **popular frameworks have significant limitations in terms of state management and binding capabilities**:
* **Missing simple observability**: If a state variable persons is used and a person is added, the frameworks usually require a new object to be assigned, e.g. persons = [...persons, newPerson]. This is inefficient, cumbersome and error-prone.
* Also, **changes in deep object structures must be manually accounted for by the developer**, since the observability supported by modern frameworks does not register a change to person.address.name=newName, i.e., there is no rerendering of the components referencing the name property as well (not even a full rendering). This limitation applies even to modern transpiler approaches.
* Also, **no simple JS code can be written if stateful components are to be implemented**, since special constructs like useState() are needed for this. The latter is only addressed by transpiler approaches, but does not allow pure JS development, but always requires a transpiler.
* Also, **some approaches require a Virtual DOM**, which can also bring performance disadvantages compared to an optimized implementation with direct DOM access.

However, frameworks are usually preferred to pure web standard solutions, since the development of web components is relatively complex due to the general API. Features of modern web development such as data binding are also completely missing here. In addition, frameworks also offer the necessary libraries and tooling to implement complex applications professionally.

## Installation

Hof.js can be installed by including the nomodule script file hof.js. Additionally modular js builds are available and a TypeScript version.

This framework can also be installed by using npm.

```
npm install @hofjs/hofjs
```

This package contains builds in esm, cjs and nomodules formats. While cjs is suitable for server-side JS projects (Node projects), esm is the standard for client-side JS projects. To support older browsers without JS module support or to realize a small web application without requiring JavaScript modules, the nomodules variant can be used.

The following examples show the different import types.

```js
import { component, HofHtmlElement } from "@hofjs/hofjs/lib/esm/hof";
```

```js
const { component, HofHtmlElement } = require("@hofjs/hofjs/lib/cjs/hof");
```

```html
<script src="pathToNodeFolderOfApp/node_modules/@hofjs/hofjs/lib/nomodule/hof.js"></script>
```

There is also a [starter template](https://github.com/hofjs/starter) available for new projects that includes all required packages and supports Hot Module Reloading.


## Usage

Minimal esm example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Minimal demo</title>
    <script type="module">
        // Inline JS - should be outsourced to external file.
        
        import { component } from "/node_modules/@hofjs/hofjs/lib/esm/hof.js";

        component("main-app", {
            render() {
                return () => `Hello at ${new Date()}`;
            }
        });
    </script>
</head>
<body>
    <p>This must be running on a web server to work, for example the vscode live server.</p>

    <main-app></main-app>
</body>
</html>
```

Minimal cjs example
```js
// window.customElements polyfill must be available to use
// component helper to create component for server-side rendering

const { component } = require("@hofjs/hofjs/lib/cjs/hof");

const AppComponent = component("main-app", {
    render() {
        return () => `Hello at ${new Date()}`;
    }
});

const app = new AppComponent();
...
```


Minimal nomodules example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Minimal demo</title>
    <script src="node_modules/@hofjs/hofjs/lib/nomodule/hof.js"></script>
    <script>
        component("main-app", {
            render() {
                return () => `Hello at ${new Date()}`;
            }
        });
    </script>
</head>
<body>
    <main-app></main-app>
</body>
</html>
```

## Documentation

Due to the early stage of development of this framework, no documentation exists yet. However, since it is very much based on JavaScript and web standards and allows intuitive development, the above explanations are usually sufficient to use all framework features.

You can contribute by sending pull requests to [this repository](https://github.com/hofjs/hof).


## License

Hof.js is [MIT licensed](./LICENSE.md).