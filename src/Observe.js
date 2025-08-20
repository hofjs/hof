import { filter, isPrimitive, DEF } from "./helper.js";
import { GLOBAL_OPTIONS } from "./gloabalOptions.js";


const { meta_key_default: meta_key, root_key_default: root_key,
    objectify_key_default, root_disable_events_key, path_key_default: path_key,
    EventType, Event_key_default, cancel_prop, use_instead,cascade } = GLOBAL_OPTIONS.metaInfos;

const obs_key = '__obs';
const shared_paths_key = '__shared_paths';

// for fix pseudo prop (enumerable by default false, just for clarity explite )
const fix = { writable: true, enumerable: false, configurable: true }

/**If you set something with this class, like obj.xxx = Delete , it calls delete obj.xxx and send an Delete event 
 * Addresses the lack of events on delete
 * ```
 * //Bad -> Observe Logic gets no event and key still there in '::meta' object
 * delete colors.A
 * //Ok, value in '__meta' obj undefined, but still there
 * colors.A = undefined; delete colors.A
 * //Best, sends Delete event and deletes key
 * colors.A = Delete 
 * ``` 
*/
export class Delete { }

/** Allows to force update, despite values still strictly equal  */
export class ForceUpdate {
    static __force_update = 0;
    static get next(){
        this.__force_update++;
    }
    static set for(val){
        this.__force_update = val;
    }
}

function get({ key, is_prim, }) {
    //If meta key and root and  objectifey exist -> retrun obj version with path info
    if (this[meta_key]?.[root_key]?.[meta_key]?.[objectify_key_default]) {
        const cur = this?.[meta_key]?.[key];
        if (isPrimitive(cur)) {
            const obj_wrap = new cur.constructor(cur);
            const __meta = this[meta_key];
            obj_wrap[meta_key] = { [root_key]: __meta?.[root_key], [path_key]: __meta?.[path_key] };
            return obj_wrap;
        }
    }
    return this[meta_key][key];
}
function set({ key, is_prim, }, v) {
    const __meta = this[meta_key];
    const old_val = __meta[key];

    const path = this[meta_key]?.[path_key] ?? '';

    if (old_val === v && ForceUpdate.__force_update<=0) {
        return
    }
    if(ForceUpdate.__force_update){ForceUpdate.__force_update--}

    const new_path = path && [...path, key];
    const __root = this[meta_key]?.[root_key];
    //If something was chnaged in Before Change, this prop will give the after Change the unmodified v. Tjis is good if you write back attr and always apply some tranfrom to the value
    let before_val;
    let propagate_up,propagate_down;
    //Before event -> you may reject the set 
    if (__root && __root[meta_key][root_disable_events_key] !== true) {
        const event = ChangeEvent(this[meta_key], new_path, { target: this, target_key: key, old_val, new_val: v, type: EventType.before });
        if (event[cancel_prop]) { return }
        if (event[use_instead] !== Symbol.for('untouched')) { before_val = v; v = event[use_instead] }
        propagate_up = event.propagate_up;
        propagate_down = event.propagate_down;
    }
    const old_prim = isPrimitive(old_val);
    if (!old_prim && __root?.[meta_key]?.[shared_paths_key]?.size) {
        cleanSelfFromSharedObs(__root, new_path);
    }

    const is_delete = v === Delete;
    if (is_delete) {
        delete __meta[key];//underlying prop
        delete this[key]; //GSetter 
    }
    else {

        //Set underlying prop new value v
        DEF(__meta, key, { value: v, ...fix });

        //Add obervibility to set objects
        if (!isPrimitive(v)) {

            //Update the paths if they are differents and you come from splice
            if (v[meta_key] && v[meta_key][root_disable_events_key]  ) {
                const new_path = [...path, key];
                if (!v[meta_key].__path?.every((old_path_prop, i) => old_path_prop === new_path[i])) {
                    updateSub(v[meta_key], new_path);
                }
            }

            const option = ObservOption(__meta, key);
            option.__root_shareable = true;
            option.replace_path = new_path;
            option.trigger = 'set';
            //Note: Spreading on metakey obj does not work, cause all meta props are enumerable:false
            makeDeepObservable(__meta[key], option);

        }
    }
    //After event -> for html rerender
    if (__root && __root[meta_key][root_disable_events_key] !== true) { 
        const event = { value: v,  target: this, target_key: key, old_val, before_val, };
        if(Array.isArray(old_val) ){
            event.old_len = old_val.length;
        }
        if(is_delete){
            event.trigger =  'delete'
        }
        if(propagate_down){
            event.propagate_down=propagate_down;
        }
        if(propagate_up){
            event.propagate_up=propagate_up;
        }
        ChangeEvent(this[meta_key], new_path,event ) 
    }

}
function ObservOption(__meta, key) {
    return { __root: __meta[root_key], __path: [...__meta[path_key], key], __obs: __meta[obs_key], }
}

