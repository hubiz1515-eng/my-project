import { useEffect, useState } from 'react';

/** intervalMs 마다 갱신되는 현재 시각(ms). 남은 시간 표시를 갱신하는 용도. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
