export class Person {
    constructor(name = "", age = "") {
        this.name = name;
        this.age = age;
        this.id = (name && age) ? Person.counter++ : "";
        this.name = name;
        this.age = age;
    }
}
Person.counter = 1;
