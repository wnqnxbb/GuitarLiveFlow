import { useState } from 'react';
import type { ParsedSong } from '@shared/chordpro';
import type { SongDetail, SongTimeline } from '@shared/types';
import { timelineError } from '@shared/timeline';
import { api } from '../lib/api';
import { Modal } from './Modal';

interface Props {
  song: SongDetail;
  parsed: ParsedSong;
  draft: string[];
  onChange: (values: string[]) => void;
  onSaved: (timeline: SongTimeline) => void;
  onRecord: () => void;
  onClose: () => void;
}

/** 编辑每行开始秒数；失败保留草稿，正式保存沿用歌曲管理登录权限。 */
export function TimelineEditor({ song, parsed, draft, onChange, onSaved, onRecord, onClose }: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmRecord, setConfirmRecord] = useState(false);

  /** 校验完整性和时序后保存，禁止将部分打点误当作完整歌曲使用。 */
  async function save() {
    const times = parsed.lines.map((_, i) => draft[i]?.trim() ? Number(draft[i]) : NaN);
    const timeline = { source: song.chordpro, times };
    const validation = timelineError(timeline, song.chordpro, parsed.lines.length);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError('');
    try {
      if (needsLogin) { await api.login(password); setPassword(''); }
      else if (!(await api.me()).admin) { setNeedsLogin(true); return; }
      const updated = await api.saveTimeline(song.id, timeline);
      onSaved(updated.timeline!);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : '保存失败，请重试';
      if (message.includes('登录')) setNeedsLogin(true);
      setError(message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="逐句时间轴" onClose={() => { if (!busy) onClose(); }}>
      <p className="tools__hint">每行填写从演出开始算起的秒数。前奏、间奏也要打点；重复歌词按演唱顺序分别记录。草稿自动留在本机，保存后其他设备也可使用。</p>
      <div className="timeline-editor__actions">
        <button className="btn" disabled={busy || !parsed.lines.length} onClick={() => draft.length ? setConfirmRecord(true) : onRecord()}>重新排练打点</button>
        {confirmRecord && <div role="alert"><p>重新录制会替换本机草稿，已保存的时间轴仍保留。</p><button className="btn" onClick={onRecord}>清空草稿并开始</button><button className="btn btn--ghost" onClick={() => setConfirmRecord(false)}>取消</button></div>}
      </div>
      <div className="timeline-editor__lines">
        {parsed.lines.map((line, i) => (
          <label className="timeline-editor__line" key={line.index}>
            <span>{i + 1}. {line.lyrics.trim() || `（纯和弦）${line.chords.map((c) => c.chord).join(' ')}`}</span>
            <input className="input" aria-label={`第 ${i + 1} 行开始秒数`} type="number" min="0" max="86400" step="0.001" placeholder="未打点" value={draft[i] ?? ''} disabled={busy} onChange={(e) => { const values = parsed.lines.map((_, index) => draft[index] ?? ''); values[i] = e.target.value; onChange(values); }} />
          </label>
        ))}
      </div>
      <form className="timeline-editor__actions" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {needsLogin && <label>保存到歌曲需要管理员密码<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} required /></label>}
        {error && <p role="alert">{error}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? '正在保存…' : needsLogin ? '登录并保存时间轴' : '保存到歌曲'}</button>
      </form>
    </Modal>
  );
}
