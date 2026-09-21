import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DisplayJoinDialog } from '../components/DisplayJoinDialog';
import { Icon } from '../components/Icon';
import './mv-demo.css';

/** 视频控制图标与现有入口图标保持一致的线条粗细。 */
function MediaIcon({ kind }: { kind: 'play' | 'pause' | 'sound' | 'muted' | 'expand' }) {
  const paths = {
    play: 'm8 5 11 7-11 7V5Z',
    pause: 'M8 5v14M16 5v14',
    sound: 'M4 9h4l5-4v14l-5-4H4V9Zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14',
    muted: 'M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6',
    expand: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

/** 秒数格式化只用于进度条，避免改变视频本身的播放节奏。 */
function formatTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.floor(value) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** MV 放映厅概念页：完整视频与导航分区，支持真实播放和大屏密钥入口。 */
export function MvDemoPage() {
  const video = useRef<HTMLVideoElement>(null);
  const resumeAfterDialog = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(true);
  const [pure, setPure] = useState(false);
  const [hud, setHud] = useState(true);
  const [joining, setJoining] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  /** 播放被浏览器阻止时保留可点击的播放按钮，不显示虚假的播放状态。 */
  async function play() {
    try { await video.current?.play(); }
    catch { setPaused(true); }
  }

  useEffect(() => {
    // 尊重减少动态效果偏好；用户仍可主动点播放。
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) void play();
    const element = video.current;
    return () => {
      window.clearTimeout(hideTimer.current);
      // 切回经典首页或进入功能页时立即停止播放，释放媒体连接。
      element?.pause();
    };
  }, []);

  useEffect(() => {
    if (!joining && resumeAfterDialog.current) {
      resumeAfterDialog.current = false;
      void play();
    }
  }, [joining]);

  useEffect(() => {
    // 导航进入 inert 状态后焦点可能回到 body，因此在窗口层接收 Esc。
    const exit = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pure && !joining) setPure(false);
    };
    window.addEventListener('keydown', exit);
    return () => window.removeEventListener('keydown', exit);
  }, [pure, joining]);

  /** 大屏弹窗打开时暂停 MV，关闭后仅恢复此前正在播放的视频。 */
  function openDisplay() {
    resumeAfterDialog.current = !!video.current && !video.current.paused;
    video.current?.pause();
    setJoining(true);
  }

  /** 纯享模式只显示视频；移动指针临时唤回退出提示。 */
  function revealHud() {
    if (!pure) return;
    setHud(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHud(false), 2400);
  }

  function enterPure() {
    setPure(true);
    setHud(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHud(false), 2400);
  }

  return (
    <main className={`mv-demo page--dark ${pure ? 'is-pure' : ''}`} onPointerMove={revealHud}>
      <header className="mv-header" inert={pure}>
        <Link to="/" className="mv-brand" aria-label="声音幕布首页"><span className="mv-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>声音幕布</Link>
        <span className="mv-header__note">让声音，有画面。</span>
        <span className="mv-mode-space" aria-hidden="true" />
      </header>

      <section className="mv-screen" aria-label="MV 放映区" onClick={() => { if (pure) setPure(false); }}>
        <video ref={video} src="/demo-media/home-mv.mp4" poster="/demo-media/poster.png" muted={muted} playsInline loop preload="metadata"
          onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
          onTimeUpdate={(e) => {
            setElapsed(e.currentTarget.currentTime);
            // 部分浏览器先触发 metadata，再确定完整时长，进度更新时同步兜底。
            if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
          }}
          onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
          onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
          onError={() => setError('视频暂时无法播放，请检查本地演示素材。')}
        />
        {error && <p className="mv-error" role="alert">{error}</p>}
        {pure && <button className={`mv-pure-exit ${hud ? 'is-visible' : ''}`} onClick={(e) => { e.stopPropagation(); setPure(false); }}>退出纯享<Icon name="close" size={16} /></button>}
        {pure && hud && <span className="mv-pure-hint">轻触画面或按 Esc 返回</span>}
      </section>

      <footer className="mv-footer" inert={pure}>
        <div className="mv-progress">
          <span>{formatTime(elapsed)}</span>
          <input type="range" aria-label="视频播放进度" min="0" max={duration || 1} step="0.1" value={elapsed} disabled={!duration || !!error} onChange={(e) => { const time = Number(e.target.value); if (video.current) video.current.currentTime = time; setElapsed(time); }} style={{ '--progress': `${duration ? elapsed / duration * 100 : 0}%` } as React.CSSProperties} />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="mv-footer__row">
          <div className="mv-player">
            <button className="mv-icon-button" aria-label={paused ? '播放 MV' : '暂停 MV'} disabled={!!error} onClick={() => { if (paused) void play(); else video.current?.pause(); }}><MediaIcon kind={paused ? 'play' : 'pause'} /></button>
            <span className="mv-playing"><span className={`mv-equalizer ${paused ? 'is-paused' : ''}`} aria-hidden="true"><i /><i /><i /><i /></span>{paused ? '暂停片刻' : '正在放映'}</span>
          </div>
          <nav className="mv-nav" aria-label="功能入口">
            <Link to="/perform"><Icon name="phone" size={19} /><span>手机演出</span><Icon name="arrow" size={15} /></Link>
            <Link to="/practice"><Icon name="guitar" size={19} /><span>电脑练习</span><Icon name="arrow" size={15} /></Link>
            <button onClick={openDisplay}><Icon name="monitor" size={19} /><span>大屏歌词</span><Icon name="arrow" size={15} /></button>
          </nav>
          <div className="mv-options">
            <button className="mv-sound" aria-label={muted ? '开启声音' : '静音'} aria-pressed={!muted} onClick={() => setMuted((value) => !value)}><MediaIcon kind={muted ? 'muted' : 'sound'} /><span>{muted ? '开启声音' : '声音已开'}</span></button>
            <button className="mv-icon-button" aria-label="进入纯享模式" title="纯享模式" onClick={enterPure}><MediaIcon kind="expand" /></button>
          </div>
        </div>
      </footer>
      {joining && <DisplayJoinDialog onClose={() => setJoining(false)} />}
    </main>
  );
}
