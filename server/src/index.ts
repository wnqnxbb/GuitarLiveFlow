import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { songsRepo } from './db.js';
import { seedIfEmpty } from './seed.js';

const app = Fastify({ logger: { level: config.isProd ? 'info' : 'debug' } });

await app.register(fastifyCookie);
await app.register(fastifyMultipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
await app.register(fastifyWebsocket);

// 上传的谱子图片
await app.register(fastifyStatic, {
  root: config.uploadsDir,
  prefix: '/uploads/',
  decorateReply: false,
  maxAge: '7d',
});

await registerRoutes(app);

// 生产环境：托管前端构建产物，未知路径回退到 index.html 交给前端路由
if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  await app.register(fastifyStatic, {
    root: config.clientDist,
    prefix: '/',
    wildcard: false,
    maxAge: '1h',
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api/') || req.raw.url?.startsWith('/ws/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.type('text/html').send(fs.readFileSync(path.join(config.clientDist, 'index.html')));
  });
}

if (songsRepo.count() === 0) {
  seedIfEmpty();
}

app.get('/api/health', async () => ({ ok: true, songs: songsRepo.count() }));

await app.listen({ port: config.port, host: config.host });
