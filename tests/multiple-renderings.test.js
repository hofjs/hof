import { component } from "../lib/esm/hof.js";

let todoList = null;

beforeAll(() => {
    component("todo-list", {
        selected: {},
        todos: [{ title: "Todo 1", done: true, }, { title: "Todo 2", done: false, }],

        edit(todo) { this.selected = todo; },

        render() {
            return [
                [() => `${this.todos.length} todos in the list`],
                [this.todos, (todo) => 
                    `<li>
                        ${todo.title} - ${todo.done}                            
                        [<a href="#" onclick="${() => this.edit(todo)}">Edit</a>]
                    </li>`
                ],
                [() => `Current selection: ${this.selected?.title ?? "-"}`]
            ]
        }
    }, "label");

    document.body.innerHTML = `<todo-list id="todoList"></todo-list>`;

    todoList = document.getElementById("todoList");
});

test("check initial rendering", () => {  
    expect(todoList.shadowRoot.innerHTML).toMatch("2 todos in the list");
    expect(todoList.shadowRoot.innerHTML).toMatch(/Todo 1 - true.*Todo 2 - false.*Current selection: -/s);
});

test("check selection change", () => {  
    todoList.shadowRoot.querySelectorAll("a")[0].dispatchEvent(new Event('click'));
    expect(todoList.shadowRoot.innerHTML).toMatch("2 todos in the list");
    expect(todoList.shadowRoot.innerHTML).toMatch(/Todo 1 - true.*Todo 2 - false.*Current selection: Todo 1/s);

    todoList.shadowRoot.querySelectorAll("a")[1].dispatchEvent(new Event('click'));
    expect(todoList.shadowRoot.innerHTML).toMatch("2 todos in the list");
    expect(todoList.shadowRoot.innerHTML).toMatch(/Todo 1 - true.*Todo 2 - false.*Current selection: Todo 2/s);
});