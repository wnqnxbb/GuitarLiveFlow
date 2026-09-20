import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LyricsStage } from '../components/LyricsStage';
import { useRoom } from '../lib/useRoom';
import { useFullscreen, useSong, useWakeLock } from '../lib/hooks';
import { useRoomCode } from '../lib/roomCode';

/**
 * 大屏歌词页：只读，跟随手机端状态。
 * 鼠标不动几秒后隐藏所有控件。
 */
export function DisplayPage() {
  const roomCode = useRoomCode();
  const room = useRoom(roomCode, 'display');
  const { parsed, song } = useSong(room.state.songId, room.songVersion);
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

  return (
    <div className="page page--stage" onDoubleClick={toggle}>
      <LyricsStage song={parsed} activeIndex={room.state.lineIndex} title={song?.title} />
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
