import { component } from "../lib/esm/hof.js";

let personData = null;
let personNameInput = null;
let personAgeInput = null;
let personList = null;
let personInfo = null;

beforeAll(() => {
    class Person {
        constructor(name, age) {
            if (typeof(name) != "undefined" && typeof(age) != "undefined")
                this.id = Person.counter++; // Neues Objekt bekommt neue ID
            else
                this.id = ""; // Temporäres Objekt bekommt keine ID

            this.name = name || "";
            this.age = age || "";
        }
    }
    Person.counter = 1;

    component("person-data-input", {
        value: "",
        label: "",
        change: null,

        render() {
            return () => `${this.label}: <input value="${this.value}" onchange="${this.change}" />`;
        }
    }, "label");
  
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

    const PersonData = component("person-data", {
        selected: new Person(),
        persons: [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)],

        changeName(value) { this.selected.name = value; },
        changeAge(event) { this.selected.age = event.target.value; },

        create() { this.selected = new Person(); },
        edit(person) { this.selected = { ...person }; }, // Copy object to avoid live update on text change
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
                    <person-data-input id="personNameInput" label="Name" value="${this.selected.name}" change="${(event) => this.changeName(event.target.value)}"></person-data-input>
                    <person-data-input id="personAgeInput" label="Age" value="${this.selected.age}" change="${(event) => this.changeAge(event)}"></person-data-input>
                    <button onclick="${this.save}">Speichern</button>
                </fieldset>                    
                
                ${this.persons.length} persons in list
                <person-data-list id="personList" persons="${this.persons}" edititem="${this.edit}" deleteitem="${this.remove}"></person-data-list>
                
                <a href="#" onclick="${this.create}">Neu</a>

                <person-data-info id="personInfo" value="${this.persons}"></person-data-info>  
            `;
        }
    });

    document.body.innerHTML = `<person-data id="personData"></person-data>`;

    personData = document.getElementById("personData");
    personNameInput = personData.shadowRoot.getElementById("personNameInput");
    personAgeInput = personData.shadowRoot.getElementById("personAgeInput");
    personList = personData.shadowRoot.getElementById("personList");
    personInfo = personData.shadowRoot.getElementById("personInfo");
});

test("check initial rendering", () => {  
    expect(personData.shadowRoot.innerHTML).toMatch("3 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/Alex - 21 Jahre.*Chris - 19 Jahre.*Mike - 19 Jahre/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: Alex (21)");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: Mike (19)");
});

test("add array element", () => {
    // Input data for new person and save person data
    personNameInput.shadowRoot.querySelector("input").value = "Test";
    personNameInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personAgeInput.shadowRoot.querySelector("input").value = "23";
    personAgeInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personData.shadowRoot.querySelector("button").dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch("4 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/Alex - 21 Jahre.*Chris - 19 Jahre.*Mike - 19 Jahre.*Test - 23 Jahre/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: Alex (21)");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: Test (23)");
});

test("edit array element", () => {
    personList.shadowRoot.querySelectorAll("a")[2].dispatchEvent(new Event('click'));

    // Input data for selected person and save person data
    personNameInput.shadowRoot.querySelector("input").value = "x";
    personNameInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personAgeInput.shadowRoot.querySelector("input").value = "121";
    personAgeInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personData.shadowRoot.querySelector("button").click();

    expect(personData.shadowRoot.innerHTML).toMatch("4 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/Alex - 21 Jahre.*x - 121 Jahre.*Mike - 19 Jahre.*Test - 23 Jahre/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: Alex (21)");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: Test (23)");
});

test("delete array element", () => {
    personList.shadowRoot.querySelectorAll("a")[5].dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch("3 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/Alex - 21 Jahre.*x - 121 Jahre.*Test - 23 Jahre/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: Alex (21)");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: Test (23)");

    personList.shadowRoot.querySelectorAll("a")[5].dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch("2 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/Alex - 21 Jahre.*x - 121 Jahre/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: Alex (21)");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: x (121)");

    personList.shadowRoot.querySelectorAll("a")[1].dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch("1 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/x - 121 Jahre/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: x (121)");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: x (121)");

    personList.shadowRoot.querySelectorAll("a")[1].dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch("0 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(/<div><\/div>/s);
    expect(personInfo.shadowRoot.innerHTML).toMatch("First Person: - ()");
    expect(personInfo.shadowRoot.innerHTML).toMatch("Last Person: - ()");
});