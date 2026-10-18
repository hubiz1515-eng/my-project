import { writeSave } from './saveStore';

/** 게임(WebView/iframe) → 앱으로 오는 메시지 */
export type GameMessage = { type: 'save'; data: string } | { type: 'exit' };

export function parseGameMessage(raw: unknown): GameMessage | null {
  if (typeof raw !== 'string') return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as { type?: unknown; data?: unknown };
  if (m.type === 'save' && typeof m.data === 'string') return { type: 'save', data: m.data };
  if (m.type === 'exit') return { type: 'exit' };
  return null;
}

export function handleGameMessage(raw: unknown, onExit?: () => void): void {
  const msg = parseGameMessage(raw);
  if (!msg) return;
  if (msg.type === 'save') void writeSave(msg.data);
  else onExit?.();
}