/**a Change event, it returns the event with modified props, how to interpret the result */
function ChangeEvent(__metaObj, path, event_obj) {
    const __root = __metaObj?.[root_key];
    const events_disabled = __root?.[meta_key]?.[root_disable_events_key];
    if (!__root || events_disabled) return undefined;
    event_obj.path ||= path// __metaObj?.[path_key]
    event_obj.type ??= EventType.after;
    event_obj.trigger ??= 'set';
    const method = `${event_obj.type}${Event_key_default}`

    //Would prevent that stores without change do something
    // if (!__root?.[method]) { return { only_hook: true } }

    //After Events are curretnly only hooks, ?maybe automaicly resate the observers after events
    if (event_obj.type === EventType.after) {
        __root?.[method]?.call(__root, event_obj);
        if (!__root[meta_key][obs_key]) return;
        msgShared(__root, path, event_obj, method)
        return;
    }
    const b_event = event_obj;
    b_event[cancel_prop] = false;
    b_event[use_instead] = Symbol.for('untouched');
    b_event[cascade] = true;
    
    let b_hook_return;
    b_hook_return = __root?.[method]?.call(__root, b_event);

    //early out
    if(beforeEventAborted(b_event,b_hook_return)){
        return b_event;
    }

    if (__root[meta_key][obs_key]){
        const is_aborted =  msgShared(__root, path, b_event, method,true);
    }
    return b_event;
}

/**Checks if aborted and sets internal event flags */
function beforeEventAborted(b_event,b_hook_return){
    //Cancel
    if(b_event[cancel_prop] == true)return true;
    
    if (b_hook_return === false) {
        b_event[cancel_prop] = true;
        return true;
    } else if(b_hook_return!==undefined && b_hook_return!==true){
        b_event[use_instead] = b_hook_return;
    }
    //Stop cascade
    if(!b_event[cascade])return true;

    //Use res as replacement value  but do not abort
    if (b_event[use_instead] !== Symbol.for('untouched')) {
        b_event[use_instead] = b_hook_return;
    }
    //Pass
    // if(b_hook_return===undefined|| b_hook_return===true)return false;
    return false;
}

function capitalize(str){return str[0].toLocaleUpperCase()+str.slice(1)}
/**Go over all your Observers */
function msgShared(__root, path, event, method,beforeAbort = false, seen = new WeakSet()) {
    if (!__root[meta_key][obs_key]) return;

    let b_hook_return;
    //Send the event to the shared obj
    if(event.target){
        const methodJoin = capitalize(method);
        b_hook_return = event.target[path.at(-1)+methodJoin]?.call?.(__root,event);
        if(beforeAbort&& beforeEventAborted(event,b_hook_return)){
            return true;
        }
    }

    /**@type {Map<string, StartGroup>} */
    const groups = __root[meta_key][obs_key].groups;

    if (seen.has(groups)) return;
    seen.add(groups);
    //Go over all shared groups, the key of the map is the path from the perspective of the Components|Observers
    for (const [start_path_str, startGroup] of groups) {
        const start_path = start_path_str === "" ? [] : start_path_str.split('.');
        //Don't emit events, where the event path is in a different branch than the start 
        if (!isSubPath(path, start_path)) continue

        for (const [path_str, pathGroup] of startGroup) {
            const path_split = path_str.split(".");
            event.path = [...path_split, ...path.slice(start_path.length)];
            for (const obs of pathGroup) {
                if(obs.isConnected === false){ 
                    pathGroup.delete(obs);
                    continue;
                }
                b_hook_return =  obs?.[method]?.(event);
                if(beforeAbort&& beforeEventAborted(event,b_hook_return)){
                    return true;
                }
                //Msg your Observers
                if (obs[meta_key][obs_key]) {
                    // avoid that the path is modified during nested msgShared
                    const path_tmp = event.path;
                    const aborted =  msgShared(obs, event.path, event, method, beforeAbort, seen);
                    event.path = path_tmp
                    if(beforeAbort && aborted)return true;
                }
            }
        }
    }
}

