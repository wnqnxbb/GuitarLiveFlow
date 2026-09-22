import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomState, SongDetail, SongTimeline } from '@shared/types';
import { TimelineClock, timelineLine } from '@shared/timeline';

type Status = 'idle' | 'recording' | 'playing' | 'paused';

/** 演出时间轴控制：录制草稿留在本机，播放仅广播行号，手机和大屏共用同一进度。 */
export function usePerformanceTimeline(song: SongDetail | null, send: (patch: Partial<RoomState>) => void) {
  const clock = useRef(new TimelineClock());
  const [status, setStatus] = useState<Status>('idle');
  const statusRef = useRef<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [draft, setDraft] = useState<string[]>([]);
  const draftRef = useRef<string[]>([]);
  const [saved, setSaved] = useState<SongTimeline | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const lastLine = useRef(-1);
  const songRef = useRef(song);
  songRef.current = song;
  const signature = song ? JSON.stringify([song.id, song.chordpro, song.timeline]) : '';

  /** 同步更新状态引用，快速连续按踏板时不依赖上一轮 React 渲染。 */
  const changeStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    const current = songRef.current;
    clock.current.pause();
    clock.current.seek(0);
    clock.current.setRate(1);
    changeStatus('idle');
    setElapsed(0);
    setSpeed(1);
    setSaved(current?.timeline ?? null);
    setEditorOpen(false);
    setNotice('');
    let values = current?.timeline?.times.map(String) ?? [];
    if (current) {
      try {
        const local = JSON.parse(localStorage.getItem(`performance.timeline.v1.${current.id}`) ?? 'null');
        if (local?.source === current.chordpro && Array.isArray(local.times) && local.times.every((v: unknown) => typeof v === 'string')) values = local.times;
      } catch { /* 草稿损坏时回退到服务器已保存时间轴。 */ }
    }
    draftRef.current = values;
    setDraft(values);
    send({ mode: 'manual' });
  }, [signature, changeStatus, send]);

  /** 每次修改立即落盘，刷新或离开页面仍可继续编辑未保存的打点。 */
  const updateDraft = useCallback((values: string[]) => {
    draftRef.current = values;
    setDraft(values);
    const current = songRef.current;
    if (!current) return;
    try {
      localStorage.setItem(`performance.timeline.v1.${current.id}`, JSON.stringify({ source: current.chordpro, times: values }));
    } catch { setNotice('本机无法保存草稿，请在离开前保存到歌曲。'); }
  }, []);

  /** 停止自动推进并保留当前位置；用于切换回传统手动/等时模式。 */
  const stop = useCallback(() => {
    clock.current.pause();
    changeStatus('idle');
    send({ mode: 'manual' });
  }, [changeStatus, send]);

  useEffect(() => {
    if (status !== 'playing' && status !== 'recording') return;
    const tick = () => {
      const position = clock.current.position();
      setElapsed(position);
      if (statusRef.current !== 'playing' || !saved) return;
      const index = timelineLine(saved.times, position);
      if (index !== lastLine.current) {
        lastLine.current = index;
        send({ lineIndex: index });
      }
      if (index === saved.times.length - 1) stop();
    };
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [status, saved, send, stop]);

  useEffect(() => () => { clock.current.pause(); }, []);

  /** 从零开始计时，第一行由使用者在实际进入时打点，因此支持开唱前等待。 */
  const record = () => {
    updateDraft([]);
    clock.current.pause();
    clock.current.setRate(1);
    clock.current.seek(0);
    clock.current.play();
    lastLine.current = -1;
    setElapsed(0);
    setSpeed(1);
    setEditorOpen(false);
    changeStatus('recording');
    send({ mode: 'manual', lineIndex: -1 });
  };

  /** 逐行打点；撤回会移除最后一个时间点，不改变本轮录制起点。 */
  const mark = (direction: number, count: number) => {
    if (direction < 0) {
      const next = draftRef.current.slice(0, -1);
      updateDraft(next);
      send({ lineIndex: next.length - 1 });
      return;
    }
    if (draftRef.current.length >= count) return;
    // 限制到毫秒精度，防止同一时刻的重复按键形成相同时间点。
    const time = Math.max(clock.current.position(), Number(draftRef.current.at(-1) ?? -1) + 0.001);
    const next = [...draftRef.current, time.toFixed(3)];
    updateDraft(next);
    send({ lineIndex: next.length - 1 });
    if (next.length === count) { stop(); setEditorOpen(true); }
  };

  /** 新播放从时间轴零点开始，暂停后继续则保留句内进度。 */
  const play = () => {
    if (!saved) return;
    if (statusRef.current !== 'paused') {
      clock.current.seek(0);
      lastLine.current = timelineLine(saved.times, 0);
      send({ lineIndex: lastLine.current });
      setElapsed(0);
    }
    clock.current.play();
    changeStatus('playing');
    send({ mode: 'timeline' });
  };

  /** 暂停时固定句内进度，同时告诉其他终端当前已停止自动推进。 */
  const pause = () => {
    clock.current.pause();
    setElapsed(clock.current.position());
    changeStatus('paused');
    send({ mode: 'manual' });
  };

  /** 现场上一句/下一句及“对齐本句”，都把后续计时锚定在所选句的开头。 */
  const calibrate = (index: number) => {
    if (!saved || index < 0 || index >= saved.times.length) return;
    clock.current.seek(saved.times[index]);
    lastLine.current = index;
    setElapsed(saved.times[index]);
    send({ lineIndex: index });
  };

  /** 在原有进度处改变速度，0.8 倍代表唱得更慢。 */
  const changeSpeed = (value: number) => {
    clock.current.setRate(value);
    setSpeed(value);
  };

  return { status, elapsed, speed, draft, saved, editorOpen, notice, setEditorOpen, setSaved, updateDraft,
    record, mark, play, pause, stop, calibrate, changeSpeed };
}
