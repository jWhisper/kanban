import { categoryOf, type Note } from './model';

export function searchNotes(notes: Note[], query: string): Note[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return notes.filter(note => {
    const text = `${note.title} ${note.summary} ${note.body} ${note.tags.join(' ')} ${categoryOf(note.category).name} ${note.source}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => Number(terms.every(term => b.title.toLocaleLowerCase().includes(term))) - Number(terms.every(term => a.title.toLocaleLowerCase().includes(term))) || b.updated.localeCompare(a.updated));
}

export function todayTopics(notes: Note[], today: string): Note[] {
  const priority = { '创作中': 0, '待创作': 1, '灵感': 2 };
  return notes.filter(note => note.category === 'topic' && note.status in priority && (!note.due || note.due <= today))
    .sort((a, b) => Number(a.example) - Number(b.example) || Number(!!b.due) - Number(!!a.due) || a.due.localeCompare(b.due) || priority[a.status as keyof typeof priority] - priority[b.status as keyof typeof priority] || b.updated.localeCompare(a.updated))
    .slice(0, 3);
}

export function topicReason(note: Note, today: string): string {
  if (note.due) return note.due === today ? '计划今天做' : '计划日期已到';
  if (note.status === '创作中') return '已经开始，可以继续推进';
  if (note.status === '待创作') return '已列入待创作';
  return '已有想法，待确定角度';
}

export function hotspotBatch(note: Note): string {
  if (note.batch && /^\d{4}-\d{2}-\d{2}$/.test(note.batch)) return note.batch;
  if (!note.collected) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(note.collected)) return note.collected;
  const date = new Date(note.collected);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function hotspotNotes(notes: Note[], history = false): Note[] {
  const archive = `${categoryOf('trend').path}/历史热点/`;
  return notes.filter(note => note.category === 'trend' && note.path.startsWith(archive) === history)
    .sort((a, b) => hotspotBatch(b).localeCompare(hotspotBatch(a)) || b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
}

export function groupHotspots(notes: Note[]): [string, Note[]][] {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const platform = note.platform.trim() || '未标注平台';
    groups.set(platform, [...(groups.get(platform) || []), note]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
}
