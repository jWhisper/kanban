import { defineConfig } from 'vite';
import { vaultPlugin } from './server/plugin';
export default defineConfig({
  plugins: [vaultPlugin()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, cors: false, watch: { ignored: ['**/local-vault/**/INDEX.md'] } },
  build: { outDir: 'dist' },
});
