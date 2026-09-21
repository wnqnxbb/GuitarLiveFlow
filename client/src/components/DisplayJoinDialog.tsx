import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal } from './Modal';
import { Icon } from './Icon';

/** 将六位数字作为文本输入，保留前导零，并支持整段粘贴。 */
export function DisplayJoinDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  /** 密钥校验成功后沿用分享链接路由；关闭弹窗后忽略迟到的响应。 */
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    if (!/^\d{6}$/.test(code)) { setError('请输入完整的 6 位数字密钥'); input.current?.focus(); return; }
    pending.current = true;
    setBusy(true); setError('');
    try {
      const share = await api.resolveDisplayShare(code);
      if (active.current) navigate(share.path);
    } catch (err) {
      if (active.current) { setError(err instanceof Error ? err.message : '连接失败，请重试'); input.current?.focus(); }
    } finally { if (active.current) setBusy(false); pending.current = false; }
  }
  return (
    <Modal title="打开声音幕布" onClose={onClose}>
      <div className="join-symbol"><Icon name="monitor" size={38} /></div>
      <p className="dialog__sub">在手机演出页打开「大屏链接」，<br />输入其中的 6 位数字密钥。</p>
      <form className="join-form" onSubmit={submit}>
        <label htmlFor="display-code">大屏密钥</label>
        <input ref={input} id="display-code" className="code-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="000000" value={code} aria-invalid={!!error} aria-describedby="join-error" onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }} />
        <p id="join-error" className="form-message error" role="alert">{error}</p>
        <button className="btn btn--primary join-submit" disabled={busy || code.length !== 6}>{busy ? '正在连接…' : '进入大屏'}<Icon name="arrow" size={18} /></button>
      </form>
      <p className="dialog__hint">也可以扫描二维码或直接打开分享链接。</p>
    </Modal>
  );
}
