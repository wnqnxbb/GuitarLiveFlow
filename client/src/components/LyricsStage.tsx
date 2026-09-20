import type { CSSProperties } from 'react';
import type { Line, ParsedSong } from '@shared/chordpro';
import type { StageStyle } from '@shared/types';

interface Props {
  song: ParsedSong | null;
  activeIndex: number;
  title?: string;
  /** 当前行前后各显示几行（仅滚动样式用） */
  context?: number;
  /** 展示样式，见 shared/types.ts 的 STAGE_STYLES */
  variant?: StageStyle;
  /** 是否跟随进度：开启后门帘样式高亮当前句并显示进度条 */
  follow?: boolean;
}

/**
 * 大屏歌词。只展示歌词，纯和弦的前奏/间奏不出现；遇到间奏时继续高亮上一句歌词。
 * 具体样式由 variant 决定，新增样式只需在这里加一个分支 + 一个子组件。
 */
export function LyricsStage({ song, activeIndex, title, context = 2, variant = 'scroll', follow }: Props) {
  const lyricLines = song?.lines.filter((l) => !l.instrumental && l.lyrics.trim() !== '') ?? [];

  if (!song || lyricLines.length === 0) {
    return (
      <div className="stage stage--idle">
        <div className="stage__title">{title ?? '等待开始'}</div>
      </div>
    );
  }

  // 当前行号映射到最近的一句歌词：间奏时停留在上一句，前奏时提前显示第一句
  let activePos = 0;
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i].index <= activeIndex) activePos = i;
    else break;
  }

  const progress = ((activeIndex + 1) / song.lines.length) * 100;

  if (variant === 'curtain') {
    return <CurtainStage lyricLines={lyricLines} activePos={activePos} progress={progress} follow={follow} />;
  }
  return <ScrollStage lyricLines={lyricLines} activePos={activePos} title={title} progress={progress} context={context} />;
}

interface InnerProps {
  lyricLines: Line[];
  activePos: number;
  title?: string;
  progress: number;
}

/**
 * 样式二：门帘全量。整首歌词一句一列、从上往下竖排，列与列从右往左铺满整屏。
 * follow 开启时高亮当前句并显示进度条，关闭则纯展示。
 */
function CurtainStage({
  lyricLines,
  activePos,
  progress,
  follow,
}: InnerProps & { follow?: boolean }) {
  // 按列数和最长一句的字数估算字号，尽量占满屏幕又不溢出
  const maxChars = Math.max(1, ...lyricLines.map((l) => l.lyrics.trim().length));
  const style = { '--cols': lyricLines.length, '--maxchars': maxChars } as CSSProperties;
  return (
    <div className="stage stage--curtain">
      <div className="curtain" style={style}>
        {lyricLines.map((line, pos) => (
          <div
            key={line.index}
            className={`curtain__line ${follow && pos === activePos ? 'is-active' : ''} ${follow && pos < activePos ? 'is-past' : ''}`}
          >
            {line.lyrics.trim()}
          </div>
        ))}
      </div>
      {follow && <div className="stage__progress" style={{ width: `${progress}%` }} />}
    </div>
  );
}

/** 样式一：滚动逐句。当前句居中放大，前后几句变淡 */
function ScrollStage({ lyricLines, activePos, title, progress, context }: InnerProps & { context: number }) {
  const items: { index: number; text: string; offset: number }[] = [];
  for (let off = -context; off <= context; off++) {
    const pos = activePos + off;
    if (pos < 0 || pos >= lyricLines.length) continue;
    items.push({ index: lyricLines[pos].index, text: lyricLines[pos].lyrics.trim(), offset: off });
  }
  return (
    <div className="stage">
      {title && <div className="stage__title stage__title--corner">{title}</div>}
      <div className="stage__lines">
        {items.map((it) => (
          <div
            key={it.index}
            className={`stage__line ${it.offset === 0 ? 'is-active' : ''} ${it.offset < 0 ? 'is-past' : ''}`}
            style={{ '--offset': it.offset } as CSSProperties}
          >
            {it.text}
          </div>
        ))}
      </div>
      <div className="stage__progress" style={{ width: `${progress}%` }} />
    </div>
  );
}
