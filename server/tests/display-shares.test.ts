import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

// 在导入配置之前指定隔离目录，不接触开发或生产歌曲数据。
const directory = mkdtempSync(path.join(tmpdir(), 'sound-curtain-test-'));
process.env.DATA_DIR = directory;
const { db, songsRepo } = await import('../src/db.js');
const { createDisplayShares } = await import('../src/display-shares.js');
const { registerRoutes } = await import('../src/routes.js');
const { default: Fastify } = await import('fastify');
const { default: websocket } = await import('@fastify/websocket');
const { default: cookie } = await import('@fastify/cookie');
const app = Fastify();
await app.register(cookie);
await app.register(websocket);
await registerRoutes(app);
after(async () => { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); });

/** 验证前导零、唯一性及失败回滚，避免简码跨歌曲串线。 */
test('简码保留前导零、复用已有记录、碰撞后重新分配', () => {
  const first = songsRepo.create({ title: '测试一', chordpro: '{title: 测试一}' });
  const second = songsRepo.create({ title: '测试二', chordpro: '{title: 测试二}' });
  const codes = [7, 7, 8];
  const shares = createDisplayShares(db, () => codes.shift()!);
  assert.equal(shares.getOrCreate(first.id)?.code, '000007');
  assert.equal(shares.getOrCreate(first.id)?.code, '000007');
  assert.equal(shares.getOrCreate(second.id)?.code, '000008');
  assert.equal(shares.resolve('000007')?.songId, first.id);
  assert.equal(shares.resolve('7'), null);
  // 新连接从磁盘读取映射，验证服务重建仓库后密钥仍可使用。
  const reopened = new Database(db.name);
  assert.equal(createDisplayShares(reopened).getOrCreate(first.id)?.code, '000007');
  reopened.close();
  const third = songsRepo.create({ title: '碰撞测试', chordpro: '' });
  assert.throws(() => createDisplayShares(db, () => 7).getOrCreate(third.id), /稍后重试/);
  assert.equal(db.prepare('SELECT * FROM display_shares WHERE song_id = ?').get(third.id), undefined);
  songsRepo.remove(first.id);
  assert.equal(shares.resolve('000007'), null);
});

/** HTTP 集成覆盖分享创建、解析、错误参数和删除失效。 */
test('分享 API 返回相同大屏路由并正确处理错误', async () => {
  const song = songsRepo.create({ title: '接口测试', chordpro: '{title: 接口测试}' });
  const created = await app.inject({ method: 'POST', url: `/api/songs/${song.id}/display-share`, payload: {} });
  assert.equal(created.statusCode, 200);
  const share = created.json();
  assert.match(share.code, /^\d{6}$/);
  assert.equal(share.path, `/display/${song.id}`);
  const repeated = await app.inject({ method: 'POST', url: `/api/songs/${song.id}/display-share`, payload: {} });
  assert.deepEqual(repeated.json(), share);
  const resolved = await app.inject({ method: 'POST', url: '/api/display-shares/resolve', payload: { code: share.code } });
  assert.deepEqual(resolved.json(), share);
  assert.equal(resolved.headers['cache-control'], 'no-store');
  for (const code of [123456, '12345', '1234567', 'abcdef', null]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/display-shares/resolve', payload: { code } })).statusCode, 400);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/songs/0/display-share' })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/songs/999999/display-share' })).statusCode, 404);
  songsRepo.remove(song.id);
  assert.equal((await app.inject({ method: 'POST', url: '/api/display-shares/resolve', payload: { code: share.code } })).statusCode, 404);
});
