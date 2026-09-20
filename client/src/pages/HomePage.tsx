import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function HomePage() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    api.listSongs().then((s) => setCount(s.length)).catch(() => setCount(0));
  }, []);
  return (
    <div className="page home">
      <h1 className="home__title">吉他谱</h1>
      <p className="home__sub">手机看谱，大屏看词，实时同步</p>
      <div className="home__grid">
        <Link to="/perform" className="card card--primary">
          <span className="card__icon">📱</span>
          <span className="card__title">手机演出</span>
          <span className="card__desc">和弦 + 歌词，控制大屏</span>
        </Link>
        <Link to="/display" className="card">
          <span className="card__icon">🖥</span>
          <span className="card__title">大屏歌词</span>
          <span className="card__desc">从手机演出页生成链接后打开</span>
        </Link>
        <Link to="/practice" className="card">
          <span className="card__icon">🎸</span>
          <span className="card__title">电脑练习</span>
          <span className="card__desc">词谱 + 原图，本地控制</span>
        </Link>
        <Link to="/admin" className="card">
          <span className="card__icon">✏️</span>
          <span className="card__title">管理谱子</span>
          <span className="card__desc">{count === null ? '…' : `共 ${count} 首`}</span>
        </Link>
      </div>
    </div>
  );
}
