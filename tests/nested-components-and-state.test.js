import { HofHtmlElement, html, htmlForList } from "../lib/esm/hof.js";

let personStore = null;
let personData = null;
let personNameInput = null;
let personAgeInput = null;
let personList = null;
let personInfo = null;

function getBirthday(person) {
    let birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - person.age);

    return birthday.toLocaleDateString();
}

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

    personStore = {
        selected: new Person(),
        persons: [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)],

        changeName(value) { this.selected.name = value; },
        changeAge(event) { this.selected.age = event.target.value; },

        create() { this.selected = new Person(); },
        edit(person) { this.selected = { ...person }; },
        remove(person) { this.persons.splice(this.findIndex(person), 1); this.create(); },
        save() {
            if (this.selected.id) // Existing person?
                this.persons.splice(this.findIndex(this.selected), 1, this.selected);
            else
                this.persons.push(new Person(this.selected.name, this.selected.age));

            this.create();
        },
        findIndex(person) { return this.persons.findIndex(p => p.id == person.id);  },
    }

    class PersonDataInput extends HofHtmlElement {
        value = "";
        label = "";
        change = null;

        constructor() {
            super("label")
        }

        styles = `
            input { color: blue; }
        `;

        templates = [
            html(() => `${this.label}: <input value="${this.value}" onchange="${this.change}" />`)
        ]
    }

    customElements.define("person-data-input", PersonDataInput)
    

    class PersonDataList extends HofHtmlElement {
        // Property
        persons = [new Person("Alex", 21), new Person("Chris", 19), new Person("Mike", 19)];

        // Derived property
        get _filteredPersons() { return this.persons.filter(p => p.age > 20) } 

        // Enum constants
        WEEKDAYS = ["Monday", "Tuesday", "Wednesday"];

        // Helper Function
        getBirthday(person) {
            let birthday = new Date();
            birthday.setFullYear(birthday.getFullYear() - person.age);

            return birthday.toLocaleDateString();
        }

        get _filteredPersonsLength() { return this.persons.length; }

        test() {
            return "<h1>Hi</h1>"
        }

        edititem = null;

        deleteitem = null;

        styles = `

        `;

        templates = [
            html(() => `${this._filteredPersons.length > 1 ? this.test() : `<h1>${this._filteredPersons.length}</h1>`}`),
            htmlForList(this._filteredPersons, (person, index, updated) => `
                <li>
                    [${index+1}] ${person.name} - ${person.age} years (updated: ${updated})
                    [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
                    [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
                </li>`, "ul"
            ),
            html(() => `<h2>Full list</h2>`),
            htmlForList(this.persons, (person, index, updated) => `
                <li>
                    ${person.name} - ${person.age} years (birthday: ${this.getBirthday(person)})
                    [<a href="#" onclick="${() => this.edititem(person)}">Edit</a>]
                    [<a href="#" onclick="${() => this.deleteitem(person)}">Delete</a>]
                    ${updated ? "(update)" : ""}
                </li>`, "ul"
            ),

            html(() => `First rendering, expression: ${this.persons.length} ${this.WEEKDAYS}`)
        ];
    }

    customElements.define("person-data-list", PersonDataList)

    class PersonDataInfo extends HofHtmlElement {
        value = [];

        templates = [
            html(() => `
                <br/><br/>Person Info
                <li>First Person: ${(this.value[0]?.name ?? "-") + " (" + (this.value[0]?.age ?? "") + ")"}</li>
                <li>Last Person: ${(this.value[this.value.length-1]?.name ?? "-") + " (" + (this.value[this.value.length-1]?.age ?? "") + ")"}</li>
            `)
        ];
    }

    customElements.define("person-data-info", PersonDataInfo)

    class PersonData extends HofHtmlElement {
        personStore = personStore;

        constructor() {
            super();
            
            // fetch('https://jsonplaceholder.typicode.com/todos?_limit=10')
            //    .then(response => response.json()).then(list => list.map(todo => new Person(todo.title, todo.id))).then(x => this.personStore.persons = x);             

            this.personStore.persons = [{"id":7,"name":"delectus aut autem","age":1},{"id":8,"name":"quis ut nam facilis et officia qui","age":2},{"id":9,"name":"fugiat veniam minus","age":3},{"id":10,"name":"et porro tempora","age":4},{"id":11,"name":"laboriosam mollitia et enim quasi adipisci quia provident illum","age":5},{"id":12,"name":"qui ullam ratione quibusdam voluptatem quia omnis","age":6},{"id":13,"name":"illo expedita consequatur quia in","age":7},{"id":14,"name":"quo adipisci enim quam ut ab","age":8},{"id":15,"name":"molestiae perspiciatis ipsa","age":9},{"id":16,"name":"illo est ratione doloremque quia maiores aut","age":10}];
        }
        
        templates = [
            html(() => `
                <fieldset>
                    <person-data-input label="Name" value="${this.personStore.selected.name}" change="${(event) => this.personStore.changeName(event.target.value)}"></person-data-input>
                    <person-data-input label="Age" value="${this.personStore.selected.age}" change="${(event) => this.personStore.changeAge(event)}"></person-data-input>
                    <button onclick="${this.personStore.save}">Speichern</button>
                </fieldset>                    

                ${this.personStore.persons.length} persons in list
                <person-data-list persons="${this.personStore.persons}" edititem="${this.personStore.edit}" deleteitem="${this.personStore.remove}"></person-data-list>
                
                <a href="#" onclick="${this.personStore.create}">Neu</a>

                <person-data-info value="${this.personStore.persons}"></person-data-info>  
            `)
        ]
    }

    customElements.define("person-data", PersonData)
    
    personData = document.createElement("person-data");
    document.body.appendChild(personData);

    console.dir(personData.shadowRoot)

    personNameInput = personData.shadowRoot.querySelectorAll("person-data-input")[0];
    personAgeInput = personData.shadowRoot.querySelectorAll("person-data-input")[1];
    personList = personData.shadowRoot.querySelectorAll("person-data-list")[0];
    personInfo = personData.shadowRoot.querySelectorAll("person-data-info")[0];
});

