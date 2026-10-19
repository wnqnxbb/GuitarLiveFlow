import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Line } from '@shared/chordpro';
import type { StageFont } from '@shared/types';
import { lyricFontFamily } from '../lib/fonts';
import './lyric-wall.css';

interface Props {
  lyricLines: Line[];
  activeIndex: number;
  font?: StageFont;
}

/** 基于歌词生成稳定随机序列，同一首歌刷新、换句和重新连接时不会重新洗牌。 */
function randomFor(lines: Line[]) {
  let seed = 2166136261;
  for (const char of lines.map((line) => `${line.index}:${line.lyrics}`).join('\n')) {
    seed = Math.imul(seed ^ char.codePointAt(0)!, 16777619);
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 打乱句子顺序，每句作为独立文字块，超长句在自己的块内换行。 */
function shuffleLines(lines: Line[]): Line[] {
  const random = randomFor(lines);
  const shuffled = [...lines];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 利用每排剩余宽度制造错落边界，句间仅小幅变化，不拉成整齐的左/右/居中对齐。 */
function scatterRows(node: HTMLDivElement, lines: Line[], size: number) {
  const random = randomFor(lines);
  const rows = new Map<number, HTMLElement[]>();
  const right = node.getBoundingClientRect().right;
  for (const child of Array.from(node.children) as HTMLElement[]) {
    const row = rows.get(child.offsetTop) ?? [];
    row.push(child);
    rows.set(child.offsetTop, row);
  }
  for (const row of rows.values()) {
    const free = Math.max(0, right - row[row.length - 1].getBoundingClientRect().right - 1);
    // 优先把余白留在两侧，只拿少量余白增加句间距，防止重新出现大块空洞。
    const gaps = row.slice(1).map(() => random() * Math.min(size * 0.35, free * 0.3 / (row.length - 1)));
    const extra = gaps.reduce((sum, gap) => sum + gap, 0);
    let shift = (free - extra) * (0.08 + random() * 0.84);
    for (let i = 0; i < row.length; i++) {
      if (i > 0) shift += gaps[i - 1];
      row[i].style.transform = `translateX(${shift}px)`;
    }
  }
}

/** 全量歌词墙：仅字体、歌曲、屏幕尺寸改变时排布，时间轴只改变当前句的高亮。 */
export function LyricWallStage({ lyricLines, activeIndex, font }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const shuffled = useMemo(() => shuffleLines(lyricLines), [lyricLines]);

  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;
    let disposed = false;
    const layout = () => {
      if (disposed) return;
      if (node.clientWidth <= 0 || node.clientHeight <= 0) return;
      // 清除上次偏移再测量，避免字体加载和 resize 多次触发时叠加位移。
      for (const child of Array.from(node.children) as HTMLElement[]) child.style.transform = '';
      let low = 0.1;
      let high = node.clientHeight;
      const bottom = node.getBoundingClientRect().bottom;
      // 直接用浏览器的实际换行结果找最大字号；中文、英文及回退字体使用同一套排版。
      // 只有尺寸、字体和歌曲变化时测量，时间轴推进不进入此过程。
      for (let i = 0; i < 18; i++) {
        const size = (low + high) / 2;
        node.style.fontSize = `${size}px`;
        // 实测末句字形的下边界，保留一像素余量；避免整体缩小字号留下多余空行。
        const textBottom = node.lastElementChild?.getBoundingClientRect().bottom ?? bottom;
        if (node.scrollHeight <= node.clientHeight && textBottom <= bottom - 1) low = size;
        else high = size;
      }
      node.style.fontSize = `${low}px`;
      scatterRows(node, lyricLines, low);
    };
    const observer = new ResizeObserver(layout);
    observer.observe(node);
    layout();
    // 自托管字体加载完成后重新测量，避免回退字体与书法字体的宽度不同而重叠。
    void document.fonts.ready.then(layout);
    document.fonts.addEventListener('loadingdone', layout);
    return () => {
      disposed = true;
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', layout);
    };
  }, [lyricLines, font]);

  return (
    <div className="stage stage--wall" style={{ fontFamily: lyricFontFamily(font) }}>
      <div className="lyric-wall" ref={container} aria-label="杂乱歌词墙">
        {shuffled.map((line) => (
          <span
            key={line.index}
            data-line-index={line.index}
            aria-current={line.index === activeIndex ? 'true' : undefined}
            className={`lyric-wall__line${line.index === activeIndex ? ' is-active' : ''}`}
          >
            {/* 句内连续空白收成一个空格，句间距离统一由容器的 gap 控制。 */}
            {line.lyrics.trim().replace(/\s+/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
