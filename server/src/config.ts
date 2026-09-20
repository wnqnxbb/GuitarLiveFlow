import path from 'node:path';
import fs from 'node:fs';

/** 读取 .env，返回它所在目录；相对路径的 DATA_DIR 以此为基准 */
function loadDotEnv(): string {
  // 只在本地开发读取项目根目录的 .env；生产环境由 Docker/系统注入环境变量
  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
    return path.dirname(file);
  }
  return process.cwd();
}
const envDir = loadDotEnv();

const dataDir = path.resolve(envDir, process.env.DATA_DIR ?? '../data');
fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

export const config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  host: process.env.HOST ?? '0.0.0.0',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'change-me',
  roomCode: process.env.ROOM_CODE ?? 'stage',
  dataDir,
  uploadsDir: path.join(dataDir, 'uploads'),
  dbFile: path.join(dataDir, 'guitar.db'),
  /** 生产环境下前端构建产物目录 */
  clientDist: path.resolve(process.cwd(), process.env.CLIENT_DIST ?? '../client/dist'),
  isProd: process.env.NODE_ENV === 'production',
};
