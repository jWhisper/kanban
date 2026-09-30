import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUpRight, Check, Copy, ExternalLink, FileText, Link2, Pencil, Save, Sparkles } from 'lucide-react';
import { categories, categoryOf, emptyNote, safeUrl, statuses, type CategoryId, type Note, type NoteInput } from '../core/model';
import { aiActions, codexPrompt, codexUrl, type AIAction } from '../core/codex';
import type { WorkbenchAPI } from '../api';
import { Dialog } from './Dialog';

export function NoteEditor({ note, category, initialRelated, initialStatus, missing, notes, vaultPath, api, onClose, onSaved, onSelect, onCreateTopic }: {
  note?: Note; category: CategoryId; initialRelated?: string[]; initialStatus?: NoteInput['status']; missing?: boolean; notes: Note[]; vaultPath: string; api: WorkbenchAPI;
  onClose: () => void; onSaved: (path: string) => void; onSelect: (path: string) => void; onCreateTopic: (note: Note) => void;
}) {
  const [form, setForm] = useState<NoteInput>(note ?? { ...emptyNote(category), related: initialRelated ?? [], status: initialStatus ?? '灵感' });
  const [revision, setRevision] = useState(note?.revision);
  const [editing, setEditing] = useState(!note);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showLatest, setShowLatest] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [relationQuery, setRelationQuery] = useState('');
  const [action, setAction] = useState<AIAction>(note?.category === 'metric' || note?.category === 'publication' ? 'review' : note?.category === 'topic' ? 'analyze' : note?.category === 'draft' ? 'draft' : 'topics');
  const [copied, setCopied] = useState(false);
  const [destination, setDestination] = useState<CategoryId>(note?.category ?? category);
  const formRef = useRef<HTMLFormElement>(null);
  const conflict = !!note && note.revision !== revision;
  useEffect(() => { if (note && !dirty) { setForm(note); setRevision(note.revision); } }, [note, dirty]);
  const update = <K extends keyof NoteInput>(key: K, value: NoteInput[K]) => { setForm(f => ({ ...f, [key]: value })); setDirty(true); };
  const close = () => { if (saving) return; if (dirty) setConfirmDiscard(true); else onClose(); };
  const save = async () => {
    setSaving(true); setError('');
    try { const result = await api.save(form, note?.path, revision); setDirty(false); onSaved(result.path); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };
  const references = form.related.map(id => notes.find(n => n.id === id));
  const backlinks = note ? notes.filter(n => n.related.includes(note.id)) : [];
  return <Dialog title={note ? '资料详情' : `新建${categoryOf(category).name}`} wide onClose={close}>
    {confirmDiscard ? <div className="cw-discard"><p>有尚未保存的修改，要继续编辑还是放弃？</p><button className="cw-primary" onClick={() => setConfirmDiscard(false)}>继续编辑</button><button className="cw-secondary" onClick={onClose}>放弃修改并关闭</button></div> : null}
    <div className="cw-editor-meta"><span className="cw-chip">{categoryOf(form.category).name}</span>{note?.example && <span className="cw-example-label">示例资料</span>}{note && <span className="cw-muted">{note.path}</span>}</div>
    {missing && <p className="cw-error" role="alert">原文件已移动或删除。当前内容仍保留，可先复制未保存的编辑，再关闭并搜索最新文件。</p>}
    {note && !editing ? <>
      <div className="cw-detail-title"><h1>{note.title}</h1><button className="cw-secondary" onClick={() => setEditing(true)}><Pencil size={15} />编辑资料</button></div>
      <div className="cw-detail-attributes"><span className={`cw-status cw-status-${statuses.indexOf(note.status)}`}>{note.status}</span>{note.platform && <span>{note.platform}</span>}{note.due && <span>计划 {note.due}</span>}{note.tags.map(t => <span className="cw-tag" key={t}>#{t}</span>)}</div>
      {note.summary && <p className="cw-detail-summary">{note.summary}</p>}
      {note.category === 'metric' && <div className="cw-metrics">{(['views', 'likes', 'comments', 'saves'] as const).map((key, i) => <div key={key}><strong>{note[key]?.toLocaleString() ?? '—'}</strong><span>{['浏览', '点赞', '评论', '收藏'][i]}</span></div>)}<p>{note.platform || '未填写平台'} · {note.window || '未填写统计窗口'} · 采集于 {note.collected || '未填写'}</p></div>}
      {note.source && safeUrl(note.source) && <a className="cw-source" href={safeUrl(note.source)} target="_blank" rel="noreferrer"><Link2 size={15} />查看原始来源<ArrowUpRight size={14} /></a>}
      <div className="cw-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href && safeUrl(href)} target="_blank" rel="noreferrer">{children}</a>, img: ({ alt }) => <span className="cw-muted">[图片：{alt || '在 Obsidian 中查看'}]</span> }}>{note.body || '尚未填写正文。点击「编辑资料」开始记录。'}</ReactMarkdown></div>
      <div className="cw-relations"><h3><Link2 size={16} />关联资料 <span>{references.length}</span></h3>{references.length ? references.map((ref, i) => ref ? <button key={form.related[i]} onClick={() => onSelect(ref.path)}><FileText size={15} /><span>{ref.title}</span><small>{categoryOf(ref.category).name}</small><ArrowUpRight size={14} /></button> : <p key={i} className="cw-warning">关联资料未找到：{form.related[i]}</p>) : <p className="cw-muted">编辑资料，为这条内容关联经历、素材或发布记录。</p>}{backlinks.length > 0 && <><h3>被这些内容引用 <span>{backlinks.length}</span></h3>{backlinks.map(ref => <button key={ref.id} onClick={() => onSelect(ref.path)}><FileText size={15} /><span>{ref.title}</span><ArrowUpRight size={14} /></button>)}</>}</div>
      <div className="cw-detail-actions">{note.category !== 'topic' && <button className="cw-secondary" onClick={() => onCreateTopic(note)}>以此创建选题</button>}{api.openNote && <button className="cw-secondary" onClick={() => api.openNote!(note.path)}><ExternalLink size={15} />在 Obsidian 中打开</button>}</div>
      <div className="cw-move-control"><label>整理到<select aria-label="目标分类" value={destination} disabled={saving || missing} onChange={e => setDestination(e.target.value as CategoryId)}>{categories.map(c => <option key={c.id} value={c.id}>{c.group} / {c.name}</option>)}</select></label><button className="cw-secondary" disabled={saving || missing || destination === note.category} onClick={async () => { setSaving(true); setError(''); try { const result = await api.move(note.path, note.revision, destination); onSaved(result.path); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }}>{saving ? '整理中…' : '移动资料'}</button></div>
      <div className="cw-ai-panel"><div><Sparkles size={19} /><strong>带着这份资料，与 Codex 讨论</strong></div><select aria-label="AI 任务" value={action} onChange={e => setAction(e.target.value as AIAction)}>{aiActions.map(a => <option value={a.id} key={a.id}>{a.label}</option>)}</select><p>会预填当前资料与任务，发送后开始讨论；写回文件后，工作台自动更新。</p><div className="cw-button-row"><a className="cw-primary" href={codexUrl(vaultPath, action, note)}>前往 Codex<ArrowUpRight size={15} /></a><button className="cw-secondary" onClick={() => { void navigator.clipboard.writeText(codexPrompt(action, note)).then(() => setCopied(true)).catch(() => setError('复制失败，请使用「前往 Codex」。')); }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? '已复制' : '复制任务'}</button></div></div>
    </> : <form ref={formRef} className="cw-edit-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>标题<input autoFocus required maxLength={200} value={form.title} onChange={e => update('title', e.target.value)} placeholder="给这个想法起个名字" /></label>
      <div className="cw-form-grid"><label>分类<select value={form.category} disabled={!!note} onChange={e => update('category', e.target.value as CategoryId)}>{categories.map(c => <option key={c.id} value={c.id}>{c.group} / {c.name}</option>)}</select></label><label>状态<select value={form.status} onChange={e => update('status', e.target.value as NoteInput['status'])}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label></div>
      <label>一句话摘要<textarea rows={2} value={form.summary} onChange={e => update('summary', e.target.value)} placeholder="这条资料最值得记住的是什么？" /></label>
      <div className="cw-form-grid"><label>标签<input value={form.tags.join('，')} onChange={e => update('tags', e.target.value.split(/[,，]/).map(t => t.trim()))} placeholder="用逗号分隔，如 AI，创作" /></label><label>计划日期<input type="date" value={form.due} onChange={e => update('due', e.target.value)} /></label></div>
      <div className="cw-form-grid"><label>平台<input value={form.platform} onChange={e => update('platform', e.target.value)} placeholder="如：小红书、B 站" /></label><label>来源 / 发布链接<input type="url" value={form.source} onChange={e => update('source', e.target.value)} placeholder="https://" /></label></div>
      {(form.category === 'publication' || form.category === 'metric' || form.category === 'trend') && <div className="cw-form-grid"><label>发布时间<input type="date" value={form.published.slice(0, 10)} onChange={e => update('published', e.target.value)} /></label><label>采集时间<input type="datetime-local" value={form.collected.slice(0, 16)} onChange={e => update('collected', e.target.value)} /></label></div>}
      {form.category === 'metric' && <><label>统计窗口<input value={form.window} onChange={e => update('window', e.target.value)} placeholder="如：发布后 24 小时" /></label><div className="cw-form-grid">{(['views', 'likes', 'comments', 'saves'] as const).map((key, i) => <label key={key}>{['浏览量', '点赞数', '评论数', '收藏数'][i]}<input type="number" min="0" step="1" value={form[key] ?? ''} onChange={e => update(key, e.target.value === '' ? undefined : Number(e.target.value))} /></label>)}</div></>}
      <label>正文 <span className="cw-muted">支持 Markdown</span><textarea className="cw-body-editor" rows={12} value={form.body} onChange={e => update('body', e.target.value)} placeholder="写下事实、观点和你想继续探索的方向…" /></label>
      <fieldset className="cw-relation-picker"><legend>关联资料 · 已选择 {form.related.length} 条</legend><input aria-label="搜索可关联资料" placeholder="搜索经历、素材或选题" value={relationQuery} onChange={e => setRelationQuery(e.target.value)} /><div>{notes.filter(n => n.id !== note?.id && (form.related.includes(n.id) || n.title.toLowerCase().includes(relationQuery.toLowerCase()))).map(n => <label key={n.id}><input type="checkbox" checked={form.related.includes(n.id)} onChange={e => update('related', e.target.checked ? [...form.related, n.id] : form.related.filter(id => id !== n.id))} /><span>{n.title}</span><small>{categoryOf(n.category).name}</small></label>)}</div></fieldset>
      {conflict && <div className="cw-conflict"><strong>原文件有新修改，你的编辑仍保留在这里。</strong><p>展开最新版本，手动合并到编辑框；确认已对照后才能保存。</p><button type="button" className="cw-secondary" onClick={() => setShowLatest(v => !v)}>{showLatest ? '收起最新版本' : '对照最新版本'}</button>{showLatest && <><pre>{note!.revision}</pre><button type="button" className="cw-secondary" onClick={() => { setRevision(note!.revision); setShowLatest(false); setError(''); }}>我已对照并合并，保留当前编辑</button></>}</div>}
      {error && <p className="cw-error" role="alert">{error}</p>}
      <div className="cw-editor-footer"><span className="cw-muted">{dirty ? '有未保存的修改' : '资料保存在本地 Markdown 文件中'}</span><button type="button" className="cw-secondary" onClick={close}>取消</button><button className="cw-primary" disabled={saving || conflict || missing}><Save size={15} />{saving ? '保存中…' : '保存资料'}</button></div>
    </form>}
    {!editing && error && <p className="cw-error" role="alert">{error}</p>}
  </Dialog>;
}
