import {  css, HofElement, html,} from "../../lib/esm/hof.js";


// A normal JS obj can function as a shared store
// (for larger projects you can exprot the store-object from an own file and import it)
const counterStore = {
    count: 42,

    max:100, 
    min:-42,
    inc(){
        if(this.count<this.max)this.count++;
    },
    dec(){
        if(this.count>this.min)this.count--;
    },
    set(newVal){
        this.count= Math.max(this.min,Math.max(this.max, newVal )  );
    },
}

// Register for all, may be simpler
// HofElement.ctx.add( { counterStore } )


class CounterInfo extends HofElement {
    // register as context to recieve change updates
    static ctx = { 
        counterStore,
    }
    label="Count";

    template = html`
        [<button onclick=${counterStore.dec}>--</button>] 
        ${this.label }: ${ counterStore.count }/${ counterStore.max  }
        [<button onclick=${counterStore.inc}>++</button>] 
    `;
}
customElements.define('counter-info',CounterInfo);


class CounterRange extends HofElement {
    // register as context to recieve change updates
    static ctx = { 
        counterStore,
    }
    set(ev){
        counterStore.set(ev.target.value);
    }

    boolProp= false;

    template = html`
        <input type="range" 
            value=${ counterStore.count } 
            min=${counterStore.min}  
            max=${counterStore.max}  
            onchange=${  this.set  }
        >
        [${ counterStore.count }] 
    `;
}

customElements.define('counter-range',CounterRange);





/** You can also use a store as a default value for a prop. This is then shared. 
 *  By specifing a value for the prop the connection is lost.
 */
const defaultPerson = {
    name: "John Doe",
    age:42,
}
const defaultFriend = {
    name: "Jane Dane",
    age:43,
}

Object.assign( window, {defaultPerson,defaultFriend} );

class PersonInfo extends HofElement {
    /**@attr */
    person = defaultPerson;
    
    /**@attr */
    friends = [defaultFriend, defaultFriend, defaultFriend]; 
    
    /** @attr */
    editMode=false;
    
    /** to avoid infinite recursion @attr */
    nested=false;

    init(){
        if(this.nested)this.friends=[];
    }

    template = ({ person:{name,age}, friends,editMode }=this)=>html`
    
    <span contenteditable=${editMode}>${name}</span>
    
    (age=<span  contenteditable=${editMode}>${age}</span>)
    
    <!-- auto toogle button --> 
    <input type="button" value="Edit" checked=${editMode} >
    

    <span class="friends" hidden=${friends.length==0} >
        friends:{
        <span>${
            this.nested || this.__constructing ?'':  friends.map( (friend,i)=>html`
                <person-info nested person=${ friend }></person-info>   
            `
        )
        }</span>
        }
    </span>
    `;

    static style = css`
    &{
        display:block;
        padding: 0.15rem;
        &[nested]{ 
            display: inline;
            &:nth-child(n+2){
                border-left: solid 1px slategrey;
                padding-left:0.5rem;
            }
        }
    }
    
    input[type="button"],[contenteditable] { 
        padding: 0.15rem;
        border: solid 1px #444; 
        border-radius: 0.15rem;
    }
    [checked]{
        background-color: royalblue; 
        color: whitesmoke;
    }
    `;
}
customElements.define("person-info",PersonInfo)