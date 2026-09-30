import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Database, FileText, FolderOpen, Home, Inbox, LayoutGrid, List, Menu, Network, PanelTop, Plus, RefreshCw, Search, TrendingUp, UserRound, X } from 'lucide-react';
import { categories, categoryOf, statuses, type CategoryId, type Note, type Snapshot, type Status } from '../core/model';
import { searchNotes } from '../core/discovery';
import { feeds } from '../core/feeds';
import type { WorkbenchAPI } from '../api';
import { Dialog } from './Dialog';
import { NoteEditor } from './NoteEditor';
import { TopicHome } from './TopicHome';

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;
const icons: Record<string, Icon> = { home: Home, inbox: Inbox, topic: PanelTop, draft: FileText, personal: UserRound, material: BookOpen, publish: TrendingUp, index: Network };
const groupMap = { personal: '个人资料', material: '知识素材', publish: '发布运营' } as const;
const shortDate = (date: string) => { const parsed = new Date(date); return date && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '未设置'; };

function NoteCard({ note, onSelect, draggable = false }: { note: Note; onSelect: (note: Note) => void; draggable?: boolean }) {
  return <button className="cw-note-card" draggable={draggable} onDragStart={e => { e.dataTransfer.setData('text/plain', note.path); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => onSelect(note)}>
    <span className="cw-card-top"><span className={`cw-status cw-status-${statuses.indexOf(note.status)}`}>{note.status}</span>{note.example && <span className="cw-example-label">示例</span>}<ArrowUpRight size={15} /></span>
    <strong>{note.title}</strong><p>{note.summary || '打开资料，继续记录你的想法。'}</p>
    <span className="cw-card-tags">{note.tags.filter(Boolean).slice(0, 2).map(t => <span key={t}>#{t}</span>)}</span>
    <span className="cw-card-footer"><span>{note.platform || categoryOf(note.category).name}</span><span>{note.related.length > 0 && <><Network size={12} />{note.related.length}</>}{note.due && <><Clock3 size={12} />{shortDate(note.due)}</>}</span></span>
  </button>;
}
function Board({ notes, onSelect, onCreate, onStatus }: { notes: Note[]; onSelect: (note: Note) => void; onCreate: (status: Status) => void; onStatus: (note: Note, status: Status) => void }) {
  const [dragOver, setDragOver] = useState('');
  return <div className="cw-board">{statuses.map((status, index) => {
    const items = notes.filter(n => n.status === status);
    return <section key={status} className={`cw-board-column ${dragOver === status ? 'cw-drag-over' : ''}`} onDragOver={e => { e.preventDefault(); setDragOver(status); }} onDragLeave={() => setDragOver('')} onDrop={e => { e.preventDefault(); setDragOver(''); const note = notes.find(n => n.path === e.dataTransfer.getData('text/plain')); if (note && note.status !== status) onStatus(note, status); }}>
      <div className="cw-column-heading"><span className={`cw-dot cw-dot-${index}`} /><h3>{status}</h3><span>{items.length}</span><button className="cw-icon-button" aria-label={`在选题库新建资料（${status}列）`} onClick={() => onCreate(status)}><Plus size={15} /></button></div>
      {items.map(note => <NoteCard key={note.id} note={note} onSelect={onSelect} draggable />)}
      {!items.length && <button className="cw-column-empty" onClick={() => onCreate(status)}><Plus size={18} /><span>留一个位置给下个好想法</span></button>}
    </section>;
  })}</div>;
}
export function Workbench({ api }: { api: WorkbenchAPI }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ notes: [], issues: [], vaultPath: '' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list' | 'board'>('grid');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [sort, setSort] = useState('updated');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [creating, setCreating] = useState<{ category: CategoryId; related?: string[]; status?: Status }>();
  const [modal, setModal] = useState<'collect' | 'help' | undefined>();
  const [feedId, setFeedId] = useState<string>(feeds[0].id);
  const [collecting, setCollecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const searchRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const toast = (text: string, error = false) => setMessage({ text, error });
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try { const data = await api.load(); if (version === generation.current) setSnapshot(data); }
    catch (e) { if (version === generation.current) setMessage({ text: (e as Error).message, error: true }); }
    finally { if (version === generation.current) setLoading(false); }
  }, [api]);
  useEffect(() => { void refresh(); const unsubscribe = api.subscribe(() => { void refresh(); }); return () => { unsubscribe(); generation.current++; }; }, [api, refresh]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  useEffect(() => { if (message && !message.error) { const timer = setTimeout(() => setMessage(undefined), 5000); return () => clearTimeout(timer); } }, [message]);
  const { notes, issues, vaultPath } = snapshot;
  const liveSelected = notes.find(n => n.path === selectedPath);
  const selectedCache = useRef<Note | undefined>(undefined);
  if (liveSelected) selectedCache.current = liveSelected;
  const selected = liveSelected ?? (selectedCache.current?.path === selectedPath ? selectedCache.current : undefined);
  const navigate = (next: string) => { setPage(next); setQuery(''); setStatusFilter('全部状态'); setView(next === 'topic' ? 'board' : 'grid'); setMobileNav(false); };
  const open = (note: Note) => setSelectedPath(note.path);
  const create = (category: CategoryId = 'inbox', status?: Status) => setCreating({ category, status });
  const title = page === 'home' ? '今日热点' : page === 'index' ? '知识库索引' : page === 'publish' ? '数据与复盘' : page in groupMap ? groupMap[page as keyof typeof groupMap] : categoryOf(page).name;
  const scoped = query.trim() ? searchNotes(notes, query) : page in groupMap ? notes.filter(n => categoryOf(n.category).group === groupMap[page as keyof typeof groupMap]) : notes.filter(n => n.category === page);
  const filtered = scoped.filter(n => (statusFilter === '全部状态' || n.status === statusFilter)).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') : b.updated.localeCompare(a.updated));
  const count = (category: string) => notes.filter(n => n.category === category).length;
  const setStatus = async (note: Note, status: Status) => {
    try { const result = await api.save({ ...note, status }, note.path, note.revision); setSnapshot(result.snapshot); toast(`「${note.title}」已改为${status}`); }
    catch (e) { toast((e as Error).message, true); void refresh(); }
  };
  const collect = async () => {
    setCollecting(true);
    try { const result = await api.collect(feedId); setSnapshot(result.snapshot); setModal(undefined); navigate('inbox'); toast(result.added ? `已收集 ${result.added} 条资讯，来源和时间已保留` : '没有新资讯，已跳过重复链接'); }
    catch (e) { toast((e as Error).message, true); }
    finally { setCollecting(false); }
  };
  const navItem = (id: string, name: string, IconComponent: Icon, amount?: number) => <button key={id} className={`cw-nav-item ${page === id && !query ? 'cw-active' : ''}`} onClick={() => navigate(id)}><IconComponent size={18} /><span>{name}</span>{amount !== undefined && <small>{amount}</small>}</button>;
  const groupNavigation = (id: keyof typeof groupMap) => {
    const IconComponent = icons[id]; const isExpanded = expanded.includes(id);
    return <div className="cw-nav-group" key={id}><div className="cw-group-heading">{navItem(id, id === 'publish' ? '数据与复盘' : groupMap[id], IconComponent)}<button className="cw-icon-button" aria-label={`${isExpanded ? '收起' : '展开'}${groupMap[id]}`} aria-expanded={isExpanded} onClick={() => setExpanded(e => isExpanded ? e.filter(x => x !== id) : [...e, id])}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button></div>{isExpanded && <div className="cw-subnav">{categories.filter(c => c.group === groupMap[id]).map(c => <button key={c.id} className={page === c.id ? 'cw-active' : ''} onClick={() => navigate(c.id)}><span>{c.name}</span><small>{count(c.id)}</small></button>)}</div>}</div>;
  };
  return <div className="cw">
    {mobileNav && <button aria-label="关闭导航" className="cw-nav-backdrop" onClick={() => setMobileNav(false)} />}
    <aside className={`cw-sidebar ${mobileNav ? 'cw-sidebar-open' : ''}`}><button className="cw-brand" onClick={() => navigate('home')}><span className="cw-brand-mark"><BookOpen size={23} strokeWidth={1.6} /></span><span><strong>拾页</strong><small>CREATIVE SPACE</small></span></button>
      <div className="cw-space"><span className="cw-space-avatar">拾</span><div><strong>我的创作空间</strong><span><i />本地知识库</span></div><ChevronDown size={14} /></div>
      <nav aria-label="工作台导航"><p className="cw-nav-label">选题与创作</p>{navItem('home', '今日热点', Home)}{navItem('topic', '我的选题', PanelTop, count('topic'))}{navItem('draft', '稿件库', FileText)}<p className="cw-nav-label">素材与参考</p>{navItem('inbox', '收集箱', Inbox, count('inbox'))}{groupNavigation('personal')}{groupNavigation('material')}{groupNavigation('publish')}<p className="cw-nav-label">管理</p>{navItem('index', '知识库索引', Network)}</nav>
      <div className="cw-sidebar-bottom"><div><Database size={15} /><span>{notes.length} 条资料 · Markdown</span><span className="cw-online" /></div><button onClick={() => setModal('help')}><CircleHelp size={16} />使用指南<ArrowUpRight size={14} /></button></div>
    </aside>
    <div className="cw-main"><header className="cw-topbar"><div className="cw-breadcrumb"><button className="cw-icon-button cw-mobile-toggle" aria-label="打开导航" onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>我的创作空间</span><ChevronRight size={13} /><strong>{title}</strong></div>{page === 'home' && !query ? <button className="cw-text-button cw-search-shortcut" onClick={() => searchRef.current?.focus()}><Search size={15} />搜索 / 提问<kbd>⌘ K</kbd></button> : <div className="cw-search"><Search size={16} /><input ref={searchRef} aria-label="搜索整个知识库" placeholder="搜索你的知识库…" value={query} onChange={e => setQuery(e.target.value)} />{query ? <button aria-label="清除搜索" className="cw-icon-button" onClick={() => setQuery('')}><X size={13} /></button> : <kbd>⌘ K</kbd>}</div>}<button className="cw-primary cw-top-new" onClick={() => create(categories.some(c => c.id === page) ? page as CategoryId : 'inbox')}><Plus size={17} /><span>新建资料</span></button></header>
      {message && <div className={`cw-toast ${message.error ? 'cw-toast-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.error ? <CircleHelp size={17} /> : <Check size={17} />}<span>{message.text}</span><button className="cw-icon-button" aria-label="关闭提示" onClick={() => setMessage(undefined)}><X size={15} /></button></div>}
      {issues.length > 0 && <details className="cw-issues"><summary>有 {issues.length} 项资料需要检查</summary>{issues.map(i => <p key={i}>{i}</p>)}</details>}
      <main className="cw-content">
        {!loading && !vaultPath ? <div className="cw-empty-state"><h2>暂时无法打开知识库</h2><p>请检查本地服务或 Obsidian 目录设置，再重试。</p><button className="cw-primary" onClick={() => { setLoading(true); void refresh(); }}>重新连接</button></div> : loading ? <div className="cw-loading"><RefreshCw className="cw-spin" size={24} /><p>正在整理你的创作空间…</p></div> : <>
          {page === 'home' && !query ? <TopicHome notes={notes} vaultPath={vaultPath} inputRef={searchRef} onOpen={open} onNavigate={navigate} onCreate={create} onSearch={value => { setQuery(value); setView('list'); }} /> : page === 'index' && !query ? <>
            <div className="cw-page-intro"><div><p className="cw-eyebrow">KNOWLEDGE MAP</p><h1>让每一份知识，都能被找到。</h1><p>分类索引连接原文，稳定编号连接你的经历、选题与作品。</p></div><button className="cw-secondary" disabled={busy} onClick={async () => { setBusy(true); try { setSnapshot(await api.reindex()); toast('全部索引已重建'); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); } }}><RefreshCw size={15} className={busy ? 'cw-spin' : ''} />重建索引</button></div>
            <div className="cw-index-root"><Network size={26} /><div><strong>INDEX.md</strong><p>知识库总入口 · {notes.length} 条资料 · {notes.reduce((s, n) => s + n.related.length, 0)} 个关联</p><code>{vaultPath}</code></div>{api.openNote && <button className="cw-secondary" onClick={() => api.openNote!('INDEX.md')}>打开索引<ArrowUpRight size={15} /></button>}</div>
            <div className="cw-index-grid">{['收集箱', '个人资料', '知识素材', '内容创作', '发布运营'].map(group => <section key={group}><h2><FolderOpen size={19} />{group}</h2>{categories.filter(c => c.group === group).map(c => <button key={c.id} onClick={() => navigate(c.id)}><span><strong>{c.name}</strong><small>{c.path}/INDEX.md</small></span><b>{count(c.id)}</b><ChevronRight size={15} /></button>)}</section>)}</div>
          </> : <>
            <div className="cw-page-intro"><div><p className="cw-eyebrow">{query ? '搜索知识库' : page === 'topic' ? 'CONTENT PIPELINE' : 'YOUR KNOWLEDGE, CONNECTED'}</p><h1>{query ? `与「${query}」有关的记录` : title}</h1><p>{query ? `在标题、正文、标签与摘要中找到 ${filtered.length} 条资料` : page in groupMap ? '把零散的记录，连接成属于自己的知识。' : categoryOf(page).hint}</p></div>{page === 'inbox' && !query && <button className="cw-secondary" onClick={() => setModal('collect')}><ArrowDownToLine size={15} />收集资讯</button>}</div>
            <div className="cw-toolbar"><span><strong>{filtered.length}</strong> 条资料{page === 'topic' && view === 'board' ? ' · 拖动卡片调整进度，也可在详情中编辑状态' : ''}</span><div><select aria-label="筛选状态" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{['全部状态', ...statuses].map(s => <option key={s}>{s}</option>)}</select><select aria-label="排序方式" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">最近更新</option><option value="title">标题顺序</option><option value="due">计划日期</option></select><div className="cw-view-toggle"><button aria-label="卡片视图" aria-pressed={view === 'grid'} className={view === 'grid' ? 'cw-active' : ''} onClick={() => setView('grid')}><LayoutGrid size={16} /></button><button aria-label="列表视图" aria-pressed={view === 'list'} className={view === 'list' ? 'cw-active' : ''} onClick={() => setView('list')}><List size={17} /></button>{page === 'topic' && !query && <button aria-label="看板视图" aria-pressed={view === 'board'} className={view === 'board' ? 'cw-active' : ''} onClick={() => setView('board')}><PanelTop size={17} /></button>}</div></div></div>
            {!filtered.length ? <div className="cw-empty-state"><Inbox size={36} /><h2>{query ? '还没找到匹配的资料' : '这里，等着你的第一条记录'}</h2><p>{query ? '换一个关键词试试，或者清除搜索查看全部资料。' : '一段经历、一个念头，都可以成为下一件作品的起点。'}</p><button className="cw-primary" onClick={() => query ? setQuery('') : create(categories.some(c => c.id === page) ? page as CategoryId : 'inbox')}>{query ? '清除搜索' : '新建第一条资料'}</button></div> : view === 'board' && !query ? <Board notes={filtered} onSelect={open} onCreate={status => create('topic', status)} onStatus={(n, s) => { void setStatus(n, s); }} /> : view === 'list' ? <div className="cw-table-wrap"><table className="cw-table"><thead><tr><th>标题</th><th>分类</th><th>状态</th><th>标签</th><th>更新于</th></tr></thead><tbody>{filtered.map(note => <tr key={note.id}><td><button onClick={() => open(note)}><FileText size={16} /><span>{note.title}{note.example && <small>示例</small>}</span></button></td><td>{categoryOf(note.category).name}</td><td><span className={`cw-status cw-status-${statuses.indexOf(note.status)}`}>{note.status}</span></td><td>{note.tags.join('、') || '—'}</td><td>{shortDate(note.updated)}</td></tr>)}</tbody></table></div> : <div className="cw-card-grid">{filtered.map(note => <NoteCard key={note.id} note={note} onSelect={open} />)}</div>}
          </>}
          <footer className="cw-footer"><BookOpen size={13} /><span>拾页 · 让想法有迹可循</span><span>本地文件 · 自主掌握</span></footer>
        </>}
      </main>
    </div>
    {(creating || selectedPath) && <NoteEditor key={creating ? `new-${creating.category}` : selectedPath} note={selected} category={creating?.category ?? 'inbox'} initialRelated={creating?.related} initialStatus={creating?.status} missing={!!selectedPath && !liveSelected} notes={notes} vaultPath={vaultPath} api={api} onClose={() => { setCreating(undefined); setSelectedPath(undefined); }} onSaved={() => { setCreating(undefined); setSelectedPath(undefined); void refresh(); toast('资料已保存，索引已更新'); }} onSelect={path => setSelectedPath(path)} onCreateTopic={note => { setSelectedPath(undefined); setCreating({ category: 'topic', related: [note.id] }); }} />}
    {modal === 'collect' && <Dialog title="收集值得关注的资讯" onClose={() => { if (!collecting) setModal(undefined); }}><p className="cw-dialog-description">读取所选来源最近的 RSS 条目，保存到收集箱。已收集过的链接会自动跳过。</p><div className="cw-feed-options">{feeds.map(feed => <label className={feedId === feed.id ? 'cw-selected' : ''} key={feed.id}><input type="radio" name="feed" value={feed.id} checked={feedId === feed.id} disabled={collecting} onChange={() => setFeedId(feed.id)} /><span><strong>{feed.name}</strong><small>{feed.description}</small><code>{feed.url}</code></span></label>)}</div><div className="cw-dialog-footer"><span className="cw-muted">每次最多 20 条 · 保留来源与时间</span><button className="cw-primary" disabled={collecting} onClick={() => { void collect(); }}>{collecting ? <RefreshCw size={16} className="cw-spin" /> : <ArrowDownToLine size={16} />}{collecting ? '正在收集…' : '开始收集'}</button></div></Dialog>}
    {modal === 'help' && <Dialog title="从今日热点开始" onClose={() => setModal(undefined)}><div className="cw-help"><p><strong>1. 看全热点，再挑选题</strong>首页按实际发布平台展示当前批次全部热点，可筛选平台、回看历史。采集日期会明确标注；侧栏单独展示最多三个候选选题，窄屏时排列在下方。</p><p><strong>2. 一个输入框找依据</strong>「查知识库」直接搜索标题、正文、摘要与标签，可用空格分隔关键词。完整问题可交给 Codex 阅读索引和原文后回答。</p><p><strong>3. 找热点、分析链接</strong>选择平台并输入关键词，通过 RedFox 连接采集；也可以选择 Bing 通用搜索。平台需在 Codex 配好连接与密钥，不可用时会明确说明。粘贴链接可交给 Codex 抓取分析。发送预填任务后才执行，写回资料后自动刷新；旧批次移入历史热点。</p><p><strong>4. 创作与复盘</strong>使用稿件库完成表达，关联发布记录和同一统计窗口的数据，再留下复盘。</p><p><strong>关于保存</strong>资料直接保存在本地 Markdown 文件中。分类由目录决定，已有资料可在 Obsidian 中移动目录。文件冲突会保留你的编辑，供你对照合并。</p><p><strong>关于索引</strong>根目录和各分类的 INDEX.md 自动维护。Codex 可以从总索引定位原文；点击侧栏「知识库索引」可手动重建。</p><code>{vaultPath}</code></div></Dialog>}
  </div>;
}
