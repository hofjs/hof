export class Person {
    id: number|"";

    constructor(public name: string = "", public age: number|"" = "") {
        this.id = (name && age) ? Person.counter++ : "";
        this.name = name;
        this.age = age;
    }

    static counter = 1;
}