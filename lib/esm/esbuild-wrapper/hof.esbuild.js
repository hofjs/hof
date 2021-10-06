// File, which is used to import library via regular import mechanism
// but then adding imported entities to the window object
// so that even without modules the JavaScript code will be executed
// and can be used directly in a web application (this file is used
// by esbuild to create nomodule version of this library)
// Import elements of library
import { HofHtmlElement, component } from '../hof';
// Make elements of library accessible on the window object
window.HofHtmlElement = HofHtmlElement;
window.component = component;
