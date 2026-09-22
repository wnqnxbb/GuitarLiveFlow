import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { songsRepo } from './db.js';
import { parseChordPro } from '../../shared/chordpro.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// 开发时源码在 server/src，构建后在 server/dist/server/src；向上找到项目根目录的 seed
const seedDir = [2, 3, 4, 5]
  .map((n) => path.resolve(here, ...Array(n).fill('..'), 'seed'))
  .find((d) => fs.existsSync(d));

/** 首次启动时把 seed 目录下的 .cho 文件和同名图片导入数据库 */
export function seedIfEmpty() {
  if (songsRepo.count() > 0) return;
  seedMissing();
}

/**
 * 把 seed 目录里以 base 开头的图片挂到歌曲上。
 * onlyIfEmpty=true 时，仅当这首歌当前一张图都没有才补图——避免把管理页里
 * 手动删掉的单张图在下次部署时又「复活」。
 */
function attachSeedImages(songId: number, base: string, onlyIfEmpty: boolean) {
  if (!seedDir) return;
  const images = fs
    .readdirSync(seedDir)
    .filter((img) => /\.(jpe?g|png|webp)$/i.test(img) && img.startsWith(base));
  if (images.length === 0) return;
  if (onlyIfEmpty && (songsRepo.get(songId)?.images.length ?? 0) > 0) return;
  for (const img of images) {
    const target = `${songId}-seed-${img}`;
    fs.copyFileSync(path.join(seedDir, img), path.join(config.uploadsDir, target));
    songsRepo.addImage(songId, target);
  }
  console.log(`已补齐示例图片: ${base}（${images.length} 张）`);
}

/**
 * 导入 seed 目录里「数据库还没有的」歌曲，并为缺图的歌补上同名示例图片。
 * 按标题去重，可安全重复执行；返回本次新导入的歌曲数量。
 */
export function seedMissing(): number {
  if (!seedDir) return 0;
  const existing = new Map(songsRepo.list().map((s) => [s.title, s.id]));
  let imported = 0;
  for (const file of fs.readdirSync(seedDir)) {
    if (!file.endsWith('.cho')) continue;
    const chordpro = fs.readFileSync(path.join(seedDir, file), 'utf8');
    const base = path.basename(file, '.cho');
    const meta = parseChordPro(chordpro).meta;
    const title = meta.title || base;
    let songId = existing.get(title);
    if (songId === undefined) {
      const song = songsRepo.create({
        title,
        artist: meta.subtitle ?? '',
        key: meta.key ?? '',
        capo: meta.capo ?? 0,
        chordpro,
      });
      songId = song.id;
      existing.set(title, songId);
      imported += 1;
      console.log(`已导入示例歌曲: ${base}`);
    }
    // 已经被改过名或用管理页删过的歌不重复导入，但允许补上缺少的示例图片
    attachSeedImages(songId, base, true);
  }
  return imported;
}

// 直接运行 `npm run seed` 时执行：把 seed 里新增、数据库里还没有的歌补进来
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const n = seedMissing();
  console.log(`本次导入 ${n} 首，当前共 ${songsRepo.count()} 首歌`);
}
