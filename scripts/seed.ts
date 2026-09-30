import { VaultStore } from '../src/core/store';
import { NodeStorage } from '../server/storage';
import { categoryOf, emptyNote, type CategoryId, type NoteInput } from '../src/core/model';
import { writeNote } from '../src/core/markdown';

// 只写项目内的示例库；不会读取 VAULT_PATH 或修改用户的正式知识库。
const storage = new NodeStorage('local-vault');
const store = new VaultStore(storage);
await store.initialize();
type Sample = [string, CategoryId, string, string, string, Partial<NoteInput>?];
const samples: Sample[] = [
  ['position', 'profile', '我的创作方向：把技术讲给生活听', '关注 AI、个人效率与普通人的小实验，用真实过程代替空泛结论。', '## 内容方向\n\n- 用 AI 解决身边的小问题\n- 分享有过程、有失败的个人实验\n- 用普通人听得懂的话解释技术\n\n## 表达风格\n\n直接、具体、有一点幽默。先讲发生了什么，再讲我怎么看。', { tags: ['创作定位', '表达风格'] }],
  ['price', 'project', '用 AI 做保价工具的一次小实验', '从一次购物后的降价，开始尝试做一个自动检查价格的小工具。', '## 起点\n\n购物后发现价格变动，想验证能否用 AI 帮忙搭一个提醒工具。\n\n## 实验过程\n\n先用少量商品做人工对照，再考虑自动抓取。真正耗时的是确认价格口径，而不是写代码。\n\n## 值得讲的点\n\n工具不是终点，减少一件真实生活里的麻烦才是。\n\n## 待补充\n\n实际测试天数、误报次数和节省金额。', { tags: ['AI 实践', '小工具'] }],
  ['work', 'work', '一次需求沟通，为什么讲了三遍', '从沟通成本里观察：当我们说“简单一点”，到底想要什么。', '## 发生了什么\n\n团队对“简单”的理解不同，演示一个具体例子后才达成一致。\n\n## 我的观察\n\n抽象形容词容易制造共识的假象。下次先拿出用户会经历的完整流程。', { tags: ['工作观察', '沟通'] }],
  ['life', 'life', '周末散步时，重新注意到附近的店', '一次没有目的地的散步，让我重新观察熟悉的生活。', '## 记录\n\n关掉导航，沿街走一小段路。记下三家以前没注意过的小店。\n\n## 可以继续思考\n\n效率之外，留一点没有目标的时间。', { tags: ['生活记录', '观察'] }],
  ['thought', 'thought', '先完成一个小作品，再谈个人品牌', '持续创作的动力，也许来自完成感，而不是宏大的定位。', '## 想法\n\n与其不断准备，不如把一件自己经历过的小事讲清楚。\n\n## 下一步\n\n选一个能在周末完成的选题，缩小范围并真的发布。', { tags: ['创作感悟'] }],
  ['trend', 'trend', '观察清单：AI 如何进入日常工作流', '待核实的观察方向：从聊天问答走向有明确输入与输出的任务。', '## 观察方向\n\n关注工具能否把结果保存到日常工作中使用的资料里。\n\n> 这是示例观察清单，不代表已核实的当日新闻。发布前应查阅官方资料。', { tags: ['AI', '行业观察'] }],
  ['case', 'case', '拆解：一个小工具介绍，如何讲成好故事', '从问题、尝试到结果，观察技术内容怎样降低理解门槛。', '## 开头\n\n先展示一个具体的困扰。\n\n## 中段\n\n保留失败尝试，让结果有可信的过程。\n\n## 结尾\n\n交代工具适合谁、还存在什么限制。\n\n> 虚构案例框架，用于展示拆解笔记结构。', { tags: ['内容结构', '案例拆解'] }],
  ['reference', 'reference', 'Obsidian 属性与本地知识管理', '用 Markdown 正文保留表达，用属性帮助筛选与关联。', '## 参考方向\n\n为资料添加稳定编号和分类索引，让人和 AI 都能找到原文。\n\n## 来源\n\n阅读 Obsidian 官方属性说明。', { source: 'https://help.obsidian.md/properties', tags: ['知识管理', 'Obsidian'] }],
  ['method', 'method', '一个选题，先回答这三个问题', '讲给谁听、为什么现在讲、我有什么独特依据。', '1. 谁正在遇到这个问题？\n2. 看完之后，他能做什么不同的事？\n3. 哪段亲身经历或原始资料支撑我的观点？', { tags: ['选题方法'] }],
  ['tool', 'tool', '创作工具箱：用 Codex 协作', '让 AI 读取当前资料、讨论方向，再把确认过的结果写回。', '## 使用场景\n\n- 从经历中提炼选题\n- 根据资料完善提纲\n- 对已有数据做复盘\n\n## 约定\n\n事实要有来源，推断要标明。', { tags: ['Codex', '工具资源'], source: 'https://learn.chatgpt.com/docs/reference/commands' }],
  ['topic-price', 'topic', '我用 AI 做了个保价工具，然后呢？', '从一个生活小问题切入，讲清做工具的过程与局限。', '## 核心角度\n\n用真实问题驱动学习，比追逐新工具更有效。\n\n## 待补充\n\n实际效果与失败案例。', { status: '创作中', related: ['example-price', 'example-case'], tags: ['AI 实践', '个人故事'], platform: '小红书' }],
  ['topic-notes', 'topic', '让笔记不再吃灰：我的创作工作台', '把经历、选题和作品连接起来，展示知识如何真正被使用。', '## 结构\n\n从一条收集记录出发，展示它如何变成一个选题和一份稿件。', { status: '待创作', related: ['example-reference'], tags: ['知识管理'], platform: 'B 站' }],
  ['topic-work', 'topic', '“简单一点”，为什么总说不清楚？', '用一次需求沟通的小故事，聊聊抽象词带来的误解。', '## 开头\n\n从三次沟通的不同理解开始，最后用一个具体例子收束。', { status: '灵感', related: ['example-work'], tags: ['工作观察'], platform: '小红书' }],
  ['topic-walk', 'topic', '周末，给自己一个没有目的地的下午', '关于效率之外的生活，以及重新发现附近的小事。', '## 发布前检查\n\n- 确认照片没有他人隐私\n- 核对引用与地点\n- 标题和正文保持一致', { status: '待发布', related: ['example-life'], tags: ['生活记录'], platform: '小红书' }],
  ['topic-first', 'topic', '开始创作之前，我删掉了三个计划', '分享把大目标缩小成一个可以完成的小作品的过程。', '## 结论\n\n保留一次可完成的行动，其余想法进入收集箱。', { status: '已发布', related: ['example-thought'], tags: ['创作日常'], platform: '小红书' }],
  ['draft-price', 'draft', '保价工具实验｜第一版口播稿', '从“买完就降价”的场景进入，保留试错过程。', '## 开头\n\n买完一个东西，第二天就看到它降价，你会怎么办？\n\n## 中段提纲\n\n1. 为什么想做这个工具\n2. 哪些地方 AI 帮到了忙\n3. 哪些判断仍然要自己做\n\n## 待补充\n\n填入真实实验结果后，再完成结尾。', { status: '创作中', related: ['example-topic-price'], tags: ['口播稿'], platform: '小红书' }],
  ['publication', 'publication', '发布记录｜开始创作之前', '示例发布记录，展示一个作品在单个平台的发布信息。', '## 实际标题\n\n开始创作之前，我删掉了三个计划\n\n## 备注\n\n此记录仅用于演示，不对应真实发布。', { status: '已发布', related: ['example-topic-first'], platform: '小红书', published: '2026-09-28', tags: ['发布记录'] }],
  ['metric', 'metric', '开始创作之前｜发布后 24 小时', '虚构指标，仅用于演示数据记录和复盘关联。', '## 数据说明\n\n以下均为示例数字，不可作为真实表现或创作建议的依据。', { related: ['example-publication'], platform: '小红书', window: '发布后 24 小时', collected: '2026-09-29T18:00', views: 1280, likes: 86, comments: 12, saves: 47, tags: ['示例数据'] }],
  ['review', 'review', '第一次发布后的复盘笔记', '把反馈变成下一次可以验证的小实验。', '## 观察\n\n示例：具体的行动步骤可能比抽象感悟更容易让人记住。\n\n## 不确定的地方\n\n单次发布不足以证明某一种内容结构更有效。\n\n## 下一次实验\n\n沿用同一主题，尝试更具体的开头，并在相同时间窗口记录数据。', { related: ['example-publication', 'example-metric'], tags: ['创作复盘'] }],
  ['inbox', 'inbox', '灵感：把一次失败也讲出来', '有时候，不成功的尝试更能让人理解真实的过程。', '下次做项目时，随手保留失败的截图和当时的判断。', { tags: ['待整理'] }],
];
let added = 0;
for (let i = 0; i < samples.length; i++) {
  const [id, category, title, summary, body, meta] = samples[i];
  const file = `${categoryOf(category).path}/${title.replace(/[\\/:*?"<>|]/g, '-')}.md`;
  if (await storage.read(file) !== null) continue;
  const now = new Date(Date.now() - (samples.length - i) * 3_600_000).toISOString();
  await storage.create(file, writeNote({ ...emptyNote(category), title, summary, body: `> 示例资料，用于体验工作台；不代表用户真实经历。\n\n${body}\n`, ...meta }, `example-${id}`, undefined, true, now));
  added++;
}
await store.refresh();
console.log(`示例知识库：${storage.root}\n新增 ${added} 条示例资料（重复运行不会覆盖现有内容）。`);
