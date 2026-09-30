import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { decodeHTML } from 'entities';
import { emptyNote, safeUrl, type NoteInput } from './model';
export const feeds = [
  { id: 'sspai', name: '少数派', description: '数字生活与效率工具', url: 'https://sspai.com/feed' },
  { id: 'ruanyifeng', name: '阮一峰的网络日志', description: '科技爱好者周刊与技术观察', url: 'https://www.ruanyifeng.com/blog/atom.xml' },
  { id: 'hackernews', name: 'Hacker News', description: '技术与独立开发', url: 'https://news.ycombinator.com/rss' },
] as const;
const array = (value: unknown): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: any): string => typeof value === 'string' ? value : String(value?.['#text'] ?? '');
const plain = (value: any) => decodeHTML(decodeHTML(text(value))).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function parseFeed(xml: string, feedId: string): NoteInput[] {
  const feed = feeds.find(f => f.id === feedId);
  if (!feed) throw new Error('未配置此资讯来源。');
  if (xml.length > 3_000_000 || XMLValidator.validate(xml) !== true) throw new Error('来源没有返回有效的 RSS / Atom 内容。');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  const items = parsed.rss?.channel?.item ?? parsed.feed?.entry;
  if (!items) throw new Error('订阅内容中没有资讯条目。');
  const seen = new Set<string>();
  return array(items).slice(0, 20).flatMap(item => {
    const link = array(item.link).find(l => typeof l === 'string' || !l['@_rel'] || l['@_rel'] === 'alternate');
    const source = safeUrl(decodeHTML(typeof link === 'string' ? link : link?.['@_href'] ?? ''));
    const title = plain(item.title).slice(0, 200);
    if (!source || !title || seen.has(source)) return [];
    seen.add(source);
    const date = new Date(text(item.pubDate || item.published || item.updated));
    const summary = plain(item.description || item.summary || item.content).slice(0, 300);
    return [{ ...emptyNote('inbox'), title, summary, source, tags: [feed.name, '资讯收集'], collected: new Date().toISOString(), published: Number.isNaN(date.getTime()) ? '' : date.toISOString(), body: `# ${title}\n\n${summary}\n\n来源：[${feed.name}](${source})\n\n> RSS 摘要，尚未核实全文。整理后可关联到选题。\n` }];
  });
}
