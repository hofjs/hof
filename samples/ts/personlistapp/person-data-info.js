import { component } from "../../../lib/esm/hof.js";
export const PersonDataInfo = component("person-data-info", {
    value: [],
    render() {
        return () => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return `
            <br/><br/>Person Info
            <li>First Person: ${((_b = (_a = this.value[0]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "-") + " (" + ((_d = (_c = this.value[0]) === null || _c === void 0 ? void 0 : _c.age) !== null && _d !== void 0 ? _d : "") + ")"}</li>
            <li>Last Person: ${((_f = (_e = this.value[this.value.length - 1]) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : "-") + " (" + ((_h = (_g = this.value[this.value.length - 1]) === null || _g === void 0 ? void 0 : _g.age) !== null && _h !== void 0 ? _h : "") + ")"}</li>
        `;
        };
    }
});
