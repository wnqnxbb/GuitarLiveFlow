import Database from 'better-sqlite3';
import { config } from './config.js';
import type { SongDetail, SongImage, SongSummary, SongTimeline } from '../../shared/types.js';

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    key TEXT NOT NULL DEFAULT '',
    capo INTEGER NOT NULL DEFAULT 0,
    chordpro TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS song_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_song_images_song ON song_images(song_id, sort);
  CREATE TABLE IF NOT EXISTS song_timelines (
    song_id INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    times TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS display_shares (
    song_id INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE CHECK(length(code) = 6 AND code NOT GLOB '*[^0-9]*')
  );
`);

interface SongRow {
  id: number;
  title: string;
  artist: string;
  key: string;
  capo: number;
  chordpro: string;
  updated_at: string;
}
interface ImageRow {
  id: number;
  song_id: number;
  filename: string;
  sort: number;
}

const toSummary = (r: SongRow): SongSummary => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  key: r.key,
  capo: r.capo,
  updatedAt: r.updated_at,
});
const toImage = (r: ImageRow): SongImage => ({ id: r.id, url: `/uploads/${r.filename}`, sort: r.sort });

export interface SongInput {
  title: string;
  artist?: string;
  key?: string;
  capo?: number;
  chordpro: string;
}

export const songsRepo = {
  list(): SongSummary[] {
    return (db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all() as SongRow[]).map(toSummary);
  },
  get(id: number): SongDetail | null {
    const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow | undefined;
    if (!row) return null;
    const images = (
      db.prepare('SELECT * FROM song_images WHERE song_id = ? ORDER BY sort, id').all(id) as ImageRow[]
    ).map(toImage);
    const timing = db.prepare('SELECT source, times FROM song_timelines WHERE song_id = ?').get(id) as { source: string; times: string } | undefined;
    const timeline = timing?.source === row.chordpro ? { source: timing.source, times: JSON.parse(timing.times) as number[] } : null;
    return { ...toSummary(row), chordpro: row.chordpro, images, timeline };
  },
  create(input: SongInput): SongDetail {
    const info = db
      .prepare('INSERT INTO songs (title, artist, key, capo, chordpro) VALUES (?, ?, ?, ?, ?)')
      .run(input.title, input.artist ?? '', input.key ?? '', input.capo ?? 0, input.chordpro);
    return this.get(Number(info.lastInsertRowid))!;
  },
  update(id: number, input: SongInput): SongDetail | null {
    const info = db
      .prepare(
        `UPDATE songs SET title = ?, artist = ?, key = ?, capo = ?, chordpro = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(input.title, input.artist ?? '', input.key ?? '', input.capo ?? 0, input.chordpro, id);
    return info.changes ? this.get(id) : null;
  },
  /** 独立保存时间轴，不覆盖歌曲内容；路由已校验词谱版本及时间顺序。 */
  saveTimeline(id: number, timeline: SongTimeline): SongDetail {
    db.prepare('INSERT INTO song_timelines (song_id, source, times) VALUES (?, ?, ?) ON CONFLICT(song_id) DO UPDATE SET source = excluded.source, times = excluded.times')
      .run(id, timeline.source, JSON.stringify(timeline.times));
    return this.get(id)!;
  },
  remove(id: number): string[] {
    const files = (db.prepare('SELECT filename FROM song_images WHERE song_id = ?').all(id) as { filename: string }[]).map(
      (r) => r.filename,
    );
    db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    return files;
  },
  addImage(songId: number, filename: string): SongImage {
    const next = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM song_images WHERE song_id = ?').get(songId) as {
      n: number;
    }).n;
    const info = db.prepare('INSERT INTO song_images (song_id, filename, sort) VALUES (?, ?, ?)').run(songId, filename, next);
    return { id: Number(info.lastInsertRowid), url: `/uploads/${filename}`, sort: next };
  },
  removeImage(songId: number, imageId: number): string | null {
    const row = db.prepare('SELECT * FROM song_images WHERE id = ? AND song_id = ?').get(imageId, songId) as
      | ImageRow
      | undefined;
    if (!row) return null;
    db.prepare('DELETE FROM song_images WHERE id = ?').run(imageId);
    return row.filename;
  },
  count(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM songs').get() as { n: number }).n;
  },
};
