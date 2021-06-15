# Hof - High Observability Framework

Hof is a modern framework for the development of Single Page Applications, which breaks with many current approaches and allows a development close to the web standards.

## Key features
Hof has the following advantages, among others:
* **Extremely simple implementation** of complex apps based on Web Components and other web standards such as template strings is supported, which means that only minimal code is required to write even complex components and apps.
* **Automatic deep state management** of variables, i.e. persons.push(newPerson) or even person.address.name=newName are recognized and lead to the rerendering of the UI - but only exactly those parts of the UI that depend on person.address.name - and all this without the overhead of a Virtual DOM or Virtual Proxies.
* **Incremental augementation of existing web applications** because individual components can be added to any web application created with another framework, as they are just web components.
* **Functional development is supported** as an alternative to class-based approaches.
* **Easy start of development with no dependencies is possible**, because no transpiler, CLI or tool is needed.  It is enough to include the framework which is only a few KB in size.
* **IDEs provide best support even without extensions/plugins** since the code is pure JS.

## State of this framework

This framework is in early alpha and not production ready. Features can change at any time. Use at your own risk.

## Introductory example

### Implementation of a simple counter component

```js
 component("counter-component", {
    count: 10,

    render() {
        return () => `
            <div>Counter: ${this.count}</div>
            <button onclick="${() => this.count++}">++</button>`;
    }
});
```
Description:
* Function **component()** is used to create a new Web Component with tag **&lt;counter-component&gt;**.
* Property **count** with **default value 10** is created. This gets **automatically exposed as attribute and property**.
* In function **render**, **markup is returned** as a lazy evaluable function:
    * **Properties and functions** can be easily **referenced in template strings**.
    * **A change** of a property automatically **rerenders** the component - but **only the smallest part that depends on the property**, in the example the div element.

Main advantages:
* **No special syntax** has to be learned:
  * **Pure HTML with standard attributes** instead of composition syntx like JSX with special attribute names
  * **Pure template strings with ${} expressions** instead of special binding syntax such as {binding}, [binding], ...
  * **No magic keywords or directives** such as ng-if, ...
* **Attributes** are **named** as in **regular HTML markup**:
  * **Pure HTML element attributes** instead of JS attribute names (onclick instead of onClick) and no special constructs like @click, on:click etc.
* **State tracking** of variables is **automatically handled** by the framework:
  * **Variables do not have to be made trackable** first via approaches like useState() or proxies, but a new value can be assigned directly via this.variable.
  * **If a state variable is changed**, the **smallest part of the UI** that depends on the state variable **is rerendered**, in the example the content of the div element.
* **Simple development** is supported:
  * **No transpiler infrastructure** is needed as valid JavaScript is used directly.
  * **IDEs provide best support even without extensions/plugins** since the code is valid JS.

## Complex example with nested components

In this example a complete CRUD application to manage a list of persons is implemented - demonstrating component nesting, advanced state management, propagation and hoisting.

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
* **Event handlers do not require any special features** either, but **can simply be passed to a component via attribute**. It is possible to pass a function defined in the component, such as create or edit, or to specify an ad hoc Arrow function on the spot.
* As you can see in changeName and changeAge, **it is not necessary to copy the original object like in other frameworks**, so that the framework notices a change and executes a new rendering. **For instance, no statement such as this.persons = [...persons, newPerson] is needed here to register a change to the original object**. This is automatically handled by the framework and makes development easier, more efficient and less error-prone.
* The supported **state tracking is so powerful that it works even for deeply nested objects**, unlike other frameworks. For example, **for a person.address.street object, street could be changed and all parts of the UI that depend on it would be automatically re-rendered**. The state tracking is smart enough that, for example, if person.address is changed, parts of the UI that depend on person.address.street or person.address.zip are automatically rerendered, but not the parts of the UI that depend on person.company.
* Although **state tracking** is extremely powerful in this framework, it **has no significant drawbacks in terms of performance**, since no dynamic proxies are used, but only the actually bound parts of a data object are made partially observable via an approach that was specifically designed for this use case.

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

### Local variables
In addition to properties, **local variables can also be bound**. To do this, these **must be specified as parameters after the returned render expression**, as shown in the example.

