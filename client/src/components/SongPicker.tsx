import { useEffect, useState } from 'react';
import type { SongSummary } from '@shared/types';
import { api } from '../lib/api';

interface Props {
  value: number | null;
  onChange: (id: number) => void;
  onClose?: () => void;
  /** list = 手机上的纵向列表（默认）；cards = 电脑端的卡片宫格 */
  variant?: 'list' | 'cards';
}

/** 歌曲选择列表，带搜索，手机上按钮足够大 */
export function SongPicker({ value, onChange, onClose, variant = 'list' }: Props) {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.listSongs().then(setSongs).catch(() => setSongs([]));
  }, []);
  const filtered = songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q.trim().toLowerCase()));
  const meta = (s: SongSummary) => `${s.artist}${s.key ? ` · ${s.key}调` : ''}${s.capo ? ` · Capo ${s.capo}` : ''}`;
  if (variant === 'cards') {
    return (
      <div className="picker">
        <div className="picker__head">
          <input
            className="input"
            placeholder="搜索歌名或歌手"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {onClose && (
            <button className="btn" onClick={onClose}>
              关闭
            </button>
          )}
        </div>
        <div className="picker__gallery">
          {filtered.map((s) => (
            <button
              key={s.id}
              className={`song-card ${s.id === value ? 'is-active' : ''}`}
              onClick={() => onChange(s.id)}
            >
              <span className="song-card__title">{s.title}</span>
              <span className="song-card__artist">{s.artist || '未填写歌手'}</span>
              <span className="song-card__tags">
                {s.key && <em>{s.key} 调</em>}
                {s.capo ? <em>Capo {s.capo}</em> : null}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="picker__empty">没有歌曲，先去「管理」里添加</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="picker">
      <div className="picker__head">
        <input
          className="input"
          placeholder="搜索歌名或歌手"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        {onClose && (
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        )}
      </div>
      <ul className="picker__list">
        {filtered.map((s) => (
          <li key={s.id}>
            <button className={`picker__item ${s.id === value ? 'is-active' : ''}`} onClick={() => onChange(s.id)}>
              <span className="picker__title">{s.title}</span>
              <span className="picker__meta">{meta(s)}</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="picker__empty">没有歌曲，先去「管理」里添加</li>}
      </ul>
    </div>
  );
}