/**
 * @typedef { {
 *    share_root:any,
 *    root_start:String[],
 *    groups:Map<string,StartGroup>
 * } } ShareRoot 
 * @typedef { Map<string,Set<any>> } StartGroup 
 */

/** Makes a object deeply observable
 * @param {*} obj - the obj you want to observe
 * @param {Object} options
 * @param {string[]} [options.only] - only makes these keys observable  
 * @param {boolean} [options.filterOnlyFirstLevel] - applires filter only to the first level -> !!!needed efficient for splice, push   
 * @param {(string|RegExp)[]} [options.not] - do not make thes keys observable !!! works on all levels
 * @param {string[]} [options.__root] - the ref to the root obj, here on are the changeevents called  (.__root),\
 * **!! Events need the __root to be set, otherwise they don't trigger !!** 
 * @param {string[]} [options.__path] - the path (.__path), that is attached to the meta prop, will be used for events
 * @param {string[]} [options.__root_shareable] - if the root can be a shared obj
 * @param {string[]} [options.replace_path] - This tells the observe function what part of the object was replaced in the last set Event.
 * If you reassign a subobject of yourself, it may already contain __root and __path that either aren't up to date or must be transformed into shared roots.
 * The replace_path is need to determine what do do with this 
 * @param {string[]} [options.trigger] - This tells if it origianted from a Set. Important for same reason as replace_path
 * @param {string[]} [options.has_shared_parent] -If it has shared parent - will not create any share roots on initial gsetter make  
 */
