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
  if (!seedDir) return;
  if (songsRepo.count() > 0) return;
  for (const file of fs.readdirSync(seedDir)) {
    if (!file.endsWith('.cho')) continue;
    const chordpro = fs.readFileSync(path.join(seedDir, file), 'utf8');
    const base = path.basename(file, '.cho');
    const meta = parseChordPro(chordpro).meta;
    const song = songsRepo.create({
      title: meta.title || base,
      artist: meta.subtitle ?? '',
      key: meta.key ?? '',
      capo: meta.capo ?? 0,
      chordpro,
    });
    for (const img of fs.readdirSync(seedDir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(img) || !img.startsWith(base)) continue;
      const target = `${song.id}-seed-${img}`;
      fs.copyFileSync(path.join(seedDir, img), path.join(config.uploadsDir, target));
      songsRepo.addImage(song.id, target);
    }
    console.log(`已导入示例歌曲: ${base}`);
  }
}

// 直接运行 `npm run seed` 时执行
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedIfEmpty();
  console.log(`当前共 ${songsRepo.count()} 首歌`);
}
