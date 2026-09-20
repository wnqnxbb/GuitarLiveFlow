import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  songId: number;
  songTitle?: string;
  onClose: () => void;
}

/**
 * 大屏链接弹窗：展示这首歌的大屏二维码和链接。
 * 链接可点击直接跳转，右侧按钮一键复制。
 */
export function DisplayLinkDialog({ songId, songTitle, onClose }: Props) {
  const path = `/display/${songId}`;
  const url = `${location.origin}${path}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 非 HTTPS 或老浏览器下 clipboard 不可用，退回手动选中复制
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="dialog" onClick={onClose}>
      <div className="dialog__card" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <strong>大屏歌词</strong>
          <button className="btn btn--ghost" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <p className="dialog__sub">
          {songTitle ? `《${songTitle}》` : ''}在大屏/投影上打开这个链接，翻行会实时同步
        </p>
        <div className="dialog__qr">
          <QRCodeSVG value={url} size={200} marginSize={2} />
        </div>
        <div className="linkrow">
          <Link className="linkrow__url" to={path} target="_blank" rel="noreferrer" title="点开大屏">
            {url}
          </Link>
          <button className="btn btn--small" onClick={copy}>
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <p className="dialog__hint">手机和大屏要在同一网络；点链接可直接在本机打开大屏。</p>
      </div>
    </div>
  );
}
