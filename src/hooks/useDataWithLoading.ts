import { useState, useEffect } from 'react';

interface UseDataWithLoadingOptions<T> {
  fetchData: () => Promise<T>;
  initialData?: T;
  dependencies?: any[];
}

interface UseDataWithLoadingReturn<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

export function useDataWithLoading<T>({
  fetchData,
  initialData,
  dependencies = []
}: UseDataWithLoadingOptions<T>): UseDataWithLoadingReturn<T> {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = () => {
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchData();
        if (mounted) {
          setData(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load data'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [...dependencies, retryCount]);

  return { data, loading, error, retry };
}
