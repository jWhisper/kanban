import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeStorage } from '../server/storage';
import { ConflictError, VaultStore } from '../src/core/store';
import { emptyNote } from '../src/core/model';
import { parseNote, splitMarkdown, writeNote } from '../src/core/markdown';
import { buildIndexes, mergeIndex } from '../src/core/indexes';
import { codexUrl, codexPrompt, researchUrl, researchPrompt, bingSearchUrl } from '../src/core/codex';
import { searchNotes, todayTopics, topicReason, hotspotNotes, hotspotBatch, groupHotspots } from '../src/core/discovery';
import { parseFeed } from '../src/core/feeds';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'creator-workbench-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const storage = new NodeStorage(root), store = new VaultStore(storage);
  await store.initialize();
  return { root, storage, store };
}
test('创建、编辑和索引写入真实 Markdown，且不把 revision 写回属性', async t => {
  const { store, storage } = await fixture(t);
  const saved = await store.save({ ...emptyNote('topic'), title: '保价实验', body: '# 正文\n\n测试内容', tags: ['AI', 'AI', ''] });
  const note = saved.snapshot.notes[0];
  assert.equal(note.title, '保价实验');
  assert.deepEqual(note.tags, ['AI']);
  const result = await store.save({ ...note, status: '创作中', body: '# 第二版\n' }, note.path, note.revision);
  const raw = await storage.read(note.path);
  assert.ok(raw?.includes('# 第二版'));
  const { doc } = splitMarkdown(raw!);
  assert.equal(doc.has('revision'), false);
  assert.equal(doc.has('path'), false);
  assert.equal(result.snapshot.notes[0].id, note.id);
  assert.ok((await storage.read('30_内容创作/选题库/INDEX.md'))?.includes(note.id));
});
test('拒绝陈旧编辑，保留外部新修改', async t => {
  const { store, storage } = await fixture(t);
  const { snapshot } = await store.save({ ...emptyNote(), title: '冲突测试' });
  const note = snapshot.notes[0];
  await storage.process(note.path, raw => raw + '\n外部修改\n');
  await assert.rejects(store.save({ ...note, body: '陈旧编辑' }, note.path, note.revision), ConflictError);
  assert.ok((await storage.read(note.path))?.endsWith('外部修改\n'));
});
test('并发保存只有一个成功，后到的陈旧版本不能覆盖', async t => {
  const { store } = await fixture(t);
  const note = (await store.save({ ...emptyNote(), title: '并发测试' })).snapshot.notes[0];
  const results = await Promise.allSettled([store.save({ ...note, body: '版本 A' }, note.path, note.revision), store.save({ ...note, body: '版本 B' }, note.path, note.revision)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.snapshot()).notes[0].body, '版本 A');
});
test('更新保留未知 YAML 字段、注释和创建时间', () => {
  const raw = '---\nid: stable\ncreated: 2025-01-01\ncustom: yes # 保留这条注释\n---\n旧正文';
  const next = writeNote({ ...emptyNote('work'), title: '新标题', body: '新正文' }, 'stable', raw);
  assert.match(next, /custom: yes # 保留这条注释/);
  assert.match(next, /created: 2025-01-01/);
  assert.equal(parseNote('10_个人资料/工作经历/笔记.md', next).body, '新正文');
});
test('损坏 YAML 不被覆盖，索引显示诊断，模板不作为笔记', async t => {
  const { store, storage } = await fixture(t);
  await storage.create('00_收集箱/损坏.md', '---\na: [\n---\n不能丢失');
  const state = await store.refresh();
  assert.equal(state.notes.length, 0);
  assert.equal(state.issues.length, 1);
  assert.match((await storage.read('INDEX.md'))!, /损坏/);
  assert.match((await storage.read('00_收集箱/损坏.md'))!, /不能丢失/);
});
test('外部重命名、移动和删除后，索引去除旧路径且不写回笔记', async t => {
  const { store, root, storage } = await fixture(t);
  const note = (await store.save({ ...emptyNote(), title: '移动测试' })).snapshot.notes[0];
  const next = '20_知识素材/热点资讯/新名字.md';
  await fs.rename(path.join(root, note.path), path.join(root, next));
  let state = await store.refresh();
  assert.equal(state.notes[0].category, 'trend');
  assert.equal(state.notes[0].id, note.id);
  assert.equal((await storage.read('00_收集箱/INDEX.md'))?.includes(note.id), false);
  assert.ok(decodeURI((await storage.read('20_知识素材/热点资讯/INDEX.md'))!).includes('新名字.md'));
  await fs.unlink(path.join(root, next));
  state = await store.refresh();
  assert.equal(state.notes.length, 0);
});
test('索引可重复生成、保留人工说明并转义不可信标题', () => {
  const existing = '# 我的手写说明\n\n请保留。';
  const note = parseNote('00_收集箱/笔记 #1.md', writeNote({ ...emptyNote(), title: '[点击](javascript:evil)|坏标题', summary: '换行\n与|分隔' }, 'n1'));
  const index = buildIndexes([note], []).get('00_收集箱/INDEX.md')!;
  assert.ok(index.includes('%231.md'));
  assert.ok(index.includes('\\[点击\\]'));
  const once = mergeIndex(existing, index);
  assert.equal(mergeIndex(once, index), once);
  assert.ok(once.startsWith(existing));
  assert.throws(() => mergeIndex('<!-- creator-workbench:index:start -->', '内容'));
});
test('阻止路径穿越和符号链接读写，保护知识库外文件', async t => {
  const { storage, root } = await fixture(t);
  await assert.rejects(storage.read('../README.md'));
  await assert.rejects(storage.create('/tmp/outside.md', 'x'));
  await fs.symlink(os.tmpdir(), path.join(root, 'external'));
  await assert.rejects(storage.create('external/should-not-exist.md', 'x'), /符号链接/);
});
test('重复 id 可诊断，不误关联到任意一条笔记', async t => {
  const { store, storage } = await fixture(t);
  for (const name of ['A', 'B']) await storage.create(`00_收集箱/${name}.md`, writeNote({ ...emptyNote(), title: name }, 'duplicate'));
  const state = await store.refresh();
  assert.equal(state.notes.length, 1);
  assert.match(state.issues[0], /id 重复/);
});
test('界面分类移动保留 id、正文和关联，拒绝覆盖同名文件', async t => {
  const { store, storage } = await fixture(t);
  const source = (await store.save({ ...emptyNote(), title: '整理测试', body: '原文' })).snapshot.notes[0];
  const topic = (await store.save({ ...emptyNote('topic'), title: '关联测试', related: [source.id] })).snapshot.notes.find(n => n.category === 'topic')!;
  const result = await store.move(source.path, source.revision, 'case');
  assert.equal(await storage.read(source.path), null);
  const moved = result.snapshot.notes.find(n => n.id === source.id)!;
  assert.equal(moved.category, 'case'); assert.equal(moved.body, '原文');
  assert.ok(result.snapshot.notes.find(n => n.id === topic.id)?.related.includes(moved.id));
  const target = '10_个人资料/工作经历/' + result.path.split('/').pop();
  await storage.create(target, '不可覆盖');
  await assert.rejects(store.move(moved.path, moved.revision, 'work'), /同名文件/);
  assert.equal(await storage.read(target), '不可覆盖');
  assert.equal(await storage.read(moved.path), moved.revision);
});
test('数据记录必须具有可比较的口径并关联发布记录', async t => {
  const { store } = await fixture(t);
  await assert.rejects(store.save({ ...emptyNote('metric'), title: '未注明口径', views: 10 }), /平台/);
  const publication = (await store.save({ ...emptyNote('publication'), title: '发布 A' })).snapshot.notes[0];
  const input = { ...emptyNote('metric'), title: '24 小时', platform: '小红书', collected: '2026-09-30T12:00', window: '发布后 24 小时', related: [publication.id], views: 10 };
  assert.ok((await store.save(input)).snapshot.notes.some(n => n.views === 10));
  await assert.rejects(store.save({ ...input, views: -1 }), /非负整数/);
});
test('Codex 链接正确编码空格、中文、#、&，携带路径和资料但不自动发送', () => {
  const root = '/Users/test/我的 知识库 & #1';
  const note = parseNote('00_收集箱/笔记.md', writeNote({ ...emptyNote(), title: '测试' }, 'id1'));
  const link = new URL(codexUrl(root, 'topics', note));
  assert.equal(link.protocol, 'codex:');
  assert.equal(link.searchParams.get('path'), root);
  assert.equal(link.searchParams.get('prompt'), codexPrompt('topics', note));
  assert.ok(link.searchParams.get('prompt')!.includes(note.path));
  assert.throws(() => codexUrl('relative/path', 'topics'));
});
test('RSS 和 Atom 解析保留来源、时间，过滤危险 URL 并去重', () => {
  const rss = '<rss><channel><item><title>内容 A</title><link>https://example.com/a</link><pubDate>Wed, 30 Sep 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>一段摘要</p>]]></description></item><item><title>重复</title><link>https://example.com/a</link></item><item><title>危险</title><link>javascript:alert(1)</link></item></channel></rss>';
  const items = parseFeed(rss, 'sspai');
  assert.equal(items.length, 1); assert.equal(items[0].summary, '一段摘要'); assert.equal(items[0].published, '2026-09-30T08:00:00.000Z'); assert.equal(items[0].category, 'inbox');
  const atom = '<feed><entry><title>内容 B</title><link rel="self" href="https://example.com/feed"/><link rel="alternate" href="https://example.com/b"/><summary>摘要 B</summary></entry></feed>';
  assert.equal(parseFeed(atom, 'ruanyifeng')[0].source, 'https://example.com/b');
  const escaped = '<rss><channel><item><title>A &amp; B</title><link>https://example.com/?a=1&amp;b=2</link><description><![CDATA[正文&lt;a href=&#34;https://example.com&#34;&gt;查看全文&lt;/a&gt;]]></description></item></channel></rss>';
  assert.equal(parseFeed(escaped, 'sspai')[0].summary, '正文 查看全文');
  assert.equal(parseFeed(escaped, 'sspai')[0].source, 'https://example.com/?a=1&b=2');
  assert.throws(() => parseFeed('<html>错误页面</html>', 'sspai'));
});

test('今日候选优先展示到期计划，排除未来计划、已发布与待发布内容', () => {
  const topic = (id: string, status: '灵感' | '待创作' | '创作中' | '待发布' | '已发布', due = '') => parseNote(`30_内容创作/选题库/${id}.md`, writeNote({ ...emptyNote('topic'), title: id, status, due }, id));
  const notes = [topic('future', '待创作', '2026-10-01'), topic('published', '已发布'), topic('publishing', '待发布'), topic('idea', '灵感'), topic('ready', '待创作'), topic('working', '创作中'), topic('today', '待创作', '2026-09-30')];
  const selected = todayTopics(notes, '2026-09-30');
  assert.deepEqual(selected.map(n => n.id), ['today', 'working', 'ready']);
  assert.equal(topicReason(selected[0], '2026-09-30'), '计划今天做');
  assert.equal(topicReason(topic('overdue', '灵感', '2026-09-29'), '2026-09-30'), '计划日期已到');
  assert.equal(notes[0].id, 'future');
  assert.equal(todayTopics([{ ...topic('demo', '创作中'), example: true }, topic('real', '灵感')], '2026-09-30')[0].id, 'real');
});

test('知识库查询支持跨分类、多个关键词与正文，优先标题命中', () => {
  const work = parseNote('10_个人资料/工作经历/沟通.md', writeNote({ ...emptyNote('work'), title: '需求沟通', body: '这次尝试用 AI 工具来整理案例' }, 'work'));
  const thought = parseNote('10_个人资料/个人感悟/思考.md', writeNote({ ...emptyNote('thought'), title: 'AI 工具的使用感悟' }, 'thought'));
  const other = parseNote('20_知识素材/案例拆解/其他.md', writeNote({ ...emptyNote('case'), title: '别的 AI 话题' }, 'other'));
  assert.deepEqual(searchNotes([work, thought, other], ' ai   工具 ').map(n => n.id), ['thought', 'work']);
  assert.deepEqual(searchNotes([work, thought], '个人感悟').map(n => n.id), ['thought']);
  assert.equal(searchNotes([work, thought], '完全不存在的内容').length, 0);
  assert.equal(searchNotes([work], '   ').length, 0);
});

test('查询任务指定单个平台并保留通用搜索，链接完整携带用户输入', () => {
  const query = 'AI tools & 中文 #topic\n第二行';
  const url = new URL(researchUrl('/tmp/我的知识库', 'trends', query));
  assert.equal(url.searchParams.get('path'), '/tmp/我的知识库');
  assert.equal(url.searchParams.get('prompt'), researchPrompt('trends', query));
  assert.match(url.searchParams.get('prompt')!, /本次明确选择 Bing 通用搜索/);
  const platformPrompt = researchPrompt('trends', query, 'xiaohongshu');
  assert.match(platformPrompt, /MCP server redfox-xiaohongshu-mcp/);
  assert.doesNotMatch(platformPrompt, /redfox-douyin-mcp|\$(union-search-skill|last30days)/);
  assert.match(platformPrompt, /本次全部热点/);
  assert.match(platformPrompt, /没有效|无有效新结果/);
  assert.equal(new URL(researchUrl('/tmp/vault', 'trends', query, 'xiaohongshu')).searchParams.get('prompt'), platformPrompt);
  assert.equal(new URL(bingSearchUrl(query)).searchParams.get('q'), query);
  assert.match(researchPrompt('library', '我的工作经历'), /不修改文件/);
  assert.doesNotMatch(researchPrompt('library', '我的工作经历'), /\$(union-search-skill|last30days)/);
  assert.match(researchPrompt('link', 'https://example.com/a?b=1&c=2#d'), /https:\/\/example.com\/a\?b=1&c=2#d/);
});


test('热点完整展示十条，按平台分组且历史与当前互不混入', () => {
  const current = Array.from({ length: 10 }, (_, i) => parseNote(`20_知识素材/热点资讯/${i}.md`, writeNote({ ...emptyNote('trend'), title: `热点 ${i}`, platform: i < 6 ? '小红书' : 'YouTube', published: '2026-09-29', collected: '2026-09-30' }, `trend-${i}`)));
  const archived = { ...current[0], id: 'archived', path: '20_知识素材/热点资讯/历史热点/2026-09-29/a.md', batch: '2026-09-29' };
  const topic = parseNote('30_内容创作/选题库/a.md', writeNote({ ...emptyNote('topic'), title: '选题' }, 'topic'));
  const notes = [...current, archived, topic];
  assert.equal(hotspotNotes(notes).length, 10);
  assert.deepEqual(hotspotNotes(notes, true).map(n => n.id), ['archived']);
  const groups = new Map(groupHotspots(hotspotNotes(notes)));
  assert.equal(groups.get('小红书')?.length, 6);
  assert.equal(groups.get('YouTube')?.length, 4);
  assert.equal(hotspotBatch(archived), '2026-09-29');
  assert.equal(hotspotBatch({ ...current[0], batch: '', collected: '' }), '');
});

test('采集批次读取后编辑仍保留 id、批次和未知属性，不伪装为今天', () => {
  const raw = '---\nid: stable-trend\nbatch: 2026-09-28\ncollection: daily-ai-tools\ncustom: keep\ncollected: 2026-09-29T23:00:00Z\n---\n原文';
  const note = parseNote('20_知识素材/热点资讯/a.md', raw);
  assert.equal(hotspotBatch(note), '2026-09-28');
  const next = writeNote({ ...note, title: '新标题' }, note.id, raw);
  assert.equal(splitMarkdown(next).doc.get('batch'), '2026-09-28');
  assert.equal(splitMarkdown(next).doc.get('collection'), 'daily-ai-tools');
  assert.equal(splitMarkdown(next).doc.get('custom'), 'keep');
  assert.equal(parseNote(note.path, next).id, 'stable-trend');
});
