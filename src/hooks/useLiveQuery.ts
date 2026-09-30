import { useEffect, useState, type DependencyList } from 'react';
import type { Unsubscribe } from '../services/mockDb';

/** 구독 함수를 React 상태로. 첫 스냅샷 전까지 loading=true */
export function useLiveQuery<T>(
  subscribe: (onChange: (value: T) => void) => Unsubscribe,
  deps: DependencyList,
  initial: T,
): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return subscribe((value) => {
      setData(value);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}
