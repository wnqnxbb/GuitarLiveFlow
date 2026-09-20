import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChordSheet } from '../components/ChordSheet';
import { SongPicker } from '../components/SongPicker';
import { useRoom } from '../lib/useRoom';
import {
  useAutoAdvance,
  useFullscreen,
  useKeyboardNav,
  useLocalStorage,
  useScrollToActive,
  useSong,
  useTransposed,
  useWakeLock,
} from '../lib/hooks';
import { useRoomCode } from '../lib/roomCode';

/**
 * 手机演出页：控制端。
 * 显示和弦+歌词，点屏幕下半部分下一行、上半部分上一行；
 * 每次换行都通过 WebSocket 广播给大屏。
 */
export function PerformPage() {
  const roomCode = useRoomCode();
  const room = useRoom(roomCode, 'controller');
  const { state, send } = room;
  const { song, parsed } = useSong(state.songId, room.songVersion);
  const sheet = useTransposed(parsed, state.transpose);

  const [fontSize, setFontSize] = useLocalStorage('perform.fontSize', 22);
  const [showPicker, setShowPicker] = useState(state.songId === null);
  const [showTools, setShowTools] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wakeActive = useWakeLock(true);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const total = sheet?.lines.length ?? 0;
  const setLine = useCallback(
    (idx: number) => {
      if (total === 0) return;
      send({ lineIndex: Math.max(0, Math.min(total - 1, idx)) });
    },
    [send, total],
  );
  const next = useCallback(() => setLine(state.lineIndex + 1), [setLine, state.lineIndex]);
  const prev = useCallback(() => setLine(state.lineIndex - 1), [setLine, state.lineIndex]);

  useKeyboardNav(next, prev, { Escape: () => setShowTools((v) => !v) });
  useAutoAdvance(state.mode === 'auto' && total > 0, state.secondsPerLine, () => {
    if (state.lineIndex >= total - 1) send({ mode: 'manual' });
    else next();
  });
  useScrollToActive(containerRef, state.lineIndex);

  // 切歌后自动关掉选歌面板
  useEffect(() => {
    if (state.songId !== null) setShowPicker(false);
  }, [state.songId]);

  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showTools) {
      setShowTools(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (y < 0.3) prev();
    else next();
  };

  if (showPicker) {
    return (
      <div className="page page--dark">
        <header className="bar">
          <Link to="/" className="btn btn--ghost">
            ← 首页
          </Link>
          <span className="bar__title">选择歌曲</span>
          <span className={`dot ${room.connected ? 'is-on' : ''}`} title={room.connected ? '已连接' : '未连接'} />
        </header>
        <SongPicker
          value={state.songId}
          onChange={(id) => send({ songId: id, lineIndex: 0, mode: 'manual' })}
          onClose={state.songId !== null ? () => setShowPicker(false) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="page page--dark perform">
      <header className="bar bar--overlay">
        <button className="btn btn--ghost" onClick={() => setShowPicker(true)}>
          ♪ {song?.title ?? '选歌'}
        </button>
        <span className="bar__meta">
          {state.lineIndex + 1}/{total}
          {state.mode === 'auto' && ' · 自动'}
          {state.transpose !== 0 && ` · ${state.transpose > 0 ? '+' : ''}${state.transpose}`}
        </span>
        <span className="bar__status">
          <span className={`dot ${room.connected ? 'is-on' : ''}`} title={room.connected ? '已连接' : '未连接'} />
          <span className="bar__displays" title="在线大屏数">{room.displays} 屏</span>
          <button className="btn btn--ghost" onClick={() => setShowTools((v) => !v)}>
            ⚙
          </button>
        </span>
      </header>

      <div className="perform__sheet" ref={containerRef} onClick={onTap}>
        {sheet ? (
          <ChordSheet song={sheet} activeIndex={state.lineIndex} fontSize={fontSize} />
        ) : (
          <p className="hint">加载中…</p>
        )}
        <div className="perform__spacer" />
      </div>

      {showTools && (
        <div className="tools" onClick={(e) => e.stopPropagation()}>
          <div className="tools__row">
            <span>字号</span>
            <button className="btn" onClick={() => setFontSize(Math.max(14, fontSize - 2))}>
              A-
            </button>
            <span className="tools__value">{fontSize}</span>
            <button className="btn" onClick={() => setFontSize(Math.min(40, fontSize + 2))}>
              A+
            </button>
          </div>
          <div className="tools__row">
            <span>移调</span>
            <button className="btn" onClick={() => send({ transpose: state.transpose - 1 })}>
              ♭
            </button>
            <span className="tools__value">
              {state.transpose > 0 ? '+' : ''}
              {state.transpose}
              {sheet?.meta.key && ` (${sheet.meta.key})`}
            </span>
            <button className="btn" onClick={() => send({ transpose: state.transpose + 1 })}>
              ♯
            </button>
            <button className="btn btn--ghost" onClick={() => send({ transpose: 0 })}>
              还原
            </button>
          </div>
          <div className="tools__row">
            <span>自动</span>
            <button
              className={`btn ${state.mode === 'auto' ? 'btn--primary' : ''}`}
              onClick={() => send({ mode: state.mode === 'auto' ? 'manual' : 'auto' })}
            >
              {state.mode === 'auto' ? '暂停' : '开始'}
            </button>
            <button className="btn" onClick={() => send({ secondsPerLine: Math.max(1, state.secondsPerLine - 1) })}>
              快
            </button>
            <span className="tools__value">{state.secondsPerLine}s/行</span>
            <button className="btn" onClick={() => send({ secondsPerLine: Math.min(60, state.secondsPerLine + 1) })}>
              慢
            </button>
          </div>
          <div className="tools__row">
            <button className="btn" onClick={() => setLine(0)}>
              回到开头
            </button>
            <button className="btn" onClick={toggleFullscreen}>
              {isFullscreen ? '退出全屏' : '全屏'}
            </button>
            <span className="tools__hint">{wakeActive ? '屏幕常亮中' : '常亮不可用'}</span>
          </div>
          <p className="tools__hint">点屏幕下方 = 下一行，上方 = 上一行。蓝牙踏板的翻页键同样有效。</p>
        </div>
      )}
    </div>
  );
}