```js
render() {
  const someVariable = "World"

  return [() => `Hello ${someVariable}`, {someVariable}];
}
```
Like properties, **local variables also support deep observability**. Additionally, **multiple variables can be provided**. However local variables should be avoided in favor of simple render functions and component nesting.

### Derived properties

In addition, **derived variables** can also be defined, which **are automatically recalculated and trigger a partial rerendering whenever one of the dependent variables or properties changes its value**. Derived properties are simply defined by writing a function that works with some other variables or properties. To achieve reactive updating, the **live helper is used in the markup**.

```js
render() {
  const ageDoubled = () => this.data.selectedPerson.age * 2;

  return [() => `<br/><br/>
          <person-data-input value="${live(ageDoubled)} || ''" onchange="${(event) => this.changeAge(event)}"></person-data-input>            
  `, {ageDoubled}];
}
```
Whenever this.data.selectedPerson.age changes, e.g. by a simple assignment of a new value (e.g. this.data.selectedPerson.age = 20), ageDoubled is automatically changed as well and the part of the UI that depends on this variable is rerendered.

It is important here that also with derived properties a deep observability exists, i.e. also if subproperties of a variable change, changes are tracked, derived properties are recalculated and depending parts of the UI are rerendered.

### Side effects

**Side effects can be used to define functionality that is to be executed whenever a state variable changes**. This is also done by simply writing a function and using the **live helper** in the markup. Usually the side effects are noted at the beginning of the markup.

```js
render() {
  const selectedPersonSideEffect = () => console.dir(this.data.selectedPerson);

  return [() => `<br/><br/>
    ${live(selectedPersonSideEffect)}
        
    <fieldset>
      ...
    </fieldset>                    
    `, {selectedPersonSideEffect}];
}
```

A classic side effect should never return a value. Even if a derived property is required and functionality could be executed at the same time as with a side effect, this should be separated from each other, i.e. a separate side effect should be defined.

It is important here that also with side effects a deep observability exists, i.e. also if subproperties of a variable change, changes are tracked and side effects executed.

## Why a new framework?

**Current popular frameworks** offer powerful concepts for the implementation of component-oriented applications. However, the components they realize are framework-specific constructs and do not conform to the Web Component standards by default. For most frameworks, this brings the **following disadvantages**:
* **No use of individual created components** in a Web application without the complete associated framework to use and/or the Web application on it to convert
* **Need to learn a complete framework with its own concepts**, with the knowledge becoming obsolete in case the respective framework dies.
* **Knowledge about pure modern JS falls into the background.**
* **Partially problematic interoperability with framework-external components like WebComponents** (e.g. problematic two-way binding in connection with Custom Elements)
* **Binding of properties and events is solved differently depending upon framework** and it is worked with attributes deviating from the regular HTML element attributes, e.g. prefix "on".

In addition, **popular frameworks have significant limitations in terms of state management and binding capabilities**:
* **Missing simple state tracking**: If a state variable persons is used and a person is added, the frameworks usually require a new object to be assigned, e.g. persons = [...persons, newPerson]. This is inefficient, cumbersome and error-prone.
* Also, **changes in deep object structures must be manually accounted for by the developer**, since the state tracking of modern frameworks does not register a change to person.address.name=newName, i.e., there is no rerendering of the components referencing the name property as well (not even a full rendering). This limitation applies even to modern transpiler approaches.
* Also, **no simple JS code can be written if stateful components are to be implemented**, since special constructs like useState() are needed for this. The latter is only addressed by transpiler approaches, but does not allow pure JS development, but always requires a transpiler.
* Also, **some approaches require a Virtual DOM**, which can also bring performance disadvantages compared to an optimized implementation with direct DOM access.

However, frameworks are usually preferred to pure web standard solutions, since the development of web components is relatively complex due to the general API. Features of modern web development such as data binding are also completely missing here. In addition, frameworks also offer the necessary libraries and tooling to implement complex applications professionally.

## Installation

Hof can be installed by including the script file Hof.js. That's all that is required.

## Documentation

Due to the early stage of development of this framework, no documentation exists yet. However, since it is very much based on JavaScript and web standards and allows intuitive development, the above explanations are usually sufficient to use all framework features.

You can contribute by sending pull requests to [this repository](https://github.com/walterkern/hof).


## License

Hof is [MIT licensed](./LICENSE).
