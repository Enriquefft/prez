import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
  },
  {
    entry: ['src/cli/init.ts', 'src/cli/image.ts', 'src/cli/export.ts'],
    external: ['pptxgenjs'],
    format: ['esm'],
    banner: { js: '#!/usr/bin/env node' },
    outDir: 'dist/cli',
    clean: false,
  },
])
