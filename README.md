# Hof.js - High Observability Framework

**Hof.js** is a **modern framework** for the development of **Single Page Applications**. It is an **open source project of Hof University of Applied Sciences** and **was created by Prof. Dr. Walter Kern**.

Contact us if you are a student of Hof University of Applied Sciences and would like to contribute.

## Contact
* Organization: https://www.hof-university.de
* Mail: hofjs@hof-university.de
* Impressum / Imprint: https://www.hof-university.de/impressum.html

## Key features
This framework has the following advantages, among others:
* **Extremely simple implementation** of apps based on Web Components and other web standards.
* **Deep state observability, including arrays and nested properties**, i.e. persons.push(newPerson) or person.address.name=newName are recognized and re-render only depending parts of the UI.
* **Incremental enhancement of existing web applications** because individual components can be added to any web application created with another framework, as they are just web components.
* **Stores can simply be implemented by using pure JS** instead of special libraries because the deep observability functionality of this frameworks makes concepts like that obsolete.
* **Easy start of development**, since no transpiler, CLI or tool is needed. It is enough to include the framework which is only a few KB in size.
* **IDEs provide best support even without extensions/plugins** since the code is pure JS.

## Introductory example

The following example shows a simple counter component that demonstrates key features such as derived properties and automatic ui rerendering based on property changes.

**simple-counter.js**

```js
customElements.define("simple-counter", class extends HofHtmlElement {
    // Property (exposed as html attribute and js property)
    count = 10;

    // Derived property (gets recalculated on change of this.count)
    get doubled() { return this.count * 2; }

    // Regular method (not observed)
    increment() { this.count++; }

    // Each reference to a property gets automatically observed
    // (if a property changes exactly that part of ui gets updated)
    templates = html`
        <div>Count: ${this.count}</div>
        <div>Inverse count: ${-this.count}</div>
        <div>Doubled count: ${this.doubled}</div>
        
        <button onclick="${this.increment}">++</button>
        <button onclick="${() => this.count--}">--</button>
    `;
})
```

**index.html**

```html
<!DOCTYPE html>
<html>
<head>
    <title>Simple counter app</title>
    <script src="../../lib/nomodule/hof.js"></script>
    <script src="simple-counter.js"></script>
</head>
<body>
    <h1>Simple counter app</h1>
    <simple-counter></simple-counter>
</body>
</html>
```

## Routing

Routing is supported by [HofRouter](https://github.com/hofjs/hofrouter), a class specifically designed to be used with this framework. HofRouter also focusses on web standards based usage.

This means you can use classic &lt;a&gt; elements instead of special router components. To achieve this, you can specify the destination routes for links using a router protocol. Alternatively, programmatic routing is possible via the HofRouter class.

Similar to the illustrated observability concepts, there are also hooks that are called before or after navigation and that can be used to cancel navigation. Additionally, nested routing of arbitrary level is supported.


## Installation

**Hof.js can be installed by using npm**.

```
npm install @hofjs/hofjs
```

This **package contains builds in esm, cjs and nomodules formats**. While cjs is suitable for server-side JS projects (Node projects), esm is the standard for client-side JS projects. To support older browsers without JS module support or to realize a small web application without requiring JavaScript modules, the nomodules variant can be used.

The following examples show the **different import alternatives**.

```js
import { HofHtmlElement, html } from "pathToNodeFolderOfApp/node_modules/@hofjs/hofjs/lib/esm/hof";
```

```js
const { HofHtmlElement, html } = require("pathToNodeFolderOfApp/node_modules/@hofjs/hofjs/lib/cjs/hof");
```

```html
<script src="pathToNodeFolderOfApp/node_modules/@hofjs/hofjs/lib/nomodule/hof.js"></script>
```

## Usage

Minimal esm example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Minimal demo</title>
    <script type="module">
        // Inline JS - should be outsourced to external file.      
        import { HofHtmlElement, html } from "../lib/esm/hof.js";

        customElements.define("main-app", class extends HofHtmlElement {
            templates = html`<h1>Hello at ${new Date()}</h1>`
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

const { HofHtmlElement, html } = require("../lib/esm/hof.js");

customElements.define("main-app", class extends HofHtmlElement {
    templates = html`<h1>Hello at ${new Date()}</h1>`
});

...
```


Minimal nomodules example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Counter app</title>
    <script src="../lib/nomodule/hof.js"></script>
    <script>    
        // Inline JS - should be outsourced to external file.      
        customElements.define("main-app", class extends HofHtmlElement {
            templates = html`<h1>Hello at ${new Date()}</h1>`
        });
    </script>
</head>
<body>
    <main-app></main-app>
</body>
</html>
```

There is also a [starter template](https://github.com/hofjs/starter) available for new projects that includes all required packages and supports Hot Module Reloading.


## Documentation

The documentation with a step-by-step guide can be found at https://github.com/hofjs/hofjs.github.io.

You can contribute by sending pull requests to [this repository](https://github.com/hofjs/hof).


## License

Hof.js is [MIT licensed](./LICENSE.md).