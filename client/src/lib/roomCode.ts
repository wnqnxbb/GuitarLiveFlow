import { useSearchParams } from 'react-router-dom';
import { useLocalStorage } from './hooks';

/** 房间码：优先 URL ?room=，其次 localStorage，默认 stage */
export function useRoomCode(): string {
  const [params] = useSearchParams();
  const [saved, setSaved] = useLocalStorage('roomCode', 'stage');
  const fromUrl = params.get('room');
  if (fromUrl && fromUrl !== saved) {
    setSaved(fromUrl);
    return fromUrl;
  }
  return fromUrl ?? saved;
}
