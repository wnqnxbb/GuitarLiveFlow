/** 前后端共用的数据类型 */

export interface SongSummary {
  id: number;
  title: string;
  artist: string;
  key: string;
  capo: number;
  updatedAt: string;
}

export interface SongImage {
  id: number;
  url: string;
  sort: number;
}

export interface SongDetail extends SongSummary {
  chordpro: string;
  images: SongImage[];
}

export type ScrollMode = 'manual' | 'auto';

/**
 * 大屏展示样式：
 * - scroll  逐句滚动（当前句居中放大，前后句变淡）
 * - curtain 门帘全量（整首歌词竖排，一句一列从右往左排开）
 * 以后加新样式：在这里补 id + 在 LyricsStage 里补渲染即可，手机端选择器会自动出现。
 */
export type StageStyle = 'scroll' | 'curtain';

export const STAGE_STYLES: readonly { id: StageStyle; name: string; desc: string }[] = [
  { id: 'scroll', name: '滚动逐句', desc: '当前一句居中放大，前后几句变淡' },
  { id: 'curtain', name: '门帘全量', desc: '整首歌词竖排，一句一列从右往左排开' },
];

export function isStageStyle(v: unknown): v is StageStyle {
  return typeof v === 'string' && STAGE_STYLES.some((s) => s.id === v);
}

/** 演出房间的实时状态，手机端是唯一写入方 */
export interface RoomState {
  songId: number | null;
  lineIndex: number;
  mode: ScrollMode;
  /** 自动模式下每行停留秒数 */
  secondsPerLine: number;
  /** 手机端当前移调半音数，大屏不用，练习端可参考 */
  transpose: number;
  /** 大屏展示样式，手机端选择后同步给大屏 */
  stageStyle: StageStyle;
  updatedAt: number;
}

export const DEFAULT_ROOM_STATE: RoomState = {
  songId: null,
  lineIndex: 0,
  mode: 'manual',
  secondsPerLine: 6,
  transpose: 0,
  stageStyle: 'scroll',
  updatedAt: 0,
};

export type ClientRole = 'controller' | 'display';

export type ClientMessage =
  | { type: 'state'; state: Partial<RoomState> }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'state'; state: RoomState }
  | { type: 'presence'; controllers: number; displays: number }
  | { type: 'song_updated'; songId: number }
  | { type: 'pong' };
