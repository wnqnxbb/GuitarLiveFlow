import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { config } from './config.js';
import { songsRepo, type SongInput } from './db.js';
import { checkPassword, clearAdminCookie, isAdmin, requireAdmin, setAdminCookie } from './auth.js';
import { broadcastAll, getRoom, markAlive, startHeartbeat } from './room.js';
import { parseChordPro } from '../../shared/chordpro.js';
import type { ClientMessage, ClientRole } from '../../shared/types.js';

/** 同步房间号：每首歌一个房间，形如 song-12，由客户端按歌曲 id 生成 */
const ROOM_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;

function songInputFromBody(body: unknown): SongInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const chordpro = typeof b.chordpro === 'string' ? b.chordpro : '';
  const parsed = parseChordPro(chordpro);
  const title = (typeof b.title === 'string' && b.title.trim()) || parsed.meta.title.trim();
  if (!title) return null;
  return {
    title,
    artist: typeof b.artist === 'string' ? b.artist.trim() : parsed.meta.subtitle ?? '',
    key: typeof b.key === 'string' ? b.key.trim() : parsed.meta.key ?? '',
    capo: typeof b.capo === 'number' ? b.capo : parsed.meta.capo ?? 0,
    chordpro,
  };
}

/* ---------- 登录限流：同一 IP 10 分钟内最多 5 次失败，成功后清零 ---------- */
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const loginFails = new Map<string, { count: number; start: number }>();

function loginBlocked(ip: string): boolean {
  const rec = loginFails.get(ip);
  if (!rec || Date.now() - rec.start > LOGIN_WINDOW) return false;
  return rec.count >= LOGIN_MAX_FAILS;
}

function recordLoginFail(ip: string): void {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec || now - rec.start > LOGIN_WINDOW) {
    loginFails.set(ip, { count: 1, start: now });
  } else {
    rec.count += 1;
  }
  // 顺带清理过期记录，避免 Map 无限增长
  if (loginFails.size > 500) {
    for (const [key, r] of loginFails) {
      if (now - r.start > LOGIN_WINDOW) loginFails.delete(key);
    }
  }
}

function clearLoginFails(ip: string): void {
  loginFails.delete(ip);
}

export async function registerRoutes(app: FastifyInstance) {
  /* ---------- 登录 ---------- */
  app.get('/api/me', async (req) => ({ admin: isAdmin(req) }));

  app.post<{ Body: { password?: string } }>('/api/login', async (req, reply) => {
    const ip = req.ip;
    if (loginBlocked(ip)) {
      return reply.code(429).send({ error: '尝试次数过多，请十分钟后再试' });
    }
    if (!checkPassword(req.body?.password ?? '')) {
      recordLoginFail(ip);
      return reply.code(401).send({ error: '密码不对' });
    }
    clearLoginFails(ip);
    setAdminCookie(reply);
    return { admin: true };
  });

  app.post('/api/logout', async (_req, reply) => {
    clearAdminCookie(reply);
    return { admin: false };
  });

  /* ---------- 歌曲 ---------- */
  app.get('/api/songs', async () => songsRepo.list());

  app.get<{ Params: { id: string } }>('/api/songs/:id', async (req, reply) => {
    const song = songsRepo.get(Number(req.params.id));
    if (!song) return reply.code(404).send({ error: '歌曲不存在' });
    return song;
  });

  app.post('/api/songs', { preHandler: requireAdmin }, async (req, reply) => {
    const input = songInputFromBody(req.body);
    if (!input) return reply.code(400).send({ error: '缺少歌名' });
    return reply.code(201).send(songsRepo.create(input));
  });

  app.put<{ Params: { id: string } }>('/api/songs/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const input = songInputFromBody(req.body);
    if (!input) return reply.code(400).send({ error: '缺少歌名' });
    const song = songsRepo.update(Number(req.params.id), input);
    if (!song) return reply.code(404).send({ error: '歌曲不存在' });
    broadcastAll({ type: 'song_updated', songId: song.id });
    return song;
  });

  app.delete<{ Params: { id: string } }>('/api/songs/:id', { preHandler: requireAdmin }, async (req) => {
    const files = songsRepo.remove(Number(req.params.id));
    await Promise.all(files.map((f) => fs.rm(path.join(config.uploadsDir, f), { force: true })));
    return { ok: true };
  });

  /* ---------- 图片 ---------- */
  app.post<{ Params: { id: string } }>('/api/songs/:id/images', { preHandler: requireAdmin }, async (req, reply) => {
    const songId = Number(req.params.id);
    if (!songsRepo.get(songId)) return reply.code(404).send({ error: '歌曲不存在' });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: '没有文件' });
    const ext = path.extname(file.filename).toLowerCase() || '.jpg';
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return reply.code(400).send({ error: '只支持 jpg/png/webp/gif' });
    }
    const filename = `${songId}-${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    await pipeline(file.file, createWriteStream(path.join(config.uploadsDir, filename)));
    if (file.file.truncated) {
      await fs.rm(path.join(config.uploadsDir, filename), { force: true });
      return reply.code(413).send({ error: '文件太大' });
    }
    const image = songsRepo.addImage(songId, filename);
    broadcastAll({ type: 'song_updated', songId });
    return reply.code(201).send(image);
  });

  app.delete<{ Params: { id: string; imageId: string } }>(
    '/api/songs/:id/images/:imageId',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const filename = songsRepo.removeImage(Number(req.params.id), Number(req.params.imageId));
      if (!filename) return reply.code(404).send({ error: '图片不存在' });
      await fs.rm(path.join(config.uploadsDir, filename), { force: true });
      broadcastAll({ type: 'song_updated', songId: Number(req.params.id) });
      return { ok: true };
    },
  );

  /* ---------- 房间状态（HTTP 兜底） ---------- */
  app.get<{ Params: { code: string } }>('/api/rooms/:code/state', async (req, reply) => {
    if (!ROOM_KEY_RE.test(req.params.code)) return reply.code(404).send({ error: '房间不存在' });
    return getRoom(req.params.code).state;
  });

  /* ---------- WebSocket ---------- */
  app.get<{ Params: { code: string }; Querystring: { role?: string } }>(
    '/ws/rooms/:code',
    { websocket: true },
    (socket, req) => {
      if (!ROOM_KEY_RE.test(req.params.code)) {
        socket.close(4004, '房间不存在');
        return;
      }
      const role: ClientRole = req.query.role === 'controller' ? 'controller' : 'display';
      const room = getRoom(req.params.code);
      markAlive(socket);
      room.join(socket, role);

      socket.on('message', (raw) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
          return;
        }
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        } else if (msg.type === 'state' && role === 'controller') {
          room.update(msg.state);
        }
      });
      socket.on('close', () => room.leave(socket));
      socket.on('error', () => room.leave(socket));
    },
  );
}
