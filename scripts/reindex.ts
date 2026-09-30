import { VaultStore } from '../src/core/store';
import { NodeStorage } from '../server/storage';
const store = new VaultStore(new NodeStorage(process.env.VAULT_PATH || 'local-vault'));
const result = await store.initialize();
console.log(`已索引 ${result.notes.length} 条资料：${result.vaultPath}`);
if (result.issues.length) { console.error(result.issues.join('\n')); process.exitCode = 1; }
