import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every build gets a new version id: the game compares it with dist/version.json
// on start and forces an update when they differ.
const VERSION = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 4000 },
  plugins: [{
    name: 'write-version',
    writeBundle(opts) {
      writeFileSync(resolve(opts.dir || 'dist', 'version.json'), JSON.stringify({ version: VERSION, date: new Date().toISOString() }));
    },
  }],
});
