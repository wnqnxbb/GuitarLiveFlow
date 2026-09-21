import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { startHeartbeat } from './room.js';
import { songsRepo } from './db.js';
import { seedIfEmpty } from './seed.js';

// 反代（Caddy）后取 X-Forwarded-For 里的真实客户端 IP，登录限流按它计数
const app = Fastify({ trustProxy: true, logger: { level: config.isProd ? 'info' : 'debug' } });

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
startHeartbeat();

// 生产环境：托管前端构建产物，未知路径回退到 index.html 交给前端路由
const indexPath = path.join(config.clientDist, 'index.html');
if (fs.existsSync(indexPath)) {
  let indexHtml: Buffer | null = null;
  let indexMtimeMs = 0;
  // index.html 带缓存读取，文件变了重新读；回退响应不会发旧内容
  const getIndexHtml = (): Buffer | null => {
    try {
      const stat = fs.statSync(indexPath);
      if (!indexHtml || stat.mtimeMs !== indexMtimeMs) {
        indexHtml = fs.readFileSync(indexPath);
        indexMtimeMs = stat.mtimeMs;
      }
    } catch {
      /* 文件被删则沿用上一次缓存 */
    }
    return indexHtml;
  };

  await app.register(fastifyStatic, {
    root: config.clientDist,
    prefix: '/',
    wildcard: false,
    // 只有 vite 产出的 /assets/<name>-<hash>.<ext> 才是内容寻址的，可以永久缓存；
    // 其余（index.html、icons、/fonts/ 等固定文件名）一律 no-cache 走 ETag 校验，
    // 否则发新版后浏览器会拿着旧的字体声明/图标一直不放。
    setHeaders: (reply, filepath) => {
      const hashed = filepath.includes(`${path.sep}assets${path.sep}`);
      reply.header('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api/') || req.raw.url?.startsWith('/ws/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    const html = getIndexHtml();
    if (!html) return reply.code(404).send({ error: 'Not found' });
    return reply.type('text/html').header('Cache-Control', 'no-cache').send(html);
  });
}

if (songsRepo.count() === 0) {
  seedIfEmpty();
}

app.get('/api/health', async () => ({ ok: true, songs: songsRepo.count() }));

await app.listen({ port: config.port, host: config.host });
