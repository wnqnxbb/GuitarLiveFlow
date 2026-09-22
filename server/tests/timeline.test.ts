import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { TimelineClock, timelineError, timelineLine } from '../../shared/timeline.js';

const directory = mkdtempSync(path.join(tmpdir(), 'guitar-timeline-test-'));
process.env.DATA_DIR = directory;
process.env.ADMIN_PASSWORD = 'timeline-test-only';
const { db, songsRepo } = await import('../src/db.js');
const { registerRoutes } = await import('../src/routes.js');
const { default: Fastify } = await import('fastify');
const { default: websocket } = await import('@fastify/websocket');
const { default: cookie } = await import('@fastify/cookie');
const app = Fastify();
await app.register(cookie);
await app.register(websocket);
await registerRoutes(app);
after(async () => { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); });

/** 验证长短句、延迟回调、暂停、变速和现场校准，避免节拍累计偏移。 */
test('时间轴按绝对经过时间定位，暂停和校准后不会被旧计时推走', () => {
  let now = 0;
  const clock = new TimelineClock(() => now);
  const times = [2, 6, 15];
  clock.play();
  assert.equal(timelineLine(times, clock.position()), -1);
  now = 2500;
  assert.equal(timelineLine(times, clock.position()), 0);
  clock.pause();
  now = 20000;
  assert.equal(clock.position(), 2.5);
  clock.play();
  now = 23500;
  assert.equal(timelineLine(times, clock.position()), 1);
  clock.seek(2); // 退回第一句开头，第二句必须等完整四秒。
  now = 27499;
  assert.equal(timelineLine(times, clock.position()), 0);
  now = 27500;
  assert.equal(timelineLine(times, clock.position()), 1);
  clock.setRate(0.5);
  assert.equal(clock.position(), 6);
  now = 35500;
  assert.equal(clock.position(), 10);
  clock.pause();
  clock.seek(6); // 暂停时校准，继续后仍从选中的句子开始。
  now = 50000;
  clock.play();
  now = 68000;
  assert.equal(timelineLine(times, clock.position()), 2);
  now = 100000;
  assert.equal(timelineLine(times, clock.position()), 2);
});

/** 不允许漏点、乱序、重复时间、非数字以及词谱版本不匹配。 */
test('完整时间轴校验覆盖异常值和改词后的旧数据', () => {
  assert.equal(timelineError({ source: '谱', times: [0, 2.3, 10] }, '谱', 3), null);
  for (const times of [[0, 2], [0, 0, 4], [0, 4, 3], [-1, 2, 3], [0, NaN, 3], [0, Infinity, 3], [0, '2', 3], [0, null, 3], [0, 3, 90000]]) {
    assert.ok(timelineError({ source: '谱', times }, '谱', 3));
  }
  assert.ok(timelineError({ source: '旧谱', times: [0, 2, 3] }, '新谱', 3));
});

/** 通过真实 HTTP 路由验证权限、落盘、重复歌词、改谱失效及删除级联。 */
test('时间轴保存受保护，持久化且随词谱版本校验', async () => {
  const chordpro = '{title: 测试}\n[C]\n[C]第一句\n[G]重复句\n[C]重复句';
  const song = songsRepo.create({ title: '测试', chordpro });
  assert.equal(song.timeline, null);
  const timeline = { source: chordpro, times: [0, 3, 6, 12] };
  const url = `/api/songs/${song.id}/timeline`;
  assert.equal((await app.inject({ method: 'PUT', url, payload: timeline })).statusCode, 401);
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'timeline-test-only' } });
  const cookies = { gs_admin: login.cookies[0].value };
  const saved = await app.inject({ method: 'PUT', url, payload: timeline, cookies });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.json().timeline, timeline);
  assert.deepEqual((await app.inject(`/api/songs/${song.id}`)).json().timeline, timeline);
  const reopened = new Database(db.name);
  const row = reopened.prepare('SELECT times FROM song_timelines WHERE song_id = ?').get(song.id) as { times: string };
  assert.deepEqual(JSON.parse(row.times), timeline.times);
  reopened.close();
  assert.equal((await app.inject({ method: 'PUT', url, payload: { ...timeline, times: [0] }, cookies })).statusCode, 400);
  assert.deepEqual(songsRepo.get(song.id)?.timeline, timeline);
  songsRepo.update(song.id, { title: '改词', chordpro: chordpro + '\n[G]新的一句' });
  assert.equal(songsRepo.get(song.id)?.timeline, null);
  assert.equal((await app.inject({ method: 'PUT', url, payload: timeline, cookies })).statusCode, 400);
  songsRepo.remove(song.id);
  assert.equal(db.prepare('SELECT * FROM song_timelines WHERE song_id = ?').get(song.id), undefined);
  assert.equal((await app.inject({ method: 'PUT', url, payload: timeline, cookies })).statusCode, 404);
});

/** 首句前等待状态和时间轴模式必须能完整同步给大屏。 */
test('房间接受首句前等待状态和时间轴播放模式', async () => {
  const { getRoom } = await import('../src/room.js');
  const room = getRoom('timeline-test');
  room.update({ lineIndex: -1, mode: 'timeline' });
  assert.equal(room.state.lineIndex, -1);
  assert.equal(room.state.mode, 'timeline');
  room.update({ lineIndex: 3, mode: 'manual' });
  assert.equal(room.state.lineIndex, 3);
});