export function makeDeepObservable(obj, options = {}, maxDepth = 30, seen = new WeakMap()) {
    if (maxDepth < 0) { throw Error("Recursion to deep") }

    if (obj == null || obj == undefined || isPrimitive(obj)) {
        return
    }

    //Default values
    const { only, not, filterOnlyFirstLevel=false,replace_path = [], __root_shareable = false, trigger,has_shared_parent=false } = options;
    let { __root = obj?.[meta_key]?.[root_key] ?? obj, __path = obj?.[meta_key]?.[path_key] ?? [], } = options;

    options.replace_path = replace_path;
    //next Recursion has always no root
    options.__root_shareable = true;

    if (!obj[meta_key] && Array.isArray(obj)) {
        ObservableArrayExtra(obj, options);
    }

    //for selfreferential obj
    seen.set(obj, true);

    //Give the object a meta prop obj as store for underlying props if it has none
    if (!obj[meta_key]) {
        DEF(obj, meta_key, { value: {}, ...fix });
    }


    //If obj got a new __obs map for shared owner. Need recursive update for all child
    let needs_obs_upd = false;

    //Give metakey the root resolve existing roots
    if (__root) {
        const base_root = obj[meta_key][root_key];
        if (!has_shared_parent&& isShared(obj, __root, base_root, __path, replace_path, __root_shareable, trigger)) {
            let is_share_init = !obj[meta_key][obs_key];
            if (is_share_init) {
                DEF(obj[meta_key], obs_key, {
                    value: {
                        groups: new Map(),
                        higher_shRoots: "Not Yet IMPL",
                    }, ...fix
                });

                //Shared objects have themselves as root
                DEF(obj[meta_key], root_key, { value: obj, ...fix });
                needs_obs_upd = true;
            }
            /**@type {ShareRoot} */
            const shRoot = obj[meta_key][obs_key];


            //If deeper in shared the __path is already the relativ path from the shared root
            const path_in_shared = obj[meta_key]?.[path_key] ?? __path;
            const path_str = path_in_shared.join('.');

            //Also add former root
            if (is_share_init && base_root && base_root !== obj) {
                //Start path if for inital [] -> ""
                shRoot.groups.set("", new Map([[path_str, new Set([base_root])]]));

                //Give the base root the location it now has a shared obj, so it can later remove it 
                if (!base_root[meta_key][shared_paths_key]) {
                    DEF(base_root[meta_key], shared_paths_key, { value: new Map() });
                }
                const shared_paths = base_root[meta_key][shared_paths_key];
                shared_paths.set(path_str, "");
            }
            const shared_path_str = __path.join(".");
            const start_path = is_share_init ? [] : [...path_in_shared];
            const start_path_str = start_path.join('.');
            /**@type {StartGroup} */
            const startGroup = shRoot.groups.get(start_path_str) ??
                shRoot.groups.set(start_path_str, new Map()).get(start_path_str);

            const pathGroup = startGroup.get(shared_path_str) ??
                startGroup.set(shared_path_str, new Set()).get(shared_path_str);
            pathGroup.add(__root);

            //Give the root the location it now has a shared obj, so it can later remove it 
            if (!__root[meta_key][shared_paths_key]) {
                DEF(__root[meta_key], shared_paths_key, { value: new Map() });
            }
            const shared_paths = __root[meta_key][shared_paths_key];
            shared_paths.set(shared_path_str, start_path_str);

            __root = obj;
            __path = start_path;
            options.has_shared_parent=true;
        }
        else if (!base_root) {
            DEF(obj[meta_key], root_key, { value: __root, ...fix })
        }
    }

    //Give metakey the path
    if (__path && !obj[meta_key][path_key]) {
        DEF(obj[meta_key], path_key, { value: [...__path], ...fix })
    }

    if (needs_obs_upd) {
        updateSub(obj[meta_key], [], obj,)
        // updateObs(obj[meta_key], obj[meta_key][obs_key]);
    }

    //The options will be used for child Objects as basis for next Recursion Call. Threrfore if default root used attach it back to options  
    options.__root = __root;

    let iter_keys =  only? only.filter?.(item=>item.constructor.name!==RegExp.name): Object.getOwnPropertyNames(obj);
    const only_regexs=only?.filter?.(item=>item.constructor.name===RegExp.name);
    if(only_regexs?.length>0){
        iter_keys.push(... Object.getOwnPropertyNames(obj).filter(key=> only_regexs.some(only_re=>only_re.test(key))));
    }
    if (not) { iter_keys = filter(iter_keys, not) }


    const is_share_root = !!obj?.[meta_key]?.[obs_key];
    // if(is_share_root )return;
    const is_arr = Array.isArray(obj);
    for (const key of iter_keys) {
        let prop = obj[key];
        const is_prim = isPrimitive(prop);

        let old_desc = Object.getOwnPropertyDescriptor(obj, key);

        const is_shared = !is_prim ? isShared(prop, __root, undefined, [...__path, key], replace_path, true, trigger) : false;
        if ((is_arr && key == 'length') || key == meta_key) continue

        if (!is_shared && (old_desc && (old_desc?.get || old_desc?.set || old_desc?.writable == false || old_desc?.configurable == false))) {
            continue
        }

        let new_desc = { enumerable: old_desc?.enumerable ?? true, configurable: true }

        DEF(obj[meta_key], key, { value: prop, ...fix });


        const gsetter_bounds = { key, is_prim, };

        if (!is_prim) {
            //is itself obj -> go over all children
            let go_deeper = true;

            if (seen.has(prop)) {
                go_deeper = is_shared || false;
            }
            if (!needs_obs_upd && go_deeper) {
                makeDeepObservable(prop, { ...options, __path: __path && [...__path, key], only:filterOnlyFirstLevel?undefined:only }, maxDepth - 1, seen);
            }

        }
        DEF(obj, key, {
            get: get.bind(obj, gsetter_bounds),
            set: set.bind(obj, gsetter_bounds), ...new_desc
        });
    }


}

function ArrSetLast(v) { this[this.length - 1] = v; }
function ArrGetLast() { return this.length > 0 ? this[this.length - 1] : undefined; }

