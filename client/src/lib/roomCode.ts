import { useSearchParams } from 'react-router-dom';
import { useLocalStorage } from './hooks';
import { useEffect } from 'react';

/** 房间码：优先 URL ?room=，其次 localStorage，默认 stage */
export function useRoomCode(): string {
  const [params] = useSearchParams();
  const [saved, setSaved] = useLocalStorage('roomCode', 'stage');
  const fromUrl = params.get('room');
  // 持久化放进 effect，避免 render 期间写 localStorage
  useEffect(() => {
    if (fromUrl && fromUrl !== saved) setSaved(fromUrl);
  }, [fromUrl, saved, setSaved]);
  return fromUrl ?? saved;
}
