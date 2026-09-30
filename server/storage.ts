import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Storage } from '../src/core/store';
export class NodeStorage implements Storage {
  root: string;
  constructor(root: string) { this.root = path.resolve(root); }
  private async target(relative: string) {
    if (!relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '..' || p.startsWith('.'))) throw new Error('无效的知识库路径。');
    let current = this.root;
    for (const segment of relative.split('/')) {
      current = path.join(current, segment);
      try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('不读写符号链接。'); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    }
    return current;
  }
  async mkdir(relative: string) { await fs.mkdir(await this.target(relative), { recursive: true }); }
  async list() {
    await fs.mkdir(this.root, { recursive: true });
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await fs.readdir(path.join(this.root, dir), { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
        const relative = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(relative);
        else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
      }
    };
    await walk('');
    return files;
  }
  async read(relative: string) {
    try { return await fs.readFile(await this.target(relative), 'utf8'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  async create(relative: string, text: string) {
    const target = await this.target(relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, text, { flag: 'wx' });
  }
  async process(relative: string, transform: (raw: string) => string) {
    const target = await this.target(relative);
    const current = await fs.readFile(target, 'utf8');
    const next = transform(current);
    if (current === next) return;
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, next, { flag: 'wx' });
      if (await fs.readFile(target, 'utf8') !== current) throw new Error('保存期间文件发生变化，请重新读取后再保存。');
      await fs.rename(temp, target);
    } finally { await fs.unlink(temp).catch(() => undefined); }
  }
  async rename(relative: string, destination: string) {
    const source = await this.target(relative), target = await this.target(destination);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // 同一文件系统内以排他创建的硬链接移动，避免覆盖目标同名文件。
    await fs.link(source, target);
    try { await fs.unlink(source); }
    catch (e) { await fs.unlink(target); throw e; }
  }
}
