import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_ROOM_STATE, type ClientRole, type RoomState, type ServerMessage } from '@shared/types';

export interface RoomConnection {
  state: RoomState;
  connected: boolean;
  controllers: number;
  displays: number;
  /** 歌曲被后台修改时递增，用于触发重新拉取 */
  songVersion: number;
  send: (patch: Partial<RoomState>) => void;
}

/**
 * 连接到某个歌曲的演出房间。
 * 控制端调用 send 修改状态，大屏端只读；断线自动重连，重连后服务器会推送最新状态。
 * code 为 null 时不连接（例如手机还没选歌）。
 */
export function useRoom(code: string | null, role: ClientRole): RoomConnection {
  const [state, setState] = useState<RoomState>(DEFAULT_ROOM_STATE);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState({ controllers: 0, displays: 0 });
  const [songVersion, setSongVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Partial<RoomState> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!code) {
      setConnected(false);
      return;
    }
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/rooms/${encodeURIComponent(code)}?role=${role}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        if (role === 'controller') {
          // 控制端是唯一写入方：连接/重连后把本地完整状态重新广播，
          // 避免服务器上残留的旧状态把手机覆盖掉
          pendingRef.current = null;
          ws.send(JSON.stringify({ type: 'state', state: stateRef.current }));
        } else if (pendingRef.current) {
          ws.send(JSON.stringify({ type: 'state', state: pendingRef.current }));
          pendingRef.current = null;
        }
        heartbeat = setInterval(() => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ type: 'ping' })), 25000);
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data as string) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === 'state') setState(msg.state);
        else if (msg.type === 'presence') setPresence({ controllers: msg.controllers, displays: msg.displays });
        else if (msg.type === 'song_updated') setSongVersion((v) => v + 1);
      };
      ws.onclose = () => {
        setConnected(false);
        if (heartbeat) clearInterval(heartbeat);
        if (closed) return;
        retry += 1;
        timer = setTimeout(connect, Math.min(10000, 500 * 2 ** Math.min(retry, 5)));
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      wsRef.current?.close();
    };
  }, [code, role]);

  const send = useCallback((patch: Partial<RoomState>) => {
    // 本地先更新，界面不等服务器回包
    setState((s) => ({ ...s, ...patch, updatedAt: Date.now() }));
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'state', state: patch }));
    } else {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
    }
  }, []);

  return { state, connected, controllers: presence.controllers, displays: presence.displays, songVersion, send };
}
