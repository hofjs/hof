// Sync object
/** @type {import('@jest/types').Config.InitialOptions} */
export default {
    verbose: true,
    testEnvironment: 'jsdom', /* Important, because otherwise node environment without browser objects such as customElements, HTMLElement etc. is used */
};
