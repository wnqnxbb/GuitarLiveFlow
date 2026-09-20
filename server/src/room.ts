import type { WebSocket } from 'ws';
import { DEFAULT_ROOM_STATE, type ClientRole, type RoomState, type ServerMessage } from '../../shared/types.js';

/**
 * 演出房间：服务器内存里保存最新状态，控制端写入，大屏端只读。
 * 个人使用只需要一个房间，但按房间码分开存，方便以后扩展多个房间。
 */
class Room {
  state: RoomState = { ...DEFAULT_ROOM_STATE };
  clients = new Map<WebSocket, ClientRole>();

  join(ws: WebSocket, role: ClientRole) {
    this.clients.set(ws, role);
    this.send(ws, { type: 'state', state: this.state });
    this.broadcastPresence();
  }

  leave(ws: WebSocket) {
    this.clients.delete(ws);
    this.broadcastPresence();
  }

  update(patch: Partial<RoomState>) {
    const next: RoomState = { ...this.state, ...sanitize(patch), updatedAt: Date.now() };
    // 切歌时行号归零，除非补丁里显式给了行号
    if (patch.songId !== undefined && patch.songId !== this.state.songId && patch.lineIndex === undefined) {
      next.lineIndex = 0;
    }
    this.state = next;
    this.broadcast({ type: 'state', state: this.state });
  }

  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.clients.keys()) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private broadcastPresence() {
    let controllers = 0;
    let displays = 0;
    for (const role of this.clients.values()) role === 'controller' ? controllers++ : displays++;
    this.broadcast({ type: 'presence', controllers, displays });
  }
}

function sanitize(patch: Partial<RoomState>): Partial<RoomState> {
  const out: Partial<RoomState> = {};
  if (patch.songId === null || (typeof patch.songId === 'number' && Number.isInteger(patch.songId))) out.songId = patch.songId;
  if (typeof patch.lineIndex === 'number' && Number.isFinite(patch.lineIndex)) out.lineIndex = Math.max(0, Math.floor(patch.lineIndex));
  if (patch.mode === 'manual' || patch.mode === 'auto') out.mode = patch.mode;
  if (typeof patch.secondsPerLine === 'number' && patch.secondsPerLine > 0) out.secondsPerLine = Math.min(60, patch.secondsPerLine);
  if (typeof patch.transpose === 'number' && Number.isInteger(patch.transpose)) out.transpose = Math.max(-11, Math.min(11, patch.transpose));
  return out;
}

const rooms = new Map<string, Room>();

export function getRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = new Room();
    rooms.set(code, room);
  }
  return room;
}

export function broadcastAll(msg: ServerMessage) {
  for (const room of rooms.values()) room.broadcast(msg);
}
