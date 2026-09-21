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

/**
 * 大屏歌词字体：
 * - sans      系统默认黑体（不加载任何 web 字体）
 * - mashan    马善政毛笔楷书
 * - zhimang   志莽行书
 * 字体文件自托管在 client/public/fonts/，只有被选中的字体才会下载。
 */
export type StageFont = 'sans' | 'mashan' | 'zhimang';

export const STAGE_FONTS: readonly { id: StageFont; name: string; desc: string }[] = [
  { id: 'sans', name: '默认黑体', desc: '系统默认黑体，最清晰、不消耗流量' },
  { id: 'mashan', name: '毛笔楷书', desc: '马善政毛笔楷书：有笔锋又端正' },
  { id: 'zhimang', name: '行书', desc: '志莽行书：飘逸潇洒，认读稍慢' },
];

export function isStageFont(v: unknown): v is StageFont {
  return typeof v === 'string' && STAGE_FONTS.some((s) => s.id === v);
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
  /** 是否跟随进度：开启后大屏高亮当前唱到的一句并显示进度条，关闭则纯展示 */
  follow: boolean;
  /** 大屏歌词字体，手机端选择后同步给大屏 */
  font: StageFont;
  updatedAt: number;
}

export const DEFAULT_ROOM_STATE: RoomState = {
  songId: null,
  lineIndex: 0,
  mode: 'manual',
  secondsPerLine: 6,
  transpose: 0,
  stageStyle: 'scroll',
  follow: false,
  font: 'sans',
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
