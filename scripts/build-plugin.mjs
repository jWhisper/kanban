import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
const out = 'release/creator-workbench';
await mkdir(out, { recursive: true });
await build({ entryPoints: ['src/obsidian.tsx'], bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', external: ['obsidian'], outfile: `${out}/main.js`, minify: true, jsx: 'automatic', loader: { '.png': 'dataurl' } });
await copyFile('manifest.json', `${out}/manifest.json`);
await copyFile('src/styles.css', `${out}/styles.css`);
console.log(`Obsidian 插件已生成：${out}`);
