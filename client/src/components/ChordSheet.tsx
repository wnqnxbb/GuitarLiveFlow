import { Fragment, type CSSProperties } from 'react';
import type { Line, ParsedSong } from '@shared/chordpro';

interface Props {
  song: ParsedSong;
  activeIndex: number;
  /** 是否显示和弦（大屏歌词模式为 false） */
  showChords?: boolean;
  fontSize?: number;
  onLineClick?: (index: number) => void;
  /** 只渲染当前行附近的几行；undefined 表示全部 */
  window?: number;
}

/** 把一行拆成 [和弦, 歌词片段] 的序列，和弦对齐到歌词的字 */
function segments(line: Line): { chord: string; text: string }[] {
  if (line.chords.length === 0) return [{ chord: '', text: line.lyrics }];
  const out: { chord: string; text: string }[] = [];
  const first = line.chords[0];
  if (first.pos > 0) out.push({ chord: '', text: line.lyrics.slice(0, first.pos) });
  line.chords.forEach((c, i) => {
    const end = i + 1 < line.chords.length ? line.chords[i + 1].pos : line.lyrics.length;
    out.push({ chord: c.chord, text: line.lyrics.slice(c.pos, end) });
  });
  return out;
}

/** 手机演出 / 电脑练习用的和弦歌词谱 */
export function ChordSheet({ song, activeIndex, showChords = true, fontSize = 20, onLineClick, window: win }: Props) {
  const style = { '--sheet-font': `${fontSize}px` } as CSSProperties;
  return (
    <div className={`sheet ${showChords ? 'sheet--chords' : 'sheet--lyrics'}`} style={style}>
      {song.sections.map((section) => {
        const visible = section.lines.filter((l) => win === undefined || Math.abs(l.index - activeIndex) <= win);
        if (visible.length === 0 && section.comments.length === 0) return null;
        return (
          <section key={section.index} className="sheet__section">
            {section.name && <h3 className="sheet__section-title">{section.name}</h3>}
            {section.comments.map((c, i) => (
              <p key={i} className="sheet__comment">
                {c}
              </p>
            ))}
            {visible.map((line) => (
              <div
                key={line.index}
                data-line={line.index}
                className={`sheet__line ${line.index === activeIndex ? 'is-active' : ''} ${line.index < activeIndex ? 'is-past' : ''} ${line.instrumental ? 'is-instrumental' : ''}`}
                onClick={onLineClick ? () => onLineClick(line.index) : undefined}
              >
                {segments(line).map((seg, i) => (
                  <Fragment key={i}>
                    <span className="sheet__seg">
                      {showChords && <span className="sheet__chord">{seg.chord || ' '}</span>}
                      <span className="sheet__text">{seg.text || (showChords && seg.chord ? ' ' : '')}</span>
                    </span>
                  </Fragment>
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
