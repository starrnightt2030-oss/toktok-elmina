import { defineConfig } from 'vite';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every build gets a new version id: the game compares it with dist/version.json
// on start and forces an update when they differ.
const CHANNEL = process.env.VITE_CHANNEL || 'main';
const VERSION = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + (CHANNEL === 'beta' ? '-beta' : '');

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 4000 },
  plugins: [{
    name: 'write-version',
    writeBundle(opts) {
      const dir = opts.dir || 'dist';
      writeFileSync(resolve(dir, 'version.json'), JSON.stringify({ version: VERSION, channel: CHANNEL, date: new Date().toISOString() }));
      if (CHANNEL === 'beta') {   // the Beta installs as its own app with its own name
        const mf = resolve(dir, 'manifest.webmanifest');
        const m = JSON.parse(readFileSync(mf, 'utf8'));
        m.name = m.name + ' BETA'; m.short_name = 'BETA توكتوك'; m.id = './?channel=beta';
        writeFileSync(mf, JSON.stringify(m, null, 2));
      }
    },
  }],
});
