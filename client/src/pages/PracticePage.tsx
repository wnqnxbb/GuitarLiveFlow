import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ChordSheet } from '../components/ChordSheet';
import { ImageLightbox } from '../components/ImageLightbox';
import { SongPicker } from '../components/SongPicker';
import { useAutoAdvance, useKeyboardNav, useLocalStorage, useScrollToActive, useSong, useTransposed } from '../lib/hooks';

/**
 * 电脑练习页：本地控制，不广播。
 * 左边和弦歌词，右边原图（如果有）。
 */
export function PracticePage() {
  const params = useParams<{ id?: string }>();
  const [songId, setSongId] = useState<number | null>(params.id ? Number(params.id) : null);
  const { song, parsed } = useSong(songId);
  const [transpose, setTranspose] = useState(0);
  const sheet = useTransposed(parsed, transpose);
  const [fontSize, setFontSize] = useLocalStorage('practice.fontSize', 20);
  const [showImage, setShowImage] = useLocalStorage('practice.showImage', true);
  const [tile, setTile] = useLocalStorage('practice.tile', false);
  const [showLyricsOnly, setShowLyricsOnly] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [line, setLine] = useState(0);
  const [auto, setAuto] = useState(false);
  const [seconds, setSeconds] = useState(6);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = sheet?.lines.length ?? 0;
  const go = useCallback((idx: number) => setLine(Math.max(0, Math.min(Math.max(0, total - 1), idx))), [total]);
  const next = useCallback(() => go(line + 1), [go, line]);
  const prev = useCallback(() => go(line - 1), [go, line]);
  useKeyboardNav(next, prev, { t: () => setTile((v) => !v) });
  useAutoAdvance(auto && total > 0, seconds, () => (line >= total - 1 ? setAuto(false) : next()));
  useScrollToActive(containerRef, line);

  const hasImage = !!song?.images.length;

  if (songId === null) {
    return (
      <div className="page">
        <header className="bar">
          <Link to="/" className="btn btn--ghost">
            <Icon name="back" size={18} /> 首页
          </Link>
          <span className="bar__title">练习：选择歌曲</span>
        </header>
        <SongPicker value={null} onChange={(id) => (setSongId(id), setLine(0))} variant="cards" />
      </div>
    );
  }

  return (
    <div className="page practice">
      <header className="bar">
        <Link to="/" className="btn btn--ghost">
          <Icon name="back" size={18} /> 首页
        </Link>
        <button className="btn btn--ghost" onClick={() => setSongId(null)}>
          ♪ {song?.title ?? '…'}
          {song?.artist && <small> {song.artist}</small>}
        </button>
        <span className="bar__meta">
          {line + 1}/{total}
        </span>
        <div className="bar__tools" aria-label="练习工具">
          <div className="tool-group" role="group" aria-label="字号">
          <button className="btn" onClick={() => setFontSize(Math.max(12, fontSize - 2))}>
            A-
          </button>
          <button className="btn" onClick={() => setFontSize(Math.min(40, fontSize + 2))}>
            A+
          </button>
          </div><div className="tool-group" role="group" aria-label="移调">
          <button className="btn" aria-label="降低半音" onClick={() => setTranspose((t) => t - 1)}>
            ♭
          </button>
          <span className="tools__value">
            {transpose > 0 ? '+' : ''}
            {transpose}
            {sheet?.meta.key && ` (${sheet.meta.key})`}
          </span>
          <button className="btn" aria-label="升高半音" onClick={() => setTranspose((t) => t + 1)}>
            ♯
          </button>
          </div><div className="tool-group" role="group" aria-label="自动翻行">
          <button className={`btn ${auto ? 'btn--primary' : ''}`} onClick={() => setAuto((v) => !v)}>
            {auto ? '暂停' : '自动'}
          </button>
          <input
            className="input input--num"
            type="number"
            min={1}
            max={60}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value) || 6)}
            title="每行秒数"
          />
          </div><div className="tool-group" role="group" aria-label="阅读视图">
          <button className={`btn ${showLyricsOnly ? 'btn--primary' : ''}`} onClick={() => setShowLyricsOnly((v) => !v)}>
            {showLyricsOnly ? '显示和弦' : '只看歌词'}
          </button>
          {hasImage && (
            <button className={`btn ${tile ? 'btn--primary' : ''}`} onClick={() => setTile((v) => !v)}>
              平铺
            </button>
          )}
          {hasImage && !tile && (
            <button className={`btn ${showImage ? 'btn--primary' : ''}`} onClick={() => setShowImage(!showImage)}>
              原图
            </button>
          )}
          </div>
        </div>
      </header>

      <div className={`practice__body ${tile && hasImage ? 'is-tile' : hasImage && showImage ? 'has-image' : ''}`}>
        {tile && hasImage ? (
          <div className="practice__tiles">
            {song!.images.map((img, i) => (
              <div className="practice__tile" key={img.id}>
                <img src={img.url} alt="原谱" loading="lazy" onClick={() => setZoom(i)} title="点击放大" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="practice__sheet" ref={containerRef}>
              {sheet && (
                <ChordSheet song={sheet} activeIndex={line} fontSize={fontSize} showChords={!showLyricsOnly} onLineClick={go} />
              )}
              <div className="perform__spacer" />
            </div>
            {hasImage && showImage && (
              <div className="practice__images">
                {song!.images.map((img, i) => (
                  <img key={img.id} src={img.url} alt="原谱" loading="lazy" onClick={() => setZoom(i)} title="点击放大" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <p className="hint hint--bottom">↑↓ 或空格翻行，点击某一行直接跳转。按 T 切换谱子平铺，点击谱子图片可全屏放大。练习页不会同步到大屏。</p>
      {zoom !== null && song && <ImageLightbox images={song.images} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
