import { ArrowRight, ArrowUpRight, BookOpen, Clock3, FileText, Layers3, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { categoryOf, type CategoryId, type Note } from '../core/model';
import { topicReason } from '../core/discovery';

function activityGroups(notes: Note[]) {
  const groups = new Map<string, { time: string; label: string; category: CategoryId; notes: Note[] }>();
  for (const note of notes.filter(n => !n.example)) {
    const collected = !!note.collected && (!note.updated || Date.parse(note.updated) <= Date.parse(note.collected));
    const time = collected ? note.collected : note.updated || note.created;
    if (!time || Number.isNaN(Date.parse(time))) continue;
    const label = collected ? '采集入库' : note.updated && note.created && Date.parse(note.updated) > Date.parse(note.created) ? '更新记录' : '新增记录';
    const key = `${time}:${label}:${note.category}`;
    const group = groups.get(key) ?? { time, label, category: note.category, notes: [] };
    group.notes.push(note);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 4);
}

export function DailySidebar({ notes, topics, today, onOpen, onNavigate, onCreate }: {
  notes: Note[]; topics: Note[]; today: string; onOpen: (note: Note) => void; onNavigate: (page: string) => void; onCreate: (category: CategoryId) => void;
}) {
  const activity = activityGroups(notes);
  return <aside className="cw-daily-sidebar" aria-label="创作与动态">
    <section className="cw-rail-panel cw-rail-topics" aria-label="今天可做的选题">
      <div className="cw-rail-heading"><h2><Sparkles size={16} />值得动笔</h2><button className="cw-icon-button" aria-label="新建选题" onClick={() => onCreate('topic')}><Plus size={16} /></button></div>
      <p className="cw-rail-subtitle">从手里的线索，走向下一件作品</p>
      <div className="cw-rail-topic-list">{topics.map(note => <button className="cw-rail-topic" key={note.id} onClick={() => onOpen(note)}><span className="cw-rail-topic-meta"><span>{note.status}</span>{note.example ? '示例' : topicReason(note, today)}</span><strong>{note.title}</strong><p>{note.summary || '打开选题，补充你想讲的角度。'}</p><span className="cw-rail-topic-footer"><BookOpen size={12} />{note.related.filter(id => notes.some(n => n.id === id)).length} 条关联素材<ArrowUpRight size={14} /></span></button>)}</div>
      {!topics.length && <p className="cw-rail-empty">还没有待做选题。先记下一个想法，或者从近期热点开始。</p>}
      <button className="cw-rail-link" onClick={() => onNavigate('topic')}>查看全部选题<ArrowRight size={14} /></button>
    </section>
    <section className="cw-rail-panel" aria-label="最近动态">
      <div className="cw-rail-heading"><h2><Clock3 size={16} />最近动态</h2><span>记录日志</span></div>
      <ol className="cw-activity-list">{activity.map(group => <li key={`${group.time}:${group.label}:${group.category}`}><span className="cw-activity-dot" /><time dateTime={group.time}>{new Date(group.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</time><button onClick={() => group.notes.length === 1 ? onOpen(group.notes[0]) : onNavigate(group.category)}><strong>{group.label}<span>{group.notes.length} 条</span></strong><p>{group.notes.length === 1 ? group.notes[0].title : `${categoryOf(group.category).name} · ${group.notes[0].title}`}</p></button></li>)}</ol>
      {!activity.length && <p className="cw-rail-empty">保存第一条资料后，这里会显示记录时间。</p>}
      <p className="cw-activity-note">根据笔记的采集与更新时间整理</p>
    </section>
    <section className="cw-rail-panel cw-rail-library" aria-label="创作参考"><div className="cw-rail-heading"><h2><Layers3 size={16} />我的素材库</h2></div><button onClick={() => onNavigate('personal')}><BookOpen size={16} /><span>个人经历与感悟</span><ArrowUpRight size={13} /></button><button onClick={() => onNavigate('material')}><FileText size={16} /><span>案例与参考资料</span><ArrowUpRight size={13} /></button><button onClick={() => onNavigate('publish')}><TrendingUp size={16} /><span>数据与复盘</span><ArrowUpRight size={13} /></button></section>
    <p className="cw-rail-footnote"><span />想法在这里，文件在本地。</p>
  </aside>;
}
