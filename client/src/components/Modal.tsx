import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** 原生模态框提供焦点圈定、Escape 关闭及关闭后的焦点恢复。 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal__body">
        <div className="dialog__head"><h2>{title}</h2><button className="btn btn--ghost" onClick={onClose} aria-label="关闭"><Icon name="close" /></button></div>
        {children}
      </div>
    </dialog>
  );
}
