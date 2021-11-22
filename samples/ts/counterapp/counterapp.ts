// Important: In order for resolution to work in the browser without additional loaders like tsloader
// library with js suffix must be included here (because there is no file named hof or hof.ts in the lib folder)
import { component } from "../../../lib/esm/hof.js";

const counterStore = {
    value: 10,

    valueBeforeChanged(newValue) {
        if (newValue <= 20)
            return true;
        else
            return false;
    },

    valueAfterChanged(newValue, oldValue) {
        console.log(newValue);
        console.log(oldValue);
    },

    increment() { this.value++; }, 
    decrement() { this.value--; },

    // Live update
    doubled: function() { return this.value * 2 }

    // doubled() {
    //     return this.value * 2;
    // },
};

component("counter-component", {
    counterStore,

    // counterStoreBeforePropertyChanged(propName, newValue, oldValue) {
    //     console.log(propName + ": " + newValue);
    //      return false;
    // },
              
    render() {
        const tripled = () => this.counterStore.value * 3;
        
        const self = this;
        function quadrupeled() {
            return self.counterStore.value * 4;
        }

        return () => `
            <div>${new Date()}</div>
            <div>Count: ${this.counterStore.value} <button onclick="${() => this.counterStore.value++}">++</button></div>
            <div>Double count (updated): ${this.counterStore.doubled()+1}</div>
            <div>Triple count (updated): ${-tripled()}</div>
            <div>Quadrupled count (not updated): ${quadrupeled()}</div>
        `;
    }
});