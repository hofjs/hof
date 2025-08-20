import { css, Delete, HofElement, HofOptions, html, makeDeepObservable ,nohtml} from "../../lib/esm/hof.js";

// hooks also work in stores
const repo = {
    data:"Data Data Data",

    dataBeforeChanged(ev){
        console.log("Data change",ev);
        // hint: this == event.target  ==  repo 
        if(ev.new_val.length<5 ){
            console.log('rejected data.length < 5');
            repo.rejected = 'data.length < 5';
            return false;
        } else {
            repo.rejected = false;
        }
    },
    num: 42,
    rejected: false,
}

class HookDemo extends HofElement {
    name = "Nemo M";
    nameInvalid = "";
    repo = repo;// register ctx as member prop

   
    nameAfterChanged( ev ){
        console.log(this.nameAfterChanged.name, ev.target_key) // "name"
    }
    // Guard
    nameBeforeChanged(ev){
        console.log( "old",ev.old_val, "new",ev.new_val )
        if(!ev.new_val.match(/\S+\s+\S+/)){
            console.error( ev.new_val, "invalid, abort change" );
            this.nameInvalid = "Name needs first and last name";
            return false
            // Correction -> will use non boolean reutrn value as replacement
            return ev.new_val.toLowerCase();
        }
        this.nameInvalid="";
    }

    list = ['alpha','beta','gamma'];
    listAfterChanged( ev ){
        console.log(this.listAfterChanged.name, ev.target_key) // "list"|"1"|"2"|"3" or any runtime key on the array
    }
    
    address = {
        loc: "Bikini Atoll",
        geo: [43.42, 58.12,],
        street: "Avenue 9.",
 
        // Side note: nested hook also works -- better rename of parent obj
        locBeforeChanged( ev ){ console.log('locBeforeChanged to:',ev.new_val) }
    };
    addressBeforeChanged( ev ){
        console.log( this.addressBeforeChanged.name,  'cascaded from prop: ', ev.target_key);// "address"|"loc"|"geo"|"street" or any dynamiclly added and observed key e.g. this.address= {other:42}
    }

    template = html`
    <p> 
        Name: ${this.name}
        <span style="color:red">${this.nameInvalid}</span> 
    </p>
    <p>name: <input value=${this.name}></p>  
    <p>
        list: ${this.list.join('; ')}  
        <p> list[2]: <input value=${this.list[2]}></p>
    </p>
    <p>
        address: ${ JSON.stringify(this.address) } 
    </p>
    <p>address.loc: <input value=${this.address.loc}></p>

    <p>
        repo: ${ JSON.stringify(  this.repo  ) } 

    </p>
    <p>repo.data: <input value=${ this.repo.data }></p>
    `;
 }
 

 customElements.define('hook-demo',HookDemo);
