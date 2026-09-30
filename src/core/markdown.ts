import { isMap, parseDocument, Document } from 'yaml';
import { categoryAtPath, emptyNote, statuses, type Note, type NoteInput } from './model';

export function splitMarkdown(raw: string) {
  const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const doc = match ? parseDocument(match[1]) : new Document({});
  if (doc.errors.length || !isMap(doc.contents)) throw new Error('笔记属性不是有效的 YAML 对象，请先在 Obsidian 中修复。');
  return { doc, body: match ? raw.slice(match[0].length) : raw };
}
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : [];
const str = (value: unknown): string => value == null ? '' : String(value);

export function parseNote(path: string, raw: string): Note {
  const category = categoryAtPath(path);
  if (!category) throw new Error('笔记不在受管理的分类目录内。');
  const { doc, body } = splitMarkdown(raw);
  const data = doc.toJS();
  const note: Note = {
    ...emptyNote(category.id),
    id: str(data.id) || path,
    path,
    title: str(data.title) || path.split('/').pop()!.replace(/\.md$/, ''),
    body,
    summary: str(data.summary) || body.replace(/[#>*`\[\]]/g, '').trim().split('\n').find(Boolean)?.slice(0, 120) || '',
    tags: list(data.tags),
    related: list(data.related),
    status: statuses.includes(data.status) ? data.status : '灵感',
    created: str(data.created),
    updated: str(data.updated),
    example: data.example === true,
    batch: str(data.batch),
    revision: raw,
  };
  for (const key of ['platform', 'due', 'source', 'published', 'collected', 'window'] as const) note[key] = str(data[key]);
  for (const key of ['views', 'likes', 'comments', 'saves'] as const) if (typeof data[key] === 'number') note[key] = data[key];
  return note;
}

export function writeNote(input: NoteInput, id: string, raw?: string, example = false, now = new Date().toISOString()): string {
  const { doc } = splitMarkdown(raw ?? '');
  const existingCreated = doc.get('created');
  const { body } = input;
  // 输入可能来自带有 path / revision 的 Note；只序列化可编辑属性。
  const fields: Record<string, unknown> = {};
  for (const key of [...Object.keys(emptyNote()), 'views', 'likes', 'comments', 'saves'] as (keyof NoteInput)[]) {
    if (key !== 'body') fields[key] = input[key];
  }
  for (const [key, value] of Object.entries({ ...fields, id, created: existingCreated || now, updated: now })) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) doc.delete(key);
    else doc.set(key, value);
  }
  for (const key of ['views', 'likes', 'comments', 'saves'] as const) if (input[key] === undefined) doc.delete(key);
  if (example) doc.set('example', true);
  return `---\n${doc.toString({ lineWidth: 0 })}---\n${body}`;
}
