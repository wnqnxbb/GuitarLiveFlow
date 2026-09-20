import { useEffect, useState } from 'react';
import type { SongSummary } from '@shared/types';
import { api } from '../lib/api';

interface Props {
  value: number | null;
  onChange: (id: number) => void;
  onClose?: () => void;
}

/** 歌曲选择列表，带搜索，手机上按钮足够大 */
export function SongPicker({ value, onChange, onClose }: Props) {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.listSongs().then(setSongs).catch(() => setSongs([]));
  }, []);
  const filtered = songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q.trim().toLowerCase()));
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
              <span className="picker__meta">
                {s.artist}
                {s.key && ` · ${s.key}调`}
                {s.capo ? ` · Capo ${s.capo}` : ''}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="picker__empty">没有歌曲，先去「管理」里添加</li>}
      </ul>
    </div>
  );
}
