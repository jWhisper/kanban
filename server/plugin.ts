import type { Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import { VaultStore } from '../src/core/store';
import { isNotePath } from '../src/core/model';
import { NodeStorage } from './storage';
import { feeds, parseFeed } from '../src/core/feeds';
export function vaultPlugin(): Plugin {
  return {
    name: 'local-vault',
    async configureServer(server) {
      const root = path.resolve(process.env.VAULT_PATH || 'local-vault');
      const store = new VaultStore(new NodeStorage(root));
      await store.initialize();
      const clients = new Set<ServerResponse>();
      const broadcast = () => clients.forEach(c => c.write('data: changed\n\n'));
      let timer: ReturnType<typeof setTimeout>;
      const change = (_: string, file: string) => {
        if (!isNotePath(path.relative(root, file).split(path.sep).join('/'))) return;
        clearTimeout(timer);
        timer = setTimeout(() => { void store.refresh().then(broadcast).catch(e => server.config.logger.error(String(e))); }, 200);
      };
      server.watcher.add(root);
      server.watcher.on('all', change);
      server.httpServer?.once('close', () => { clearTimeout(timer); clients.forEach(c => c.end()); server.watcher.off('all', change); });
      let collecting = false;
      server.middlewares.use('/api', async (req, res) => {
        const json = (data: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
        try {
          const host = req.headers.host;
          if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return json({ error: '仅允许本机同源访问。' }, 403);
          if (req.url === '/state' && req.method === 'GET') return json(await store.snapshot());
          if (req.url === '/events' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            res.write(': connected\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
          }
          if (req.method !== 'POST' || req.headers['x-workbench'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) return json({ error: '不支持的请求。' }, 400);
          let body = '';
          for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) return json({ error: '单条资料内容过大。' }, 413); }
          const data = JSON.parse(body);
          if (req.url === '/notes') { const result = await store.save(data.input, data.path, data.revision); broadcast(); return json(result); }
          if (req.url === '/move') { const result = await store.move(data.path, data.revision, data.category); broadcast(); return json(result); }
          if (req.url === '/index') { const state = await store.refresh(); broadcast(); return json(state); }
          if (req.url === '/collect') {
            if (collecting) return json({ error: '已有收集任务正在运行。' }, 409);
            const feed = feeds.find(f => f.id === data.feedId);
            if (!feed) return json({ error: '请选择已配置的来源。' }, 400);
            collecting = true;
            try {
              const response = await fetch(feed.url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'CreatorWorkbench/0.1 RSS Reader' } });
              if (!response.ok) throw new Error(`来源暂时不可用（${response.status}），请稍后重试或选择其他来源。`);
              const entries = parseFeed(await response.text(), feed.id);
              const known = new Set((await store.snapshot()).notes.map(n => n.source));
              let added = 0;
              for (const entry of entries) if (!known.has(entry.source)) { await store.save(entry); known.add(entry.source); added++; }
              broadcast(); return json({ added, snapshot: await store.snapshot() });
            } finally { collecting = false; }
          }
          json({ error: '接口不存在。' }, 404);
        } catch (e) { json({ error: (e as Error).message }, 400); }
      });
    },
  };
}
