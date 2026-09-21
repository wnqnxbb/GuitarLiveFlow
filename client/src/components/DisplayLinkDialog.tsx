import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { DisplayShare } from '@shared/types';
import { api } from '../lib/api';
import { Modal } from './Modal';

/** 大屏分享弹窗：展示稳定的六位简码，以及兼容原有路由的链接和二维码。 */
export function DisplayLinkDialog({ songId, songTitle, onClose }: { songId: number; songTitle?: string; onClose: () => void }) {
  const path = `/display/${songId}`;
  const url = `${location.origin}${path}`;
  const [share, setShare] = useState<DisplayShare | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    let active = true;
    setShare(null); setError('');
    api.createDisplayShare(songId).then((value) => { if (active) setShare(value); }).catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [songId, retry]);
  useEffect(() => {
    if (!copyMessage) return;
    const timer = window.setTimeout(() => setCopyMessage(''), 2200);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);
  /** Clipboard 不可用时在当前模态框内回退复制，失败则明确提示手动复制。 */
  async function copy(text: string, label: string, button: HTMLButtonElement) {
    try {
      try { await navigator.clipboard.writeText(text); }
      catch {
        const input = document.createElement('textarea');
        input.value = text; input.style.cssText = 'position:fixed;opacity:0';
        button.closest('dialog')!.appendChild(input); input.select();
        const success = document.execCommand('copy'); input.remove(); button.focus();
        if (!success) throw new Error('copy failed');
      }
      setCopyMessage(`${label}已复制`);
    } catch { setCopyMessage('自动复制不可用，请长按内容手动复制'); }
  }
  return (
    <Modal title="分享大屏歌词" onClose={onClose}>
      <p className="dialog__sub">{songTitle ? `《${songTitle}》` : ''}<br />扫描二维码、打开链接，或在首页输入密钥。</p>
      <div className="dialog__qr"><QRCodeSVG value={url} size={168} marginSize={2} /></div>
      <div className="share-code"><span>6 位大屏密钥</span>{share ? <><strong>{share.code}</strong><button className="btn btn--small" onClick={(e) => void copy(share.code, '密钥', e.currentTarget)}>复制密钥</button></> : error ? <><p className="error" role="alert">{error}</p><button className="btn btn--small" onClick={() => setRetry((v) => v + 1)}>重新生成</button></> : <p role="status">正在生成密钥…</p>}</div>
      <div className="linkrow"><Link className="linkrow__url" to={path} target="_blank" rel="noreferrer" title="打开大屏">{url}</Link><button className="btn btn--small" onClick={(e) => void copy(url, '链接', e.currentTarget)}>复制链接</button></div>
      <p className="copy-message" role="status">{copyMessage}</p>
      <p className="dialog__hint">在另一台设备打开，翻行会实时同步。<br />同一首歌的密钥保持不变。</p>
    </Modal>
  );
}
