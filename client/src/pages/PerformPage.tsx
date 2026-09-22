import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { STAGE_FONTS, STAGE_STYLES } from '@shared/types';
import { Icon } from '../components/Icon';
import { ChordSheet } from '../components/ChordSheet';
import { TimelineEditor } from '../components/TimelineEditor';
import { usePerformanceTimeline } from '../lib/usePerformanceTimeline';
import '../components/timeline.css';
import { SongPicker } from '../components/SongPicker';
import { DisplayLinkDialog } from '../components/DisplayLinkDialog';
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

/**
 * 手机演出页：控制端。
 * 显示和弦+歌词，点屏幕下半部分下一行、上半部分上一行；
 * 每次换行都通过 WebSocket 广播给大屏。
 */
export function PerformPage() {
  // 手机端是状态的唯一来源：本地保存当前歌曲，用歌曲 id 确定同步房间
  const [songId, setSongId] = useState<number | null>(null);
  const roomKey = songId === null ? null : `song-${songId}`;
  const room = useRoom(roomKey, 'controller');
  const { state, send } = room;
  const { song, parsed } = useSong(songId, room.songVersion);
  const sheet = useTransposed(parsed, state.transpose);

  const [fontSize, setFontSize] = useLocalStorage('perform.fontSize', 22);
  const [showPicker, setShowPicker] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [showDisplayLink, setShowDisplayLink] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wakeActive = useWakeLock(true);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const total = sheet?.lines.length ?? 0;
  const timing = usePerformanceTimeline(song?.id === songId ? song : null, send);
  const timed = timing.status === 'playing' || timing.status === 'paused';
  const setLine = useCallback(
    (idx: number) => {
      if (total === 0) return;
      const target = Math.max(0, Math.min(total - 1, idx));
      if (timed) timing.calibrate(target);
      else send({ lineIndex: target });
    },
    [send, total, timed, timing.calibrate],
  );
  const next = () => timing.status === 'recording' ? timing.mark(1, total) : setLine(state.lineIndex + 1);
  const prev = () => timing.status === 'recording' ? timing.mark(-1, total) : setLine(state.lineIndex - 1);

  useKeyboardNav(next, prev, {
    s: () => { if (timing.status === 'playing') timing.pause(); else if (timing.status === 'paused') timing.play(); },
    Escape: () => setShowTools((v) => !v) });
  useAutoAdvance(state.mode === 'auto' && total > 0, state.secondsPerLine, () => {
    if (state.lineIndex >= total - 1) send({ mode: 'manual' });
    else next();
  });
  useScrollToActive(containerRef, state.lineIndex);

  // 切歌后自动关掉选歌面板
  useEffect(() => {
    if (songId !== null) setShowPicker(false);
  }, [songId]);

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
            <Icon name="back" size={18} /> 首页
          </Link>
          <span className="bar__title">选择歌曲</span>
          <span className={`dot ${room.connected ? 'is-on' : ''}`} title={room.connected ? '已连接' : '未连接'} />
        </header>
        <SongPicker
          value={songId}
          onChange={(id) => {
            setSongId(id);
            send({ songId: id, lineIndex: 0, mode: 'manual' });
          }}
          onClose={songId !== null ? () => setShowPicker(false) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="page page--dark perform">
      <header className="bar bar--overlay">
        <button className="btn btn--ghost" onClick={() => { timing.stop(); setShowPicker(true); }}>
          ♪ {song?.title ?? '选歌'}
        </button>
        <span className="bar__meta">
          {state.lineIndex + 1}/{total}
          {state.mode === 'auto' && ' · 自动'}
          {timing.status === 'playing' && ' · 时间轴'}
          {state.transpose !== 0 && ` · ${state.transpose > 0 ? '+' : ''}${state.transpose}`}
        </span>
        <span className="bar__status">
          <span className={`dot ${room.connected ? 'is-on' : ''}`} title={room.connected ? '已连接' : '未连接'} />
          <span className="bar__displays" title="在线大屏数">{room.displays} 屏</span>
          {songId !== null && (
            <button className="btn btn--ghost" onClick={() => setShowDisplayLink(true)} title="大屏链接" aria-label="大屏链接">
              <Icon name="monitor" />
            </button>
          )}
          <button className="btn btn--ghost" aria-label="演出设置" aria-expanded={showTools} onClick={() => setShowTools((v) => !v)}>
            <Icon name="settings" />
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

      <div className="timeline-controls" aria-label="时间轴演出控制">
        <div className="timeline-controls__status" role="status">
          {timing.status === 'recording'
            ? `录制中 · ${timing.elapsed.toFixed(1)} 秒 · 已打点 ${timing.draft.length}/${total} 行`
            : timing.saved ? `逐句时间轴 · ${timing.elapsed.toFixed(1)} 秒${timing.status === 'paused' ? ' · 已暂停' : ''}` : '还没有时间轴 · 先听一次排练录音，逐行打点'}
        </div>
        <div className="timeline-controls__row">
          {timing.status === 'recording' ? <>
            <button className="btn" onClick={prev} disabled={!timing.draft.length}>撤回打点</button>
            <button className="btn btn--primary" onClick={next}>第 {timing.draft.length + 1} 行开始</button>
            <button className="btn" onClick={() => { timing.stop(); timing.setEditorOpen(true); }}>结束录制</button>
          </> : <>
            <button className="btn" onClick={prev} disabled={state.lineIndex <= 0}>上一句</button>
            <button className="btn" onClick={next} disabled={state.lineIndex >= total - 1}>下一句</button>
            {timing.saved && <>
              <button className="btn btn--primary" onClick={() => { if (timing.status === 'playing') timing.pause(); else { setShowTools(false); timing.play(); } }}>
                {timing.status === 'playing' ? '暂停' : timing.status === 'paused' ? '继续' : '按时间轴开始'}
              </button>
              {timed && <button className="btn" onClick={() => timing.calibrate(Math.max(0, state.lineIndex))}>对齐本句开头</button>}
              <select aria-label="演唱速度" value={timing.speed} onChange={(e) => timing.changeSpeed(Number(e.target.value))}>
                {[0.8, 0.9, 1, 1.1, 1.2].map((rate) => <option key={rate} value={rate}>{rate} 倍速</option>)}
              </select>
            </>}
            <button className="btn" disabled={!song || song.id !== songId || !sheet || !total} onClick={() => {
              timing.stop(); setShowTools(false); timing.setEditorOpen(true);
            }}>打点 / 编辑</button>
          </>}
        </div>
        {timing.status === 'recording' && <p className="tools__hint">到每行开头时点击打点，纯和弦行也要记录。点屏幕下方或踩下一页同样有效。</p>}
        {timed && <p className="tools__hint">上一句 / 下一句会重新对齐后续计时；S 键暂停或继续。</p>}
        {timing.notice && <p role="alert" className="tools__hint">{timing.notice}</p>}
      </div>

      {timing.editorOpen && song && sheet && <TimelineEditor
        song={song} parsed={sheet} draft={timing.draft} onChange={timing.updateDraft}
        onSaved={timing.setSaved} onClose={() => timing.setEditorOpen(false)}
        onRecord={() => { setShowTools(false); timing.record(); }}
      />}

      {showDisplayLink && songId !== null && (
        <DisplayLinkDialog songId={songId} songTitle={song?.title} onClose={() => setShowDisplayLink(false)} />
      )}

      {showTools && (
        <div className="tools" role="region" aria-label="演出设置" onClick={(e) => e.stopPropagation()}>
          <div className="tools__head"><strong>演出设置</strong><button className="btn btn--ghost" onClick={() => setShowTools(false)} aria-label="关闭设置"><Icon name="close" /></button></div>
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
            <span>等时自动</span>
            <button
              className={`btn ${state.mode === 'auto' ? 'btn--primary' : ''}`}
              onClick={() => { timing.stop(); send({ mode: state.mode === 'auto' ? 'manual' : 'auto' }); }}
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
            <span>大屏样式</span>
            {STAGE_STYLES.map((s) => (
              <button
                key={s.id}
                className={`btn ${state.stageStyle === s.id ? 'btn--primary' : ''}`}
                onClick={() => send({ stageStyle: s.id })}
                title={s.desc}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="tools__row">
            <span>跟随进度</span>
            <button
              className={`btn ${state.follow ? 'btn--primary' : ''}`}
              onClick={() => send({ follow: !state.follow })}
            >
              {state.follow ? '开' : '关'}
            </button>
            <span className="tools__hint">开启后高亮当前唱到的一句并显示进度条</span>
          </div>
          <div className="tools__row">
            <span>歌词字体</span>
            {STAGE_FONTS.map((f) => (
              <button
                key={f.id}
                className={`btn ${state.font === f.id ? 'btn--primary' : ''}`}
                onClick={() => send({ font: f.id })}
                title={f.desc}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="tools__row">
            <button className="btn" onClick={() => { timing.stop(); send({ lineIndex: 0 }); }}>
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
