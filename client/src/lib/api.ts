import type { SongDetail, SongImage, SongSummary } from '@shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export interface SongPayload {
  title: string;
  artist: string;
  key: string;
  capo: number;
  chordpro: string;
}

export const api = {
  me: () => request<{ admin: boolean }>('/api/me'),
  login: (password: string) => request<{ admin: boolean }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ admin: boolean }>('/api/logout', { method: 'POST' }),

  listSongs: () => request<SongSummary[]>('/api/songs'),
  getSong: (id: number) => request<SongDetail>(`/api/songs/${id}`),
  createSong: (p: SongPayload) => request<SongDetail>('/api/songs', { method: 'POST', body: JSON.stringify(p) }),
  updateSong: (id: number, p: SongPayload) => request<SongDetail>(`/api/songs/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteSong: (id: number) => request<{ ok: true }>(`/api/songs/${id}`, { method: 'DELETE' }),

  async uploadImage(songId: number, file: File): Promise<SongImage> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/songs/${songId}/images`, { method: 'POST', body: form, credentials: 'same-origin' });
    if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `${res.status}`);
    return (await res.json()) as SongImage;
  },
  deleteImage: (songId: number, imageId: number) =>
    request<{ ok: true }>(`/api/songs/${songId}/images/${imageId}`, { method: 'DELETE' }),
};
