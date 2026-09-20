import type { ParsedSong } from '@shared/chordpro';

interface Props {
  song: ParsedSong | null;
  activeIndex: number;
  title?: string;
  /** 当前行前后各显示几行 */
  context?: number;
}

/**
 * 大屏歌词：当前句居中放大，前后几句变淡。
 * 只展示歌词，纯和弦的前奏/间奏不出现；遇到间奏时继续高亮上一句歌词。
 */
export function LyricsStage({ song, activeIndex, title, context = 2 }: Props) {
  // 只保留有歌词的行，并记录它们在原曲中的行号
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
