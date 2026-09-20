import { displayTextForLine, type ParsedSong } from '@shared/chordpro';

interface Props {
  song: ParsedSong | null;
  activeIndex: number;
  title?: string;
  /** 当前行前后各显示几行 */
  context?: number;
}

/**
 * 大屏歌词：当前句居中放大，前后几句变淡。
 * 不用滚动容器，直接按行号切片渲染，切换时靠 CSS 过渡。
 */
export function LyricsStage({ song, activeIndex, title, context = 2 }: Props) {
  if (!song || song.lines.length === 0) {
    return (
      <div className="stage stage--idle">
        <div className="stage__title">{title ?? '等待开始'}</div>
      </div>
    );
  }
  const items: { index: number; text: string; offset: number }[] = [];
  for (let off = -context; off <= context; off++) {
    const idx = activeIndex + off;
    if (idx < 0 || idx >= song.lines.length) continue;
    items.push({ index: idx, text: displayTextForLine(song.lines[idx]), offset: off });
  }
  return (
    <div className="stage">
      {title && <div className="stage__title stage__title--corner">{title}</div>}
      <div className="stage__lines">
        {items.map((it) => (
          <div
            key={it.index}
            className={`stage__line ${it.offset === 0 ? 'is-active' : ''} ${it.offset < 0 ? 'is-past' : ''}`}
            style={{ '--offset': it.offset } as React.CSSProperties}
          >
            {it.text}
          </div>
        ))}
      </div>
      <div className="stage__progress" style={{ width: `${((activeIndex + 1) / song.lines.length) * 100}%` }} />
    </div>
  );
}
