import { useState, type RefObject } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Globe2, Link2, Plus, Search, Sparkles, TrendingUp, X } from 'lucide-react';
import { categoryOf, safeUrl, type CategoryId, type Note } from '../core/model';
import { bingSearchUrl, researchSources, researchUrl, type ResearchMode, type ResearchSource } from '../core/codex';
import { searchNotes, todayTopics } from '../core/discovery';
import { HotspotList } from './HotspotList';
import { DeskHero } from './DeskHero';
import { DailySidebar } from './DailySidebar';

const modes = [
  { id: 'library', label: '查知识库', icon: Search, placeholder: '搜索经历、感悟、案例，或写下你想问的问题…' },
  { id: 'trends', label: '找热点', icon: TrendingUp, placeholder: '输入关注的关键词，例如 AI 工具、独立开发…' },
  { id: 'link', label: '分析链接', icon: Link2, placeholder: '粘贴文章、笔记或视频的完整链接…' },
] as const;

export function TopicHome({ notes, vaultPath, inputRef, onOpen, onNavigate, onCreate, onSearch }: {
  notes: Note[]; vaultPath: string; inputRef: RefObject<HTMLInputElement | null>;
  onOpen: (note: Note) => void; onNavigate: (page: string) => void; onCreate: (category: CategoryId) => void; onSearch: (query: string) => void;
}) {
  const [mode, setMode] = useState<ResearchMode>('library');
  const [inputs, setInputs] = useState({ library: '', trends: '', link: '' });
  const [submitted, setSubmitted] = useState('');
  const [source, setSource] = useState<ResearchSource>('bing');
  const input = inputs[mode];
  const config = modes.find(item => item.id === mode)!;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const topics = todayTopics(notes, today);
  const results = searchNotes(notes, submitted);
  const canResearch = !!input.trim() && (mode !== 'link' || !!safeUrl(input.trim()));
  const changeMode = (next: ResearchMode) => { setMode(next); setSubmitted(''); inputRef.current?.focus(); };
  return <div className="cw-topic-home">
    <div className="cw-page-intro cw-topic-intro"><div><p className="cw-eyebrow">YOUR DAILY SPACE</p><h1>拾起今天的灵感<span>。</span></h1><p>看见值得关注的事，写下属于自己的想法。</p></div><button className="cw-secondary" onClick={() => onCreate('topic')}><Plus size={15} />记一个选题</button></div>
    <div className="cw-dashboard-layout"><div className="cw-dashboard-main">
    <DeskHero onResearch={() => changeMode('trends')} />
    <section className="cw-discovery" aria-label="选题与知识库查询">
      <div className="cw-input-modes" role="group" aria-label="查询用途">{modes.map(item => <button key={item.id} aria-pressed={mode === item.id} className={mode === item.id ? 'cw-active' : ''} onClick={() => changeMode(item.id)}><item.icon size={16} />{item.label}</button>)}</div>
      <form className="cw-discovery-input" onSubmit={e => { e.preventDefault(); if (mode === 'library') setSubmitted(input.trim()); else if (canResearch) window.location.href = researchUrl(vaultPath, mode, input, source); }}>
        <input ref={inputRef} aria-label={config.label} placeholder={config.placeholder} maxLength={2000} value={input} onChange={e => { setInputs(values => ({ ...values, [mode]: e.target.value })); if (mode === 'library') setSubmitted(''); }} />
        {input && <button className="cw-icon-button" type="button" aria-label="清空输入" onClick={() => { setInputs(values => ({ ...values, [mode]: '' })); setSubmitted(''); inputRef.current?.focus(); }}><X size={16} /></button>}
        <div className="cw-discovery-actions">
        {mode === 'trends' && <label className="cw-research-source"><span className="cw-sr-only">搜索平台</span><Globe2 size={14} aria-hidden="true" /><select value={source} onChange={e => setSource(e.target.value as ResearchSource)}>{researchSources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={12} aria-hidden="true" /></label>}
        {mode === 'library' ? <button className="cw-primary" disabled={!input.trim()} type="submit">查找资料<ArrowRight size={15} /></button> : canResearch ? <a className="cw-primary" href={researchUrl(vaultPath, mode, input, source)}>去 Codex {mode === 'trends' ? '研究' : '分析'}<ArrowUpRight size={15} /></a> : <button className="cw-primary" disabled type="button">{mode === 'trends' ? '研究热点' : '分析链接'}<ArrowUpRight size={15} /></button>}
        </div>
      </form>
      <div className="cw-discovery-hint">{mode === 'library' ? <><span>搜索 {notes.length} 条记录 · 标题、正文、标签</span>{input.trim() ? <a href={researchUrl(vaultPath, 'library', input)}><Sparkles size={13} />带着问题去 Codex<ArrowUpRight size={12} /></a> : <span>⌘ K 快速输入</span>}</> : <span>{mode === 'trends' ? '按所选平台研究 · 在 Codex 发送任务后采集，平台不可用时会说明原因。热点最多 10 条，候选选题最多 3 条。' : input.trim() && !canResearch ? '请输入以 https:// 或 http:// 开头的完整链接。' : '在 Codex 发送任务后抓取与分析，结果保存到案例拆解。'}</span>}{mode === 'trends' && input.trim() && <a href={bingSearchUrl(input)} target="_blank" rel="noreferrer">用 Bing 搜索这个关键词<ArrowUpRight size={13} /></a>}</div>
    </section>
    {mode === 'library' && submitted ? <section className="cw-section cw-search-results" aria-label="知识库查询结果">
      <div className="cw-section-heading"><h2>与「{submitted}」有关的记录 <span>{results.length}</span></h2><button className="cw-text-button" onClick={() => { setSubmitted(''); setInputs(values => ({ ...values, library: '' })); }}>回到今日热点<X size={14} /></button></div>
      <div className="cw-query-results">{results.slice(0, 8).map(note => <button key={note.id} onClick={() => onOpen(note)}><span className="cw-query-type">{categoryOf(note.category).name}{note.example && ' · 示例'}</span><strong>{note.title}<ArrowUpRight size={15} /></strong><p>{note.summary || note.body.slice(0, 130)}</p></button>)}{!results.length && <div className="cw-query-empty"><Search size={25} /><h3>没有找到匹配的记录</h3><p>试试更短的关键词。完整问题可以交给 Codex 按索引阅读资料后回答。</p><a className="cw-secondary" href={researchUrl(vaultPath, 'library', submitted)}><Sparkles size={15} />去 Codex 查找与回答<ArrowUpRight size={14} /></a></div>}</div>
      {results.length > 8 && <button className="cw-text-button cw-all-results" onClick={() => onSearch(submitted)}>查看全部 {results.length} 条结果<ArrowRight size={14} /></button>}
    </section> : <HotspotList notes={notes} today={today} onOpen={onOpen} onResearch={() => changeMode('trends')} />}
    </div><DailySidebar notes={notes} topics={topics} today={today} onOpen={onOpen} onNavigate={onNavigate} onCreate={onCreate} /></div>
  </div>;
}
