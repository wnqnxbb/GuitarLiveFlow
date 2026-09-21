import type { CSSProperties } from 'react';

export type IconName = 'arrow' | 'back' | 'phone' | 'monitor' | 'guitar' | 'close' | 'settings' | 'search';
const paths: Record<IconName, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 3h4m-3 14h2',
  monitor: 'M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 15v4m-5 0h10',
  guitar: 'M13 9 19 3l2 2-6 6m-2-2c-1-1-3-1-4 0-1 1-1 2-2 3-2 0-4 1-4 3-1 3 2 6 5 6 2 0 3-2 3-4 1-1 2-1 3-2 1-1 1-3 1-4M9 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-4 4 2 2m11-16 3 3',
  close: 'm6 6 12 12M6 18 18 6',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm3 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5',
};

/** 统一线性图标，装饰图标由外层可访问名称说明用途。 */
export function Icon({ name, size = 22, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} vectorEffect="non-scaling-stroke" /></svg>;
}
