import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { DisplayJoinDialog } from '../components/DisplayJoinDialog';
import { Icon } from '../components/Icon';

/** 聚光位置只写 CSS 变量，避免指针移动触发 React 重渲染。 */
function moveSpotlight(event: MouseEvent<HTMLAnchorElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
}

/** 首页保留两个主要操作和一个大屏入口，弦线只作为非交互背景。 */
export function HomePage() {
  const [joining, setJoining] = useState(false);
  return (
    <main className="page home">
      <div className="home__inner">
        <header className="home__brand"><span className="brand-strings" aria-hidden="true" /><span>声音幕布</span></header>
        <section className="home__intro">
          <div className="home__strings" aria-hidden="true"><svg viewBox="0 0 800 400" fill="none">{Array.from({ length: 6 }, (_, i) => <path key={i} d={`M0 ${330 + i * 12} C220 ${70 + i * 18}, 500 ${430 + i * 8}, 800 ${-120 + i * 38}`} />)}</svg></div>
          <h1 className="home__title">声音幕布</h1>
          <p className="home__sub">手机看谱，大屏看词，实时同步</p>
        </section>
        <div className="home__modes">
          <Link to="/perform" className="mode-card mode-card--stage" onMouseMove={moveSpotlight}>
            <div className="mode-card__copy"><h2>手机演出</h2><p>和弦 + 歌词，控制大屏</p><span className="mode-card__action">开始演出<Icon name="arrow" size={19} /></span></div>
            <div className="mode-card__art phone-art" aria-hidden="true"><div className="phone-art__speaker" /><span>C</span><i /><span>Am</span><i /><span>F</span><i /><div className="phone-art__home" /></div>
          </Link>
          <Link to="/practice" className="mode-card mode-card--practice" onMouseMove={moveSpotlight}>
            <div className="mode-card__copy"><h2>电脑练习</h2><p>词谱 + 原图，本地控制</p><span className="mode-card__action">开始练习<Icon name="arrow" size={19} /></span></div>
            <div className="mode-card__art practice-art" aria-hidden="true"><Icon name="guitar" size={124} /><span className="practice-art__lines" /></div>
          </Link>
        </div>
        <button className="home__display" onClick={() => setJoining(true)}><span className="home__display-icon"><Icon name="monitor" size={34} /></span><span><strong>大屏歌词</strong><small>输入手机端生成的 6 位密钥，让歌词登场</small></span><Icon name="arrow" /></button>
        <footer className="home__footer"><span>每一次弹唱，都值得被看见。</span><span className="footer-strings" aria-hidden="true">│ │ │ │ │ │</span></footer>
      </div>
      {joining && <DisplayJoinDialog onClose={() => setJoining(false)} />}
    </main>
  );
}