//Splice works fine with current setter, only need to set length after splicing to underlying prop
function splice(...args) {
    const __meta = this[meta_key];
    const __path = this[meta_key]?.[path_key];
    const __root = this[meta_key]?.[root_key];
    const root_meta = __root[meta_key];

    let [index, deleteCount = 0, ...inserts] = args;
    const old_len = __meta.length;
    // splices interprets it as Number regardles, so use 0 on NaN 
    index = Number(index) || 0;
    deleteCount = Number(deleteCount) || 0;
    if (index < 0) { index = old_len + index }
    const range = [index, old_len];
    
    //If length does not change make the end of range only up to the changed elements
    const size_unchanged = inserts.length === deleteCount;
    if (size_unchanged) {
        range[1] = index + 1;//end is exclusiv
    }
    //nothing to update
    if(range[0]===range[1]  &&inserts.length===0){return}

    //if you have [].splice(i,1,{...}) emit a Change event for only the spefified index
    const compressed_to_one = size_unchanged && inserts.length === 1;

    let old_val = compressed_to_one ? this[meta_key][index] : undefined;

    //disable events and fire them all together later, when to not yet G|Setter exist
    const old_ev_state = root_meta?.[root_disable_events_key];

    DEF(root_meta, root_disable_events_key, { value: true, configurable: true, enumerable: false, writable: true });

    //Clean potential shared Objects
    cleanSelfFromSharedObs(__root, __path, range);

    const res = Array.prototype.splice.call(this, ...args);

    root_meta[root_disable_events_key] = old_ev_state;

    if (this.length > __meta.length) {
        const only = new Array(this.length - old_len).fill(0).map((x, i) => i + old_len).map(x => "" + x);
        makeDeepObservable(this, { only,filterOnlyFirstLevel:true, __path });
    }
    else {
        __meta.length = this.length;
    }

    //Only send out a One element changed, this case is often used with splice, and a single item change is more efficient, then an arrayRoot change 
    if (compressed_to_one) {
        const meta_at_i = this[index][meta_key];
        const path = meta_at_i?.[path_key] ?? [...__path, "" + index];
        ChangeEvent(meta_at_i ?? this[meta_key], path, { old_len, trigger: 'splice', target: this, target_key: index, value: this[meta_key][index], old_val })
        return res;
    }
    ChangeEvent(this[meta_key], __path, { range, old_len, trigger: 'splice',splice_info:{start:index,deleteCount} , target: this, value: this[meta_key] })
    return res
}
function pop(...args){
    return this.splice(-1,1,);
}
function push(...args) {
    //nothing to update
    if(args.length===0){return}
    const old_len = this.length;
    const res = Array.prototype.push.call(this, ...args);
    //After push, replace the last element with on g|setter
    const only = new Array(this.length - old_len).fill(0).map((x, i) => i + old_len).map(x => "" + x);
    //use the path of the array itself, not the keys
    const __path = this[meta_key]?.[path_key];

    makeDeepObservable(this, { only,filterOnlyFirstLevel:true, __path });
    //Also gives value, only for symmetry reason
    ChangeEvent(this[meta_key], __path, { range: [old_len, this.length], old_len, trigger: 'push', target: this, value: this[meta_key] })
    return res;
}
//Return your own Setter with bound args -> allows automatic call: arr.push = 56 -> arr.push(56)
function ReturnSetterFnProp(prop) {
    return Object.getOwnPropertyDescriptor(this, prop).set;
}

function ObservableArrayExtra(arr, options = {}) {
    if (!arr[meta_key]) {
        DEF(arr, meta_key, { value: [], ...fix })
    }

    DEF(arr, '-1', { set: ArrSetLast.bind(arr), get: ArrGetLast.bind(arr), enumerable: false, configurable: true });
    DEF(arr, 'splice', { value: splice.bind(arr), ...fix });
    // DEF(arr, 'push', { value: push.bind(arr,bound_arg), ...fix});
    DEF(arr, 'push', { set: push.bind(arr), get: ReturnSetterFnProp.bind(arr, 'push'), enumerable: false, configurable: true });
    DEF(arr, 'pop', { set: pop.bind(arr), get: ReturnSetterFnProp.bind(arr, 'pop'), enumerable: false, configurable: true });

}

/**Determins if a obj should be treated as a shareRoot */
function isShared(obj, root, base_root = obj?.[meta_key]?.[root_key], __path, replace_path, __root_shareable, trigger) {
    //Via Anno in shared obj-> simplest but needs manuall effort;
    if (obj['__shared']) return true;
    //No sharing if you are the obj makeDeepObs... is called upon
    if (!__root_shareable) return false;
    //Don't do it for the special -1 Array Getter, to avoid all array obj are shared
    if (__path[__path.length-1]==-1) return false;
    //Not during Array events
    if(root?.[meta_key]?.[root_disable_events_key] === true){return false }
    //When it has already a root, check if it is reaasigned via set or shared  
    if (base_root) {
        //is a shared root itself
        if (base_root[meta_key]?.[obs_key]) {
            return true
        }
        if (root === base_root) {
            //Where in this obj was this one before 
            const old_path = obj[meta_key]?.[path_key];
            //Was reassigned via set
            if (trigger === "set" && isSubPath(old_path, replace_path)) {
                return false;
            }
            return true;
        }
        //Other base_root -> already observed by other -> shared
        else {
            return true;
        }
    }


    //Otherwise, look if it has a Change Event and you are no HTMLElement (They always have Change Ev and should not be shared by default)
    if (obj.__is_HofElement) return false;
    return !!(obj[EventType.after + Event_key_default] || obj[EventType.before + Event_key_default])
}
/**Tests, if a path is a sub path of a given root path
 * @example
 *  isSubPath( ['user', 'address','loc'], ['user','address']  )  >>true
 *  isSubPath( ['user', 'address','loc'], ['person']  )  >>false
 * @param {string[]} sub @param {string[]} root 
 */
