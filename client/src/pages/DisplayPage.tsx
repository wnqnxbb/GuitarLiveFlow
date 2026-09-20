import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LyricsStage } from '../components/LyricsStage';
import { useRoom } from '../lib/useRoom';
import { useFullscreen, useSong, useWakeLock } from '../lib/hooks';

/**
 * 大屏歌词页：只读，跟随手机端状态。
 * 歌曲由链接里的 /display/:id 决定；同一首歌的链接共享一个同步房间。
 * 鼠标不动几秒后隐藏所有控件。
 */
export function DisplayPage() {
  const params = useParams<{ id?: string }>();
  const songId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const room = useRoom(songId === null ? null : `song-${songId}`, 'display');
  const { parsed, song } = useSong(songId, room.songVersion);
  const { isFullscreen, toggle } = useFullscreen();
  const [showUi, setShowUi] = useState(true);
  useWakeLock(true);

  useEffect(() => {
    let timer = setTimeout(() => setShowUi(false), 3000);
    const onMove = () => {
      setShowUi(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowUi(false), 3000);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onMove);
    };
  }, []);

  if (songId === null) {
    return (
      <div className="page page--stage">
        <div className="stage stage--idle">
          <p className="hint">请从手机「演出」页选好歌后点「🖥」获取大屏链接</p>
        </div>
        <div className="stage__ui">
          <Link to="/" className="btn btn--ghost">
            ← 首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--stage" onDoubleClick={toggle}>
      <LyricsStage
        song={parsed}
        activeIndex={room.state.lineIndex}
        title={song?.title}
        variant={room.state.stageStyle}
      />
      <div className={`stage__ui ${showUi ? '' : 'is-hidden'}`}>
        <Link to="/" className="btn btn--ghost">
          ← 首页
        </Link>
        <span className={`dot ${room.connected ? 'is-on' : ''}`} />
        <span>{room.connected ? (room.controllers > 0 ? '手机已连接' : '等待手机连接') : '连接服务器中…'}</span>
        <button className="btn btn--ghost" onClick={toggle}>
          {isFullscreen ? '退出全屏' : '全屏（或双击）'}
        </button>
      </div>
    </div>
  );
}
