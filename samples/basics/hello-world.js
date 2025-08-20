import {  HofElement, html,} from "../../lib/esm/hof.js";



class HelloWorld extends HofElement {
    /*  properties, recievable as HTML attribute */
    name = "N/A";
    
    // declares the HTMl structure
    template = html`
        <h1>Hello World, ${this.name}!</h1> 
        <span>It is ${new Date().toLocaleTimeString()}</span>
    `;
}

// Make as custom tag available
customElements.define("hello-world", HelloWorld );



// Demonstration of dynamic update
/******************** */
window.helloFooBar = document.querySelector("hello-world");

function renameFoobar(newName="Foooo Baaar"){
    helloFooBar.name = newName
} 
window.renameFoobar=renameFoobar;


//Can be called from anywhere e.g. here or in Dev-Tools
// renameFoobar();
// helloFooBar.name += " Bar"



// You can inject an App Root from a JS-file (This even has custom tag and annoted attr autocomplete with the Lit Extension)
// document.body.innerHTML = html`
//    <hello-world name="Foo bar (JS-App Root)"></hello-world>
// `;