import type { StageFont } from '@shared/types';

/** 书法字体的 CSS 字体名，键与 StageFont 里的书法项一一对应 */
const CALLIGRAPHY: Record<Exclude<StageFont, 'sans'>, string> = {
  mashan: 'Ma Shan Zheng',
  zhimang: 'Zhi Mang Xing',
  maocao: 'Liu Jian Mao Cao',
  longcang: 'Long Cang',
  xiaowei: 'ZCOOL XiaoWei',
};

const FALLBACK = 'var(--lyric-font-fallback)';

/**
 * 大屏歌词字体 id -> CSS font-family。
 * 字体文件在 client/public/fonts/（见 client/scripts/build-fonts.sh），
 * 设为 undefined 表示用页面默认字体，此时不会下载任何 web 字体。
 */
const FAMILIES: Record<StageFont, string | undefined> = {
  sans: undefined,
  mashan: `'${CALLIGRAPHY.mashan}', ${FALLBACK}`,
  zhimang: `'${CALLIGRAPHY.zhimang}', ${FALLBACK}`,
  maocao: `'${CALLIGRAPHY.maocao}', ${FALLBACK}`,
  longcang: `'${CALLIGRAPHY.longcang}', ${FALLBACK}`,
  xiaowei: `'${CALLIGRAPHY.xiaowei}', ${FALLBACK}`,
};

/** 返回要应用到歌词容器上的 font-family；默认字体返回 undefined */
export function lyricFontFamily(font: StageFont | undefined): string | undefined {
  return font ? FAMILIES[font] : undefined;
}

let warmed = false;

/**
 * 空闲时后台预热全部书法字体：每个 woff2 有 2~3MB，等切换时才下载会先显示回退字体、
 * 几秒后才"换脸"；提前用 document.fonts.load 把字体拉下来并解析好，之后切换即刻生效。
 * 加载失败（离线、字体文件被剥离）不影响正文，静默忽略。
 */
export function warmupLyricFonts(): void {
  if (warmed || typeof document === 'undefined' || !document.fonts) return;
  warmed = true;
  const load = () => {
    for (const name of Object.values(CALLIGRAPHY)) {
      document.fonts.load(`40px "${name}"`).catch(() => {});
    }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(load, { timeout: 4000 });
  else window.setTimeout(load, 1000);
}