test("check initial rendering", () => {
    expect(personData.shadowRoot.innerHTML).toMatch(`${personStore.persons.length} persons in list`);
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(
        new RegExp(personStore.persons.map(x => `${x.name} - ${x.age} years \\(birthday: ${getBirthday(x)}\\)[\\s\\S]+`).join(""), "gm"));
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `First Person: ${personStore.persons[0].name} (${personStore.persons[0].age})`);
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `Last Person: ${personStore.persons[personStore.persons.length-1].name} (${personStore.persons[personStore.persons.length-1].age})`);
});

test("add array element", () => {
    // Input data for new person and save person data
    personNameInput.shadowRoot.querySelector("input").value = "Test";
    personNameInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personAgeInput.shadowRoot.querySelector("input").value = "23";
    personAgeInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personData.shadowRoot.querySelector("button").dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch(`11 persons in list`);
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(
        new RegExp(personStore.persons.map(x => `${x.name} - ${x.age} years \\(birthday: ${getBirthday(x)}\\)[\\s\\S]+`).join(""), "gm"));
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `First Person: ${personStore.persons[0].name} (${personStore.persons[0].age})`);
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `Last Person: ${personStore.persons[personStore.persons.length-1].name} (${personStore.persons[personStore.persons.length-1].age})`);
});

test("edit array element", () => {
    personList.shadowRoot.querySelectorAll("a")[2].dispatchEvent(new Event('click'));

    // Input data for selected person and save person data
    personNameInput.shadowRoot.querySelector("input").value = "x";
    personNameInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personAgeInput.shadowRoot.querySelector("input").value = "121";
    personAgeInput.shadowRoot.querySelector("input").dispatchEvent(new Event('change'));
    personData.shadowRoot.querySelector("button").click();

    expect(personData.shadowRoot.innerHTML).toMatch("11 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).toMatch(new RegExp(`x - 121 years \\(birthday: ${getBirthday({age: 121})}\\)`, "gm"));
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `First Person: ${personStore.persons[0].name} (${personStore.persons[0].age})`);
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `Last Person: ${personStore.persons[personStore.persons.length-1].name} (${personStore.persons[personStore.persons.length-1].age})`);
});

test("delete array element", () => {

console.log(personList.shadowRoot.querySelectorAll("a")[14].parentNode.innerHTML)
    expect(personData.shadowRoot.innerHTML).toMatch("11 persons in list");
    personList.shadowRoot.querySelectorAll("a")[15].dispatchEvent(new Event('click'));

    expect(personData.shadowRoot.innerHTML).toMatch("10 persons in list");
    expect(personNameInput.shadowRoot.querySelector("label").innerHTML).toMatch("Name");
    expect(personNameInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personAgeInput.shadowRoot.querySelector("label").innerHTML).toMatch("Age");
    expect(personAgeInput.shadowRoot.querySelector("input").value).toMatch("");
    expect(personList.shadowRoot.innerHTML).not.toMatch(new RegExp(`6 years`, "gm"));
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `First Person: ${personStore.persons[0].name} (${personStore.persons[0].age})`);
    expect(personInfo.shadowRoot.innerHTML).toMatch(
        `Last Person: ${personStore.persons[personStore.persons.length-1].name} (${personStore.persons[personStore.persons.length-1].age})`);
});