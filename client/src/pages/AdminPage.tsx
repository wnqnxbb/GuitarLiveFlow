import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SongDetail, SongSummary } from '@shared/types';
import { parseChordPro } from '@shared/chordpro';
import { api, type SongPayload } from '../lib/api';
import { ChordSheet } from '../components/ChordSheet';

const TEMPLATE = `{title: 歌名}
{subtitle: 歌手}
{key: C}
{capo: 0}

【前奏】
[C] [G] [Am] [F]

【主歌】
[C]在这里写歌[G]词，和弦放在对应的[Am]字前面[F]

【副歌】
[C]每一行就是大屏上的一[G]句
`;

export function AdminPage() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listSongs().then(setSongs).catch((e: Error) => setError(e.message));
  useEffect(() => {
    api.me().then((r) => setAdmin(r.admin)).catch(() => setAdmin(false));
    void reload();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.login(password);
      setAdmin(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (admin === null) return <div className="page">加载中…</div>;
  if (!admin) {
    return (
      <div className="page admin">
        <header className="bar">
          <Link to="/" className="btn btn--ghost">
            ← 首页
          </Link>
          <span className="bar__title">管理登录</span>
        </header>
        <form className="login" onSubmit={login}>
          <input
            className="input"
            type="password"
            placeholder="管理员密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="btn btn--primary" type="submit">
            登录
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    );
  }

  const editingId = params.id === 'new' ? 'new' : params.id ? Number(params.id) : null;

  return (
    <div className="page admin">
      <header className="bar">
        <Link to="/" className="btn btn--ghost">
          ← 首页
        </Link>
        <span className="bar__title">谱子管理</span>
        <span className="bar__tools">
          <button className="btn btn--primary" onClick={() => navigate('/admin/new')}>
            + 新歌
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => api.logout().then(() => setAdmin(false))}
          >
            退出
          </button>
        </span>
      </header>
      <div className="admin__body">
        <aside className="admin__list">
          {songs.map((s) => (
            <Link key={s.id} to={`/admin/${s.id}`} className={`admin__item ${s.id === editingId ? 'is-active' : ''}`}>
              <span>{s.title}</span>
              <small>{s.artist}</small>
            </Link>
          ))}
          {songs.length === 0 && <p className="hint">还没有歌，点「新歌」开始</p>}
        </aside>
        <main className="admin__editor">
          {editingId === null ? (
            <div className="admin__welcome">
              <h2>怎么录谱</h2>
              <ol>
                <li>
                  和弦写在方括号里，放在它开始弹的那个字前面：<code>[C]她的眼[G]睛</code>
                </li>
                <li>
                  每一行歌词就是大屏上的一句，也是手机翻页的最小单位。
                </li>
                <li>
                  段落标题独占一行，用 <code>【前奏】</code> 或 <code>【主歌】</code>；只有和弦没歌词的行大屏会显示「♪ 前奏」。
                </li>
                <li>
                  开头的 <code>{'{title: }'}</code> <code>{'{key: }'}</code> <code>{'{capo: }'}</code> 是歌曲信息，移调以 key 为准。
                </li>
                <li>保存后可以上传原谱图片，练习页会并排显示。</li>
              </ol>
            </div>
          ) : (
            <SongEditor
              key={String(editingId)}
              id={editingId}
              onSaved={(s) => {
                void reload();
                if (editingId === 'new') navigate(`/admin/${s.id}`, { replace: true });
              }}
              onDeleted={() => {
                void reload();
                navigate('/admin', { replace: true });
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function SongEditor({
  id,
  onSaved,
  onDeleted,
}: {
  id: number | 'new';
  onSaved: (s: SongDetail) => void;
  onDeleted: () => void;
}) {
  const [song, setSong] = useState<SongDetail | null>(null);
  const [text, setText] = useState(id === 'new' ? TEMPLATE : '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewLine, setPreviewLine] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id === 'new') return;
    api
      .getSong(id)
      .then((s) => {
        setSong(s);
        setText(s.chordpro);
      })
      .catch((e: Error) => setMsg(e.message));
  }, [id]);

  const parsed = useMemo(() => parseChordPro(text), [text]);
  const dirty = song ? song.chordpro !== text : text !== TEMPLATE;

  const save = async () => {
    const payload: SongPayload = {
      title: parsed.meta.title || song?.title || '未命名',
      artist: parsed.meta.subtitle ?? song?.artist ?? '',
      key: parsed.meta.key ?? '',
      capo: parsed.meta.capo ?? 0,
      chordpro: text,
    };
    setSaving(true);
    try {
      const saved = id === 'new' ? await api.createSong(payload) : await api.updateSong(id, payload);
      setSong(saved);
      setMsg('已保存');
      onSaved(saved);
    } catch (e) {
      setMsg(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S 保存
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, id]);

  const upload = async (file: File) => {
    if (!song) return;
    try {
      await api.uploadImage(song.id, file);
      setSong(await api.getSong(song.id));
      setMsg('图片已上传');
    } catch (e) {
      setMsg(`上传失败：${(e as Error).message}`);
    }
  };

  const remove = async () => {
    if (!song) return;
    if (!confirm(`确定删除《${song.title}》？图片也会一起删除。`)) return;
    await api.deleteSong(song.id);
    onDeleted();
  };

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <strong>{parsed.meta.title || '未命名'}</strong>
        <span className="hint">
          {parsed.lines.length} 行 · {parsed.sections.length} 段
          {parsed.meta.key && ` · ${parsed.meta.key}调`}
          {parsed.meta.capo ? ` · Capo ${parsed.meta.capo}` : ''}
        </span>
        <span className="editor__actions">
          {msg && <span className="hint">{msg}</span>}
          {song && (
            <>
              <Link className="btn" to={`/practice/${song.id}`}>
                去练习
              </Link>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                上传原图
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = '';
                }}
              />
              <button className="btn btn--danger" onClick={remove}>
                删除
              </button>
            </>
          )}
          <button className="btn btn--primary" onClick={save} disabled={saving || !dirty}>
            {saving ? '保存中…' : dirty ? '保存' : '已保存'}
          </button>
        </span>
      </div>
      <div className="editor__panes">
        <textarea
          className="editor__text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder="在这里粘贴或输入 ChordPro 格式的谱子"
        />
        <div className="editor__preview">
          <ChordSheet song={parsed} activeIndex={previewLine} fontSize={16} onLineClick={setPreviewLine} />
          {song && song.images.length > 0 && (
            <div className="editor__images">
              {song.images.map((img) => (
                <figure key={img.id}>
                  <img src={img.url} alt="原谱" />
                  <button
                    className="btn btn--danger btn--small"
                    onClick={() =>
                      api.deleteImage(song.id, img.id).then(() => api.getSong(song.id)).then(setSong)
                    }
                  >
                    删除图片
                  </button>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
