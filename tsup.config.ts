import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
  sourcemap: true,
  minify: false,
  treeshake: true,
  // Ignore CSS imports - we handle CSS separately
  esbuildOptions(options) {
    options.external = [...(options.external || []), '*.css'];
  },
});