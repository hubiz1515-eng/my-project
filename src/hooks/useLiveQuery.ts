import { useEffect, useState, type DependencyList } from 'react';
import type { ErrorHandler, Unsubscribe } from '../services/types';
import { toUserMessage } from '../services/types';

/**
 * 구독 함수를 React 상태로. 첫 스냅샷 전까지 loading=true.
 * subscribe 가 null 이면 구독하지 않는다 (의존 값이 아직 없을 때).
 */
export function useLiveQuery<T>(
  subscribe: ((onChange: (value: T) => void, onError: ErrorHandler) => Unsubscribe) | null,
  deps: DependencyList,
  initial: T,
): { data: T; loading: boolean; error: string | null } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subscribe) return;
    setLoading(true);
    setError(null);
    return subscribe(
      (value) => {
        setData(value);
        setLoading(false);
      },
      (e) => {
        if (__DEV__) console.warn('[useLiveQuery]', e);
        setError(toUserMessage(e));
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
