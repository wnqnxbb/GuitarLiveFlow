import { useEffect, useState } from 'react';
import type { SongSummary } from '@shared/types';
import { Icon } from './Icon';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.listSongs().then((value) => { if (active) setSongs(value); }).catch(() => { if (active) setError('歌曲加载失败，请重试'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const filtered = songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q.trim().toLowerCase()));
  const empty = loading ? '正在准备曲目…' : error || (q.trim() ? '没有找到匹配的歌曲，换个关键词试试' : '暂无歌曲');
  const meta = (s: SongSummary) => `${s.artist}${s.key ? ` · ${s.key}调` : ''}${s.capo ? ` · Capo ${s.capo}` : ''}`;
  if (variant === 'cards') {
    return (
      <div className="picker">
        <div className="picker__head"><Icon name="search" size={20} />
          <input
            className="input"
            aria-label="搜索歌名或歌手"
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
          {!loading && !error && filtered.map((s) => (
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
          {(loading || error || filtered.length === 0) && <div className="picker__empty" role="status">{empty}{error && <button className="btn" onClick={() => setRetry((v) => v + 1)}>重试</button>}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="picker">
      <div className="picker__head"><Icon name="search" size={20} />
        <input
          className="input"
          aria-label="搜索歌名或歌手"
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
        {!loading && !error && filtered.map((s) => (
          <li key={s.id}>
            <button className={`picker__item ${s.id === value ? 'is-active' : ''}`} onClick={() => onChange(s.id)}>
              <span className="picker__title">{s.title}</span>
              <span className="picker__meta">{meta(s)}</span>
            </button>
          </li>
        ))}
        {(loading || error || filtered.length === 0) && <li className="picker__empty" role="status">{empty}{error && <button className="btn" onClick={() => setRetry((v) => v + 1)}>重试</button>}</li>}
      </ul>
    </div>
  );
}
