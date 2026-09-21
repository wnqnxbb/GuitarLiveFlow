import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { HomePage } from './HomePage';
import './home-mode.css';

// 仅在选择 MV 时加载视频页面，经典模式不请求视频文件。
const MvDemoPage = lazy(() => import('./MvDemoPage').then((module) => ({ default: module.MvDemoPage })));
type HomeMode = 'classic' | 'mv';
const modes: { id: HomeMode; label: string }[] = [
  { id: 'classic', label: '经典首页' },
  { id: 'mv', label: 'MV 模式' },
];

/** 两种首页共用稳定的标签栏，切换时卸载 MV，确保视频和声音停止。 */
export function HomeModePage({ initialMode }: { initialMode?: HomeMode }) {
  const [mode, setMode] = useState<HomeMode>(() => {
    if (initialMode) return initialMode;
    try { return localStorage.getItem('home.mode') === 'mv' ? 'mv' : 'classic'; }
    catch { return 'classic'; }
  });
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    try { localStorage.setItem('home.mode', mode); }
    catch { /* 禁用存储时仍可正常切换，仅不记忆偏好。 */ }
  }, [mode]);

  /** 标准 tabs 键盘交互：左右箭头切换，Home/End 跳到首尾。 */
  function switchByKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else return;
    event.preventDefault();
    setMode(modes[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div className={`home-shell home-shell--${mode}`}>
      <div className="home-mode-tabs" role="tablist" aria-label="首页模式">
        {modes.map((item, index) => (
          <button key={item.id} ref={(element) => { buttons.current[index] = element; }} id={`home-tab-${item.id}`} type="button" role="tab" aria-selected={mode === item.id} aria-controls={`home-panel-${item.id}`} tabIndex={mode === item.id ? 0 : -1} onClick={() => setMode(item.id)} onKeyDown={(event) => switchByKeyboard(event, index)}>{item.label}</button>
        ))}
      </div>
      <div id={`home-panel-${mode}`} role="tabpanel" aria-labelledby={`home-tab-${mode}`}>
        {mode === 'classic' ? <HomePage /> : (
          <Suspense fallback={<div className="home-mode-loading" role="status">正在打开 MV…</div>}><MvDemoPage /></Suspense>
        )}
      </div>
    </div>
  );
}
