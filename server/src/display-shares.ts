import { randomInt } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { DisplayShare } from '../../shared/types.js';

/** 创建分享简码仓库；注入数据库及随机源，便于验证碰撞和前导零。 */
export function createDisplayShares(database: Database.Database, nextCode = () => randomInt(1_000_000)): {
  getOrCreate(songId: number): DisplayShare | null;
  resolve(code: string): DisplayShare | null;
} {
  const bySong = database.prepare('SELECT code FROM display_shares WHERE song_id = ?');
  const songExists = database.prepare('SELECT id FROM songs WHERE id = ?');
  const insert = database.prepare('INSERT OR IGNORE INTO display_shares (song_id, code) VALUES (?, ?)');
  const lookup = database.prepare('SELECT song_id FROM display_shares WHERE code = ?');
  /** 在同一写事务中复用或分配简码，唯一约束保证不会串到另一首歌。 */
  const getOrCreate = database.transaction((songId: number): DisplayShare | null => {
    if (!songExists.get(songId)) return null;
    const existing = bySong.get(songId) as { code: string } | undefined;
    if (existing) return { songId, code: existing.code, path: `/display/${songId}` };
    // 有界重试，避免号段接近用完时长时间阻塞事件循环。
    for (let attempt = 0; attempt < 128; attempt++) {
      const code = String(nextCode()).padStart(6, '0');
      if (insert.run(songId, code).changes) return { songId, code, path: `/display/${songId}` };
    }
    throw new Error('分享密钥暂时无法生成，请稍后重试');
  });
  return {
    getOrCreate,
    /** 字符串查询保留前导零；简码只是公开分享链接的别名，不是管理凭证。 */
    resolve(code) {
      if (!/^\d{6}$/.test(code)) return null;
      const row = lookup.get(code) as { song_id: number } | undefined;
      return row ? { songId: row.song_id, code, path: `/display/${row.song_id}` } : null;
    },
  };
}
