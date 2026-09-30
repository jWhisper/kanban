export const categories = [
  { id: 'inbox', group: '收集箱', name: '收集箱', path: '00_收集箱', hint: '先记下来，灵感不用等整理' },
  { id: 'profile', group: '个人资料', name: '个人定位', path: '10_个人资料/个人定位', hint: '你是谁，为谁创作' },
  { id: 'work', group: '个人资料', name: '工作经历', path: '10_个人资料/工作经历', hint: '工作里值得被讲述的事' },
  { id: 'project', group: '个人资料', name: '项目实践', path: '10_个人资料/项目实践', hint: '亲手做过，才有自己的答案' },
  { id: 'life', group: '个人资料', name: '生活经历', path: '10_个人资料/生活经历', hint: '把日常变成表达的起点' },
  { id: 'thought', group: '个人资料', name: '个人感悟', path: '10_个人资料/个人感悟', hint: '留住思考，也留住变化' },
  { id: 'trend', group: '知识素材', name: '热点资讯', path: '20_知识素材/热点资讯', hint: '保持关注，找到自己的切入点' },
  { id: 'case', group: '知识素材', name: '案例拆解', path: '20_知识素材/案例拆解', hint: '看懂好作品为什么有效' },
  { id: 'reference', group: '知识素材', name: '参考资料', path: '20_知识素材/参考资料', hint: '每一个引用，都有出处' },
  { id: 'method', group: '知识素材', name: '方法技巧', path: '20_知识素材/方法技巧', hint: '把有用的经验变成可复用的方法' },
  { id: 'tool', group: '知识素材', name: '工具资源', path: '20_知识素材/工具资源', hint: '收藏真正用得上的工具' },
  { id: 'topic', group: '内容创作', name: '选题库', path: '30_内容创作/选题库', hint: '从一个念头，到一件作品' },
  { id: 'draft', group: '内容创作', name: '稿件库', path: '30_内容创作/稿件库', hint: '把想法写成自己的表达' },
  { id: 'publication', group: '发布运营', name: '发布记录', path: '40_发布运营/发布记录', hint: '记录每件作品与读者见面的时刻' },
  { id: 'metric', group: '发布运营', name: '数据记录', path: '40_发布运营/数据记录', hint: '在相同平台和统计窗口下观察变化' },
  { id: 'review', group: '发布运营', name: '复盘总结', path: '40_发布运营/复盘总结', hint: '让每次创作，都成为下一次的经验' },
] as const;
export type CategoryId = typeof categories[number]['id'];
export const statuses = ['灵感', '待创作', '创作中', '待发布', '已发布'] as const;
export type Status = typeof statuses[number];
export const categoryOf = (id: string) => categories.find(c => c.id === id) ?? categories[0];
export const categoryAtPath = (path: string) => categories.find(c => path.startsWith(c.path + '/'));
export const isNotePath = (path: string) => !!categoryAtPath(path) && path.endsWith('.md') && !path.endsWith('/INDEX.md');
export interface NoteInput {
  title: string;
  category: CategoryId;
  summary: string;
  body: string;
  tags: string[];
  status: Status;
  related: string[];
  platform: string;
  due: string;
  source: string;
  published: string;
  collected: string;
  window: string;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
}
export interface Note extends NoteInput {
  id: string;
  path: string;
  created: string;
  updated: string;
  example: boolean;
  revision: string;
  batch?: string;
}
export interface Snapshot { notes: Note[]; issues: string[]; vaultPath: string; }
export function emptyNote(category: CategoryId = 'inbox'): NoteInput {
  return { title: '', category, summary: '', body: '', tags: [], status: '灵感', related: [], platform: '', due: '', source: '', published: '', collected: '', window: '' };
}
export function safeUrl(value: string): string | undefined {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function validateNote(input: NoteInput) {
  if (!input || typeof input.title !== 'string' || !input.title.trim()) throw new Error('请填写标题。');
  if (input.title.length > 200) throw new Error('标题不能超过 200 个字符。');
  if (!categories.some(c => c.id === input.category)) throw new Error('请选择有效分类。');
  if (!statuses.includes(input.status)) throw new Error('请选择有效状态。');
  for (const key of ['body', 'summary', 'platform', 'due', 'source', 'published', 'collected', 'window'] as const) {
    if (typeof input[key] !== 'string') throw new Error(`${key} 必须是文本。`);
  }
  for (const key of ['tags', 'related'] as const) {
    if (!Array.isArray(input[key]) || input[key].some(v => typeof v !== 'string')) throw new Error(`${key} 必须是文本列表。`);
  }
  if (input.source && !safeUrl(input.source)) throw new Error('来源链接需以 https:// 或 http:// 开头。');
  for (const key of ['views', 'likes', 'comments', 'saves'] as const) {
    if (input[key] !== undefined && (!Number.isSafeInteger(input[key]) || input[key]! < 0)) throw new Error('数据指标必须是非负整数。');
  }
}
