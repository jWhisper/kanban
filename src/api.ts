import type { CategoryId, NoteInput, Snapshot } from './core/model';
export interface WorkbenchAPI {
  load(): Promise<Snapshot>;
  save(input: NoteInput, path?: string, revision?: string): Promise<{ snapshot: Snapshot; path: string }>;
  reindex(): Promise<Snapshot>;
  move(path: string, revision: string, category: CategoryId): Promise<{ snapshot: Snapshot; path: string }>;
  collect(feedId: string): Promise<{ added: number; snapshot: Snapshot }>;
  subscribe(callback: () => void): () => void;
  openNote?(path: string): void;
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workbench': '1' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作未完成，请重试。');
  return data;
}
export const webAPI: WorkbenchAPI = {
  load: () => request('state'),
  save: (input, path, revision) => request('notes', { input, path, revision }),
  reindex: () => request('index', {}),
  move: (path, revision, category) => request('move', { path, revision, category }),
  collect: feedId => request('collect', { feedId }),
  subscribe(callback) {
    const events = new EventSource('/api/events');
    events.onmessage = callback;
    events.onopen = callback;
    return () => events.close();
  },
};
