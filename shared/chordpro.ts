/**
 * 极简 ChordPro 解析与工具函数，客户端和服务端共用。
 *
 * 支持：
 *  - {title:}/{t:}  {subtitle:}/{st:}/{artist:}  {key:}  {capo:}  {tempo:}  {time:}
 *  - {comment:}/{c:}  作为提示行
 *  - {start_of_verse: 名称}/{sov: 名称}  {start_of_chorus: 名称}/{soc}  {start_of_bridge}/{sob}
 *    以及对应的 {end_of_*}/{eov}/{eoc}/{eob}；也支持 {section: 名称}
 *  - 独占一行的 【前奏】 或 [前奏] 作为段落标题
 *  - 行内 [C] [Am7] [G/B] 等和弦标记
 *  - 以 # 开头的行为注释，忽略
 */

export interface SongMeta {
  title: string;
  subtitle?: string;
  key?: string;
  capo?: number;
  tempo?: string;
  time?: string;
}

export interface ChordToken {
  /** 和弦所在的歌词字符位置 */
  pos: number;
  chord: string;
}

export interface Line {
  /** 全曲范围内的行号，仅"可同步"的行（歌词行 / 纯和弦行）有值 */
  index: number;
  sectionIndex: number;
  sectionName: string;
  chords: ChordToken[];
  lyrics: string;
  /** 只有和弦没有歌词，例如前奏、间奏 */
  instrumental: boolean;
}

export interface Section {
  index: number;
  name: string;
  /** 段落内的提示行（{comment:}），不参与同步 */
  comments: string[];
  lines: Line[];
}

export interface ParsedSong {
  meta: SongMeta;
  sections: Section[];
  /** 所有可同步的行，按顺序展开 */
  lines: Line[];
}

const CHORD_RE =
  /^[A-G](#|b)?(m|M|maj|min|dim|aug|sus|add|\+|-|°|ø)?[0-9]*(sus[24]?|add[0-9]+|maj[0-9]+|\/[A-G](#|b)?)*(\([^)]*\))?$/;

export function isChordName(s: string): boolean {
  return CHORD_RE.test(s.trim());
}

const SECTION_START: Record<string, string> = {
  start_of_verse: '主歌',
  sov: '主歌',
  start_of_chorus: '副歌',
  soc: '副歌',
  start_of_bridge: '桥段',
  sob: '桥段',
  start_of_tab: '谱',
  sot: '谱',
  section: '',
  s: '',
};
const SECTION_END = new Set([
  'end_of_verse', 'eov', 'end_of_chorus', 'eoc', 'end_of_bridge', 'eob', 'end_of_tab', 'eot',
]);

function parseInline(raw: string): { chords: ChordToken[]; lyrics: string } {
  const chords: ChordToken[] = [];
  let lyrics = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '[') {
      const end = raw.indexOf(']', i);
      if (end > i) {
        chords.push({ pos: lyrics.length, chord: raw.slice(i + 1, end).trim() });
        i = end + 1;
        continue;
      }
    }
    lyrics += ch;
    i += 1;
  }
  return { chords, lyrics };
}

export function parseChordPro(text: string): ParsedSong {
  const meta: SongMeta = { title: '' };
  const sections: Section[] = [];
  const lines: Line[] = [];

  let current: Section | null = null;
  const ensureSection = (name?: string): Section => {
    if (!current) {
      current = { index: sections.length, name: name ?? '', comments: [], lines: [] };
      sections.push(current);
    }
    return current;
  };
  const startSection = (name: string) => {
    current = { index: sections.length, name, comments: [], lines: [] };
    sections.push(current);
  };
  const endSection = () => {
    current = null;
  };

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    if (trimmed.startsWith('#')) continue;

    // 指令 {name: value}
    const dm = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/.exec(trimmed);
    if (dm) {
      const name = dm[1].toLowerCase();
      const value = (dm[2] ?? '').trim();
      switch (name) {
        case 'title':
        case 't':
          meta.title = value;
          break;
        case 'subtitle':
        case 'st':
        case 'artist':
          meta.subtitle = value;
          break;
        case 'key':
          meta.key = value;
          break;
        case 'capo':
          meta.capo = Number.parseInt(value, 10) || 0;
          break;
        case 'tempo':
          meta.tempo = value;
          break;
        case 'time':
          meta.time = value;
          break;
        case 'comment':
        case 'c':
        case 'ci':
        case 'comment_italic':
          ensureSection().comments.push(value);
          break;
        default:
          if (name in SECTION_START) {
            startSection(value || SECTION_START[name]);
          } else if (SECTION_END.has(name)) {
            endSection();
          }
          // 其它未知指令忽略
      }
      continue;
    }

    // 独占一行的段落标题：【前奏】 或 [Intro]（但 [C] 这类和弦不算）
    const hm = /^(?:【([^【】]+)】|\[([^\[\]]+)\])$/.exec(trimmed);
    if (hm) {
      const label = (hm[1] ?? hm[2]).trim();
      if (!isChordName(label)) {
        startSection(label);
        continue;
      }
    }

    const { chords, lyrics } = parseInline(line);
    const lyricText = lyrics.trim();
    const section = ensureSection();
    const l: Line = {
      index: lines.length,
      sectionIndex: section.index,
      sectionName: section.name,
      chords,
      lyrics: lyricText === '' ? '' : lyrics.replace(/\s+$/, ''),
      instrumental: lyricText === '' && chords.length > 0,
    };
    if (lyricText === '' && chords.length === 0) continue;
    section.lines.push(l);
    lines.push(l);
  }

  return { meta, sections, lines };
}

/* ---------------- 移调 ---------------- */

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

function transposeNote(note: string, semitones: number, preferFlat: boolean): string {
  const idx = NOTE_INDEX[note];
  if (idx === undefined) return note;
  const n = (((idx + semitones) % 12) + 12) % 12;
  return preferFlat ? FLATS[n] : SHARPS[n];
}

/** 把单个和弦移调，例如 transposeChord('Am7/G', 2) => 'Bm7/A' */
export function transposeChord(chord: string, semitones: number): string {
  if (!semitones) return chord;
  const preferFlat = /b(?![a-z])/.test(chord) && !chord.includes('#');
  return chord.replace(/([A-G])(#|b)?/g, (_m, root: string, acc: string | undefined) =>
    transposeNote(root + (acc ?? ''), semitones, preferFlat),
  );
}

export function transposeSong(song: ParsedSong, semitones: number): ParsedSong {
  if (!semitones) return song;
  const mapLine = (l: Line): Line => ({
    ...l,
    chords: l.chords.map((c) => ({ ...c, chord: transposeChord(c.chord, semitones) })),
  });
  const sections = song.sections.map((s) => ({ ...s, lines: s.lines.map(mapLine) }));
  const lines = sections.flatMap((s) => s.lines);
  const meta = { ...song.meta, key: song.meta.key ? transposeChord(song.meta.key, semitones) : song.meta.key };
  return { meta, sections, lines };
}
