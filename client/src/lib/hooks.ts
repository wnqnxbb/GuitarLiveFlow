import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SongDetail } from '@shared/types';
import { parseChordPro, transposeSong, type ParsedSong } from '@shared/chordpro';
import { api } from './api';

/** 拉取歌曲详情并解析；version 变化时重新拉取 */
export function useSong(songId: number | null, version = 0) {
  const [song, setSong] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (songId === null) {
      setSong(null);
      return;
    }
    let cancelled = false;
    api
      .getSong(songId)
      .then((s) => !cancelled && (setSong(s), setError(null)))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [songId, version]);

  const parsed = useMemo<ParsedSong | null>(() => (song ? parseChordPro(song.chordpro) : null), [song]);
  return { song, parsed, error };
}

export function useTransposed(parsed: ParsedSong | null, semitones: number) {
  return useMemo(() => (parsed ? transposeSong(parsed, semitones) : null), [parsed, semitones]);
}

/** 持久化到 localStorage 的状态，用于字号等偏好 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** 演出时保持屏幕常亮 */
export function useWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
        setActive(true);
        sentinel.addEventListener('release', () => setActive(false));
      } catch {
        setActive(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !disposed) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
  return active;
}

/** 全屏切换 */
export function useFullscreen() {
  const [isFullscreen, setIs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);
  return { isFullscreen, toggle };
}

/**
 * 键盘翻页：方向键、空格、PageUp/PageDown，以及蓝牙翻页踏板常见的按键。
 * 在输入框里打字时不触发。
 */
export function useKeyboardNav(onNext: () => void, onPrev: () => void, extra?: Record<string, () => void>) {
  const nextRef = useRef(onNext);
  const prevRef = useRef(onPrev);
  const extraRef = useRef(extra);
  nextRef.current = onNext;
  prevRef.current = onPrev;
  extraRef.current = extra;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // 分享弹窗内的 Enter/Escape 归弹窗处理，不能同时触发演出翻行或设置。
      if (document.querySelector('dialog[open]')) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.closest('button, a') && ['Enter', ' '].includes(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'Enter', 'j', 'n'].includes(e.key)) {
        e.preventDefault();
        nextRef.current();
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp', 'Backspace', 'k', 'p'].includes(e.key)) {
        e.preventDefault();
        prevRef.current();
      } else if (extraRef.current?.[e.key]) {
        e.preventDefault();
        extraRef.current[e.key]();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

/** 自动模式：每隔 secondsPerLine 秒调用一次 onTick */
export function useAutoAdvance(enabled: boolean, secondsPerLine: number, onTick: () => void) {
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => tickRef.current(), Math.max(500, secondsPerLine * 1000));
    return () => clearInterval(id);
  }, [enabled, secondsPerLine]);
}

/** 让当前行滚到容器中间 */
export function useScrollToActive(containerRef: React.RefObject<HTMLElement | null>, activeIndex: number, smooth = true) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-line="${activeIndex}"]`);
    if (!el) return;
    const top = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }, [containerRef, activeIndex, smooth]);
}
