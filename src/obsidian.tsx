import { FileSystemAdapter, ItemView, Notice, Plugin, PluginSettingTab, Setting, TFile, normalizePath, requestUrl, type App, type WorkspaceLeaf } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import { Workbench } from './ui/Workbench';
import { VaultStore, type Storage } from './core/store';
import { isNotePath } from './core/model';
import { feeds, parseFeed } from './core/feeds';
import type { WorkbenchAPI } from './api';

const VIEW = 'creator-workbench';
class ObsidianStorage implements Storage {
  root: string;
  constructor(private app: App, public folder: string) {
    const adapter = app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error('拾页目前支持桌面端本地知识库。');
    this.root = adapter.getBasePath() + (folder ? '/' + folder : '');
  }
  full(path: string) {
    if (path.split('/').some(p => !p || p === '..' || p.startsWith('.')) || path.includes('\\')) throw new Error('无效的知识库路径。');
    return normalizePath(this.folder ? `${this.folder}/${path}` : path);
  }
  async list() {
    const prefix = this.folder ? this.folder + '/' : '';
    return this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(prefix)).map(f => f.path.slice(prefix.length));
  }
  async read(path: string) {
    const file = this.app.vault.getAbstractFileByPath(this.full(path));
    if (!file) return null;
    if (!(file instanceof TFile)) throw new Error(`${path} 不是文件。`);
    return this.app.vault.read(file);
  }
  async mkdir(path: string) {
    const parts = this.full(path).split('/');
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join('/');
      if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    }
  }
  async create(path: string, text: string) {
    const parent = path.split('/').slice(0, -1).join('/');
    if (parent) await this.mkdir(parent);
    else if (this.folder && !this.app.vault.getAbstractFileByPath(this.folder)) await this.app.vault.createFolder(this.folder);
    await this.app.vault.create(this.full(path), text);
  }
  async process(path: string, transform: (current: string) => string) {
    const file = this.app.vault.getAbstractFileByPath(this.full(path));
    if (!(file instanceof TFile)) throw new Error('文件已移动或删除，请刷新。');
    // 正文与属性同时编辑，使用 Vault.process 在同一原子操作中检查版本并写入。
    await this.app.vault.process(file, transform);
  }
  async rename(path: string, target: string) {
    const file = this.app.vault.getAbstractFileByPath(this.full(path));
    if (!(file instanceof TFile)) throw new Error('原文件已移动或删除。');
    const destination = this.full(target);
    if (this.app.vault.getAbstractFileByPath(destination)) throw new Error('目标分类已有同名文件。');
    await this.mkdir(target.split('/').slice(0, -1).join('/'));
    await this.app.fileManager.renameFile(file, destination);
  }
}
class WorkbenchView extends ItemView {
  private root?: Root;
  constructor(leaf: WorkspaceLeaf, private plugin: CreatorPlugin) { super(leaf); }
  getViewType() { return VIEW; }
  getDisplayText() { return '拾页工作台'; }
  getIcon() { return 'panels-top-left'; }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('creator-workbench-view');
    this.root = createRoot(this.contentEl);
    this.root.render(<Workbench api={this.plugin.api} />);
  }
  async onClose() { this.root?.unmount(); }
}
export default class CreatorPlugin extends Plugin {
  folder = '拾页知识库';
  store!: VaultStore;
  private ready?: Promise<unknown>;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private collecting = false;
  private notify = () => this.listeners.forEach(fn => fn());
  private ensure() { return this.ready ??= this.store.initialize().catch(e => { this.ready = undefined; throw e; }); }
  api: WorkbenchAPI = {
    load: async () => { await this.ensure(); return this.store.snapshot(); },
    save: async (input, path, revision) => { await this.ensure(); const result = await this.store.save(input, path, revision); this.notify(); return result; },
    reindex: async () => { await this.ensure(); return this.store.refresh(); },
    move: async (path, revision, category) => { await this.ensure(); const result = await this.store.move(path, revision, category); this.notify(); return result; },
    subscribe: callback => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; },
    openNote: path => { void this.app.workspace.openLinkText((this.store.storage as ObsidianStorage).full(path), '', true); },
    collect: async feedId => {
      await this.ensure();
      const feed = feeds.find(f => f.id === feedId);
      if (!feed) throw new Error('请选择已配置的来源。');
      if (this.collecting) throw new Error('已有收集任务正在运行。');
      this.collecting = true;
      try {
        const response = await requestUrl({ url: feed.url });
        const entries = parseFeed(response.text, feedId);
        const known = new Set((await this.store.snapshot()).notes.map(n => n.source));
        let added = 0;
        for (const input of entries) if (!known.has(input.source)) { await this.store.save(input); known.add(input.source); added++; }
        this.notify(); return { added, snapshot: await this.store.snapshot() };
      } finally { this.collecting = false; }
    },
  };
  async onload() {
    const settings = await this.loadData();
    if (typeof settings?.folder === 'string') this.folder = settings.folder;
    this.setStore();
    this.registerView(VIEW, leaf => new WorkbenchView(leaf, this));
    const open = async () => {
      const existing = this.app.workspace.getLeavesOfType(VIEW)[0];
      const leaf = existing || this.app.workspace.getLeaf('tab');
      if (!existing) await leaf.setViewState({ type: VIEW, active: true });
      await this.app.workspace.revealLeaf(leaf);
    };
    this.addRibbonIcon('panels-top-left', '打开拾页工作台', () => { void open(); });
    this.addCommand({ id: 'open-workbench', name: '打开工作台', callback: () => { void open(); } });
    this.addCommand({ id: 'rebuild-index', name: '重建知识库索引', callback: () => { void this.api.reindex().then(() => new Notice('知识库索引已更新')).catch(e => new Notice(String(e))); } });
    this.addSettingTab(new WorkbenchSettings(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      const changed = (file: { path: string }, oldPath?: string) => {
        const prefix = this.folder ? this.folder + '/' : '';
        const managed = (p: string) => p.startsWith(prefix) && isNotePath(p.slice(prefix.length));
        if (!this.ready || (!managed(file.path) && !(oldPath && managed(oldPath)))) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { void this.store.refresh().then(this.notify).catch(e => new Notice(`索引更新失败：${String(e)}`)); }, 250);
      };
      this.registerEvent(this.app.vault.on('create', changed));
      this.registerEvent(this.app.vault.on('modify', changed));
      this.registerEvent(this.app.vault.on('delete', changed));
      this.registerEvent(this.app.vault.on('rename', changed));
    });
  }
  setStore() {
    if (this.folder && (this.folder.includes('\\') || this.folder.split('/').some(p => !p || p.startsWith('.')))) throw new Error('请使用知识库内的相对目录。');
    this.store = new VaultStore(new ObsidianStorage(this.app, this.folder));
    this.ready = undefined;
    this.notify();
  }
  onunload() { clearTimeout(this.timer); }
}
class WorkbenchSettings extends PluginSettingTab {
  constructor(app: App, private plugin: CreatorPlugin) { super(app, plugin); }
  display() {
    this.containerEl.empty();
    let folder = this.plugin.folder;
    new Setting(this.containerEl).setName('资料所在目录').setDesc('相对当前 Obsidian 知识库的路径。留空使用知识库根目录。切换目录不会移动现有资料。').addText(input => input.setValue(folder).onChange(value => { folder = value.trim(); }));
    new Setting(this.containerEl).addButton(button => button.setButtonText('保存目录').setCta().onClick(async () => {
      const old = this.plugin.folder;
      try { this.plugin.folder = folder; this.plugin.setStore(); await this.plugin.saveData({ folder }); new Notice('目录已更新'); }
      catch (e) { this.plugin.folder = old; new Notice(String(e)); }
    }));
  }
}
