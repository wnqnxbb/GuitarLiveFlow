import { useEffect } from 'react';

interface Props {
  images: { id: number; url: string }[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

/**
 * 全屏看图：点击练习页的谱子图片后弹出，图片等比缩放完整显示，不裁剪。
 * 点击背景或按 Esc 关闭，← → 切换上一张/下一张。
 */
export function ImageLightbox({ images, index, onIndex, onClose }: Props) {
  const count = images.length;
  const clamp = (i: number) => (i + count) % count;

  useEffect(() => {
    // 捕获阶段拦截，避免触发练习页的翻行快捷键
    const onKey = (e: KeyboardEvent) => {
      if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onIndex(clamp(index + 1));
      else onIndex(clamp(index - 1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, count, onClose, onIndex]);

  const img = images[index];
  if (!img) return null;

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <img className="lightbox__img" src={img.url} alt="原谱大图" onClick={(e) => e.stopPropagation()} />
      <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <button className="btn btn--ghost" onClick={() => onIndex(clamp(index - 1))} aria-label="上一张">
            ‹
          </button>
        )}
        <span className="lightbox__count">
          {index + 1}/{count}
        </span>
        {count > 1 && (
          <button className="btn btn--ghost" onClick={() => onIndex(clamp(index + 1))} aria-label="下一张">
            ›
          </button>
        )}
        <button className="btn btn--ghost" onClick={onClose} aria-label="关闭">
          ✕
        </button>
      </div>
    </div>
  );
}