function isSubPath(sub, root, not_same = false) {
    if (not_same && sub.length > root.length) return false;
    for (let i = 0; i < root.length; i++) {
        if (root[i] !== sub[i]) return false;
    }
    return true;
}


/**Goes over all Subdependencise in the meta object and updates them if a given new value is not falsish. 
 * This occurs when a already observed obj is assigned to an observable one, often after splice
 * or when a share Root is created or changes
 *  */
function updateSub(meta_obj, new_path, new_root, new_obs, max_iter = 30, seen = new WeakSet()) {
    if (max_iter < 0) throw Error("Recursion to deep");
    seen.add(meta_obj);

    if (new_path) {
        DEF(meta_obj, path_key, { value: [...new_path], ...fix })
    }
    if (new_root) {
        DEF(meta_obj, root_key, { value: new_root, ...fix })

    }

    // if (new_obs && meta_obj[obs_key] !== new_obs) {
    //     DEF(meta_obj, obs_key, { value: new_obs, ...fix })
    // }

    for (const key of Object.getOwnPropertyNames(meta_obj)) {
        if (key.startsWith("__") || key == meta_key) continue
        if (seen.has(meta_obj[key])) continue
        //Don*t go into share roots
        if (meta_obj[key]?.[meta_key]?.[obs_key]) continue
        //Look for sub objects with meta key
        if (meta_obj[key]?.[meta_key]) {
            updateSub(meta_obj[key][meta_key], new_path && [...new_path, key], new_root, new_obs, max_iter-1);
        }
    }
}

export function cleanSelfFromSharedObs(root, new_path, range) {
    const root_meta = root[meta_key];
    if(!root_meta) return;
    const shared_paths = root_meta[shared_paths_key];
    if (!shared_paths) return;

    const new_path_str = new_path.join('.');
    for (const [path, start] of shared_paths) {
        if (path.startsWith(new_path_str)) {
            const path_split = path.split(".");

            //end of range is exclusiv
            if (range && (path_split[new_path.length] < range[0] || path_split[new_path.length] > range[1])) { continue }

            //get the obj at the path, to get the shared obj
            let obj = root;
            for (let i = 0; i < path_split.length; i++) { obj = obj[path_split[i]] }
            if(!obj)continue
            const shared_obj_meta = obj[meta_key][root_key][meta_key];
            if(shared_obj_meta[obs_key]){
                const startGroup = shared_obj_meta[obs_key].groups.get(start);
                const pathGroupSet = startGroup?.get?.(path);
                if(pathGroupSet){

                    pathGroupSet.delete(root);
                    if (pathGroupSet.size === 0) {
                        startGroup.delete(path);
                        if (startGroup.size === 0) {
                            shared_obj_meta[obs_key].groups.delete(start);
                        }
                    }
                }
            }
            shared_paths.delete(path);

        }
    }
    return true;
}
// let user = {
//     "name": "Impa",
//     "age": 999,
//     "narr":{'narr223':89,age:999,game:'K',other:'unobs',},
//     "address": { name: "Kakariko Village", zip: 889, sector: 'vulkan-A2' },
//     "friends": [
//         "Zelda", { name: 'Gallen', age: 99 }
//     ],
//     "game": "The Legend of Zelda",
//     "occupation": "Royal Advisor",
//     "nestArr": [12, '34', [-1, [1, 2, 3], 4, 5], 42, 27, 'str'],
//     "race": "Sheikah",
//     fib: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
//     beforeChanged(event) {
//         console.log("Bevor Change", event, 'this value in event:', this);
//         const { path, old_val, new_val } = event;
//         if (path.at(-1) === 'age') { if (old_val > new_val) event[use_instead] = false }
//     },
//     afterChanged(event) {
//         console.log('After change event', event, 'this value in event:', this);
//         return false;
//     },
//     testFn() {
//         return this.name + ";age" + this.age;
//     }

// };

// makeDeepObservable(user, { only:['game',/^(na|ag)/] ,not: [/Changed/], });


// "use strict";
// user['#friends'] =[1,1,]; // throws TypeError: "#***" props are read-only


// publish(makeDeepObservable, isSubPath
//     //  { name: 'user', primitiv: user }
// );