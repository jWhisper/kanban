import { categories, isNotePath, categoryOf, validateNote, emptyNote, type NoteInput, type Snapshot, type Note } from './model';
import { parseNote, writeNote } from './markdown';
import { buildIndexes, mergeIndex, vaultRules } from './indexes';

export interface Storage {
  root: string;
  list(): Promise<string[]>;
  read(path: string): Promise<string | null>;
  mkdir(path: string): Promise<void>;
  create(path: string, text: string): Promise<void>;
  process(path: string, transform: (current: string) => string): Promise<void>;
  rename(path: string, target: string): Promise<void>;
}
export class ConflictError extends Error {
  constructor() { super('文件已在其他地方修改。你的编辑仍被保留，请对照最新版本后再保存。'); }
}
export class VaultStore {
  private pending: Promise<unknown> = Promise.resolve();
  private indexIssue = '';
  constructor(public storage: Storage) {}
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.pending.then(action);
    this.pending = result.catch(() => undefined);
    return result;
  }
  async snapshot(): Promise<Snapshot> {
    const notes: Note[] = [], issues: string[] = [];
    const paths = (await this.storage.list()).filter(isNotePath).sort();
    const seen = new Set<string>();
    for (const path of paths) {
      try {
        const raw = await this.storage.read(path);
        if (raw === null) continue;
        const note = parseNote(path, raw);
        if (seen.has(note.id)) { issues.push(`${path}：id 重复，请为笔记设置唯一 id。`); continue; }
        seen.add(note.id);
        notes.push(note);
      } catch (error) { issues.push(`${path}：${(error as Error).message}`); }
    }
    if (this.indexIssue) issues.push(this.indexIssue);
    return { notes: notes.sort((a, b) => b.updated.localeCompare(a.updated)), issues, vaultPath: this.storage.root };
  }
  private async index(snapshot: Snapshot) {
    for (const [path, text] of buildIndexes(snapshot.notes, snapshot.issues)) {
      const current = await this.storage.read(path);
      if (current === null) await this.storage.create(path, mergeIndex('', text));
      else if (mergeIndex(current, text) !== current) await this.storage.process(path, raw => mergeIndex(raw, text));
    }
  }
  private async indexedSnapshot() {
    this.indexIssue = '';
    const snapshot = await this.snapshot();
    try { await this.index(snapshot); }
    catch (e) { this.indexIssue = `资料已保留，索引更新失败：${(e as Error).message}`; snapshot.issues.push(this.indexIssue); }
    return snapshot;
  }
  async initialize() {
    return this.serial(async () => {
      for (const category of categories) await this.storage.mkdir(category.path);
      await this.storage.mkdir('90_系统资源/附件');
      await this.storage.mkdir('90_系统资源/模板');
      if (await this.storage.read('AGENTS.md') === null) await this.storage.create('AGENTS.md', vaultRules);
      for (const category of categories) {
        const path = `90_系统资源/模板/${category.name}.md`;
        if (await this.storage.read(path) === null) {
          await this.storage.create(path, writeNote({ ...emptyNote(category.id), title: category.name + '模板', body: `# ${category.name}\n\n## 内容\n\n## 来源与依据\n\n## 下一步\n` }, '请替换为唯一编号'));
        }
      }
      return this.indexedSnapshot();
    });
  }
  refresh() { return this.serial(() => this.indexedSnapshot()); }
  move(path: string, revision: string, category: NoteInput['category']) {
    return this.serial(async () => {
      if (!isNotePath(path) || !categories.some(c => c.id === category)) throw new Error('请选择有效资料与分类。');
      const current = await this.storage.read(path);
      if (current !== revision) throw new ConflictError();
      const note = parseNote(path, current);
      const target = `${categoryOf(category).path}/${path.split('/').pop()}`;
      if (note.category === category) return { path, snapshot: await this.snapshot() };
      if (await this.storage.read(target) !== null) throw new Error('目标分类已有同名文件，请先在 Obsidian 中重命名。');
      const next = writeNote({ ...note, category }, note.id, current);
      await this.storage.process(path, raw => { if (raw !== current) throw new ConflictError(); return next; });
      try { await this.storage.rename(path, target); }
      catch (e) {
        await this.storage.process(path, raw => raw === next ? current : raw);
        throw e;
      }
      return { path: target, snapshot: await this.indexedSnapshot() };
    });
  }
  save(input: NoteInput, path?: string, revision?: string) {
    return this.serial(async () => {
      validateNote(input);
      input = { ...input, tags: [...new Set(input.tags.map(t => t.trim()).filter(Boolean))], related: [...new Set(input.related)] };
      if (input.category === 'metric') {
        if (!input.platform || !input.window || !input.collected || Number.isNaN(new Date(input.collected).getTime())) throw new Error('数据记录请填写平台、有效采集时间和统计窗口。');
        const publications = (await this.snapshot()).notes.filter(n => n.category === 'publication');
        if (!publications.some(n => input.related.includes(n.id))) throw new Error('数据记录需要关联一条发布记录。');
      }
      if (path) {
        if (!isNotePath(path)) throw new Error('只允许编辑分类目录中的 Markdown 笔记。');
        const existingPath = path;
        await this.storage.process(existingPath, raw => {
          if (raw !== revision) throw new ConflictError();
          const old = parseNote(existingPath, raw);
          if (input.category !== old.category) throw new Error('已有笔记的分类由文件所在目录决定。请在 Obsidian 中移动笔记。');
          return writeNote(input, old.id, raw);
        });
      } else {
        const id = crypto.randomUUID();
        const name = input.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^[. ]+|[. ]+$/g, '').slice(0, 60) || '未命名';
        path = `${categoryOf(input.category).path}/${name}-${id.slice(0, 8)}.md`;
        await this.storage.create(path, writeNote({ ...input, title: input.title.trim() }, id));
      }
      const snapshot = await this.indexedSnapshot();
      return { snapshot, path };
    });
  }
}
