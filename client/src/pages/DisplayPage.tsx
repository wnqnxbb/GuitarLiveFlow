import { useNavigate, useParams } from 'react-router-dom';
import { DisplayJoinDialog } from '../components/DisplayJoinDialog';
import { LyricsStage } from '../components/LyricsStage';
import { useRoom } from '../lib/useRoom';
import { useFullscreen, useSong, useWakeLock } from '../lib/hooks';

/**
 * 大屏歌词页：只读，跟随手机端状态，纯歌词展示（无导航/状态/歌名等控件）；
 * 前奏/等待开唱时用歌名占位，屏幕上才不会空着一片。
 * 歌曲由链接里的 /display/:id 决定；同一首歌的链接共享一个同步房间。
 * 双击切换全屏。
 */
export function DisplayPage() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const songId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const room = useRoom(songId === null ? null : `song-${songId}`, 'display');
  const { song, parsed } = useSong(songId, room.songVersion);
  const { toggle } = useFullscreen();
  useWakeLock(true);

  if (songId === null) {
    return (
      <div className="page page--stage">
        <DisplayJoinDialog onClose={() => navigate('/')} />
      </div>
    );
  }

  return (
    <div className="page page--stage" onDoubleClick={toggle}>
      <LyricsStage
        song={parsed}
        activeIndex={room.state.lineIndex}
        variant={room.state.stageStyle}
        follow={room.state.follow}
        font={room.state.font}
        placeholder={song?.title}
      />
    </div>
  );
}
