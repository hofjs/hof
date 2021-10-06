export class Person {
    constructor(name, age) {
        if (typeof (name) != "undefined" && typeof (age) != "undefined")
            this.id = Person.counter++; // Neues Objekt bekommt neue ID
        else
            this.id = ""; // Temporäres Objekt bekommt keine ID
        this.name = name || "";
        this.age = age || "";
        this.address = { street: "Test" };
    }
}
Person.counter = 1;
