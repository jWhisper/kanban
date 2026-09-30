import { useState, type CSSProperties } from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { safeUrl, type Note } from '../core/model';
import { groupHotspots, hotspotBatch, hotspotNotes } from '../core/discovery';

export function HotspotList({ notes, today, onOpen, onResearch }: {
  notes: Note[]; today: string; onOpen: (note: Note) => void; onResearch: () => void;
}) {
  const [history, setHistory] = useState(false);
  const [platform, setPlatform] = useState('');
  const [batch, setBatch] = useState('');
  const sources = hotspotNotes(notes, history);
  const batches = [...new Set(sources.map(hotspotBatch).filter(Boolean))].sort().reverse();
  const activeBatch = batches.includes(batch) ? batch : '';
  const dated = history && activeBatch ? sources.filter(n => hotspotBatch(n) === activeBatch) : sources;
  const groups = groupHotspots(dated);
  const activePlatform = groups.some(([name]) => name === platform) ? platform : '';
  const shown = activePlatform ? groups.filter(([name]) => name === activePlatform) : groups;
  const count = shown.reduce((total, [, items]) => total + items.length, 0);
  const isToday = sources.length > 0 && sources.every(n => hotspotBatch(n) === today);
  const platformTone = (name: string) => [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  return <section className="cw-hotspots cw-section" aria-label="热点列表">
    <div className="cw-section-heading">
      <div><h2>{history ? '历史热点' : isToday ? '今日热点' : '当前热点'} <span>{count} 条{activePlatform || activeBatch ? ` / 共 ${sources.length} 条` : ''}</span></h2><p>{history ? '按原批次日期归档，原文与选题关联都保留。' : `采集批次：${batches.join('、') || '尚未采集'} · 按平台展示全部已保存热点`}{!history && sources.length > 0 && !isToday && ' · 包含先前采集的资料'}</p></div>
      <button className="cw-text-button" onClick={onResearch}><TrendingUp size={15} />找新热点</button>
    </div>
    <div className="cw-hotspot-controls">
      <div className="cw-hotspot-switch" role="group" aria-label="热点范围">{[false, true].map(value => <button key={String(value)} aria-pressed={history === value} onClick={() => { setHistory(value); setPlatform(''); setBatch(''); }}>{value ? '历史热点' : '当前批次'}</button>)}</div>
      {history && batches.length > 0 && <label>采集日期 <select aria-label="历史热点采集日期" value={activeBatch} onChange={e => { setBatch(e.target.value); setPlatform(''); }}><option value="">全部日期</option>{batches.map(date => <option key={date}>{date}</option>)}</select></label>}
    </div>
    {groups.length > 0 && <div className="cw-platform-filters" role="group" aria-label="按发布平台筛选"><button aria-pressed={!activePlatform} onClick={() => setPlatform('')}>全部平台 <span>{dated.length}</span></button>{groups.map(([name, items]) => <button key={name} aria-pressed={activePlatform === name} onClick={() => setPlatform(name)}>{name} <span>{items.length}</span></button>)}</div>}
    <div className="cw-hotspot-groups">{shown.map(([name, items]) => <section className="cw-hotspot-group" key={name} aria-label={`${name}热点`}>
      <h3 className="cw-sr-only">{name}<span>{items.length} 条</span></h3>
      <div>{items.map(note => <article className="cw-hotspot-row" key={note.id} style={{ '--platform-tone': ['#557b48', '#3f7c70', '#88733d', '#5e7959'][platformTone(name)] } as CSSProperties}>
        <div className="cw-hotspot-card-top"><span className="cw-platform-mark" aria-hidden="true">{name.match(/[A-Za-z]/) ? name.slice(0, 2).toUpperCase() : name.slice(0, 1)}</span><span>{name}<small>{note.tags[0] || '热点资讯'}</small></span><button className="cw-icon-button" aria-label={`查看${note.title}`} onClick={() => onOpen(note)}><ArrowUpRight size={16} /></button></div>
        <button className="cw-hotspot-open" onClick={() => onOpen(note)}><strong>{note.title}{note.example && <small>示例</small>}</strong><p>{note.summary || '打开查看原文与采集依据。'}</p></button>
        <div className="cw-hotspot-meta"><span>发布 {note.published ? note.published.slice(0, 10) : '日期待核验'}</span><span>采集 {hotspotBatch(note) || '日期未标注'}</span>{(['views', 'likes', 'comments', 'saves'] as const).map((key, i) => note[key] !== undefined && <span key={key}>{['浏览', '赞', '评论', '收藏'][i]} {note[key]!.toLocaleString('zh-CN')}</span>)}{safeUrl(note.source) && <a href={safeUrl(note.source)} target="_blank" rel="noreferrer">原文<ArrowUpRight size={12} /></a>}</div>
      </article>)}</div>
    </section>)}</div>
    {!sources.length && <div className="cw-query-empty"><TrendingUp size={25} /><h3>{history ? '还没有历史热点' : '还没有收集热点'}</h3><p>{history ? '下一次成功采集后，旧热点会按批次日期进入这里。' : '点击「找新热点」，选择平台并输入关键词。'}</p></div>}
  </section>;
}
