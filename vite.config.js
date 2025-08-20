import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';

const noModuleName="HofModule";
/**maunall fix to unpack module to window, so that classes can be used directly  */
const footer = `Object.assign(window,${noModuleName})`;

export default {
  build: {
    // target: ['es2024', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    target: ['es2024'],
    lib: {
      outDir:'lib',
      entry: 'src/HofElement.js',
      
      // formats: ['es', 'iife'],
    },
    rollupOptions: {
      output: [
        {
          format: 'es',
          dir:'lib/esm',
          preserveModules: false,
          entryFileNames: 'hof.js',
        },
        {
          format: 'es',
          dir:'lib/esm',
          preserveModules: false,
          entryFileNames: 'hof.min.js',
          plugins: [terser()],
        },
        {
          format: 'iife',
          dir:'lib/nomodule',
          name: noModuleName,
          footer,
          entryFileNames: 'hof.js',
          // sourcemap: true,
        },
        {
          format: 'iife',
          dir:'lib/nomodule',
          name: noModuleName,
          footer,
          entryFileNames: 'hof.min.js',
          // sourcemap: true,
          plugins: [terser()],
        },
        {
          format: 'cjs',
          dir:'lib/cjs',
          // name: 'Hof',
          entryFileNames: 'hof.cjs',
        },
        {
          format: 'cjs',
          dir:'lib/cjs',
          // name: 'Hof',
          entryFileNames: 'hof.min.cjs',
          plugins: [terser()],
        },

      ],
    },
    minify: false, // minify manually to control names
    plugins: [commonjs()]
  }
}
