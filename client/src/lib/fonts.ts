import type { StageFont } from '@shared/types';

/**
 * 大屏歌词字体 id -> CSS font-family。
 * 字体文件在 client/public/fonts/（见 client/scripts/build-fonts.sh），
 * 设为 undefined 表示用页面默认字体，此时不会下载任何 web 字体。
 */
const FAMILIES: Record<StageFont, string | undefined> = {
  sans: undefined,
  mashan: "'Ma Shan Zheng', var(--lyric-font-fallback)",
  zhimang: "'Zhi Mang Xing', var(--lyric-font-fallback)",
};

/** 返回要应用到歌词容器上的 font-family；默认字体返回 undefined */
export function lyricFontFamily(font: StageFont | undefined): string | undefined {
  return font ? FAMILIES[font] : undefined;
}
