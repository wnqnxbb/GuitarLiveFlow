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

/** 演出房间的实时状态，手机端是唯一写入方 */
export interface RoomState {
  songId: number | null;
  lineIndex: number;
  mode: ScrollMode;
  /** 自动模式下每行停留秒数 */
  secondsPerLine: number;
  /** 手机端当前移调半音数，大屏不用，练习端可参考 */
  transpose: number;
  updatedAt: number;
}

export const DEFAULT_ROOM_STATE: RoomState = {
  songId: null,
  lineIndex: 0,
  mode: 'manual',
  secondsPerLine: 6,
  transpose: 0,
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
