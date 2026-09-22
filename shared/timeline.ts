import type { SongTimeline } from './types.js';

/** 校验完整时间轴：每个词谱行都必须有独立且递增的开始时间，包含重复段落和间奏。 */
export function timelineError(value: unknown, source: string, lineCount: number): string | null {
  if (!value || typeof value !== 'object') return '时间轴格式无效';
  const timeline = value as SongTimeline;
  if (timeline.source !== source) return '词谱已修改，请重新加载歌曲后打点';
  if (!Array.isArray(timeline.times) || !lineCount || timeline.times.length !== lineCount) return '请为每一行记录开始时间（包含前奏和间奏）';
  let previous = -1;
  for (const time of timeline.times) {
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > 86400) return '开始时间必须在 0 到 86400 秒之间';
    if (time <= previous) return '每行开始时间必须大于上一行';
    previous = time;
  }
  return null;
}

/** 按实际经过时间定位当前行，定时回调延迟时直接追上进度，避免逐次累积误差。 */
export function timelineLine(times: readonly number[], seconds: number): number {
  let index = -1;
  for (let i = 0; i < times.length && times[i] <= seconds; i++) index = i;
  return index;
}

/** 可暂停、变速和校准的演出时钟；注入单调时钟便于验证现场控制的边界行为。 */
export class TimelineClock {
  private offset = 0;
  private anchor = 0;
  private running = false;
  private rate = 1;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** 获取时间轴秒数，暂停期间保持不变。 */
  position(): number {
    return this.offset + (this.running ? (this.now() - this.anchor) * this.rate / 1000 : 0);
  }

  /** 从当前进度继续，不丢弃暂停前已经唱过的半句。 */
  play(): void {
    if (this.running) return;
    this.anchor = this.now();
    this.running = true;
  }

  /** 固定当前位置，继续播放时再建立新的时钟锚点。 */
  pause(): void {
    this.offset = this.position();
    this.running = false;
  }

  /** 手动定位后重置锚点，使下一句等待完整的相邻时间差。 */
  seek(seconds: number): void {
    this.offset = seconds;
    this.anchor = this.now();
  }

  /** 调速前先保留当前进度，避免变速导致跳句。 */
  setRate(rate: number): void {
    this.seek(this.position());
    this.rate = rate;
  }
}
