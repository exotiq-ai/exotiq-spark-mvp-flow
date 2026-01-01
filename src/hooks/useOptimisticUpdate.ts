import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * useOptimisticUpdate - Hook for optimistic UI updates
 * 
 * Updates UI immediately, then syncs with server
 * Rolls back on error
 * 
 * @example
 * const { data, updateOptimistically, isLoading } = useOptimisticUpdate(initialData);
 * 
 * const handleUpdate = () => {
 *   updateOptimistically(
 *     newData,
 *     () => api.update(newData),
 *     'Update successful',
 *     'Update failed'
 *   );
 * };
 */

interface UseOptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useOptimisticUpdate<T>(
  initialData: T,
  options?: UseOptimisticUpdateOptions<T>
) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateOptimistically = useCallback(
    async (
      newData: T,
      serverUpdate: () => Promise<any>,
      successMessage?: string,
      errorMessage?: string
    ) => {
      // Store original data for rollback
      const originalData = data;
      
      // Update UI immediately (optimistic)
      setData(newData);
      setIsLoading(true);
      setError(null);

      try {
        // Sync with server
        await serverUpdate();
        
        // Success - keep the optimistic update
        setIsLoading(false);
        
        if (successMessage) {
          toast.success(successMessage);
        }
        
        options?.onSuccess?.(newData);
      } catch (err: any) {
        // Error - rollback to original data
        console.error('Optimistic update failed:', err);
        setData(originalData);
        setError(err);
        setIsLoading(false);
        
        if (errorMessage) {
          toast.error(errorMessage);
        }
        
        options?.onError?.(err);
      }
    },
    [data, options]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsLoading(false);
  }, [initialData]);

  return {
    data,
    setData,
    isLoading,
    error,
    updateOptimistically,
    reset,
  };
}

/**
 * useOptimisticList - Hook for optimistic list updates
 * Handles adding, updating, and removing items from a list
 * 
 * @example
 * const { items, addItem, updateItem, removeItem } = useOptimisticList(initialItems);
 */

interface UseOptimisticListOptions<T> {
  idKey?: keyof T;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useOptimisticList<T extends Record<string, any>>(
  initialItems: T[],
  options: UseOptimisticListOptions<T> = {}
) {
  const { idKey = 'id' as keyof T, onSuccess, onError } = options;
  const [items, setItems] = useState<T[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);

  const addItem = useCallback(
    async (
      newItem: T,
      serverAdd: () => Promise<any>,
      successMessage?: string
    ) => {
      // Add to list immediately (optimistic)
      setItems(prev => [...prev, newItem]);
      setIsLoading(true);

      try {
        await serverAdd();
        setIsLoading(false);
        
        if (successMessage) {
          toast.success(successMessage);
        }
        
        onSuccess?.();
      } catch (err: any) {
        // Remove item on error
        setItems(prev => prev.filter(item => item[idKey] !== newItem[idKey]));
        setIsLoading(false);
        toast.error('Failed to add item');
        onError?.(err);
      }
    },
    [idKey, onSuccess, onError]
  );

  const updateItem = useCallback(
    async (
      updatedItem: T,
      serverUpdate: () => Promise<any>,
      successMessage?: string
    ) => {
      const originalItems = items;
      
      // Update item immediately (optimistic)
      setItems(prev =>
        prev.map(item =>
          item[idKey] === updatedItem[idKey] ? updatedItem : item
        )
      );
      setIsLoading(true);

      try {
        await serverUpdate();
        setIsLoading(false);
        
        if (successMessage) {
          toast.success(successMessage);
        }
        
        onSuccess?.();
      } catch (err: any) {
        // Rollback on error
        setItems(originalItems);
        setIsLoading(false);
        toast.error('Failed to update item');
        onError?.(err);
      }
    },
    [items, idKey, onSuccess, onError]
  );

  const removeItem = useCallback(
    async (
      itemId: T[keyof T],
      serverRemove: () => Promise<any>,
      successMessage?: string
    ) => {
      const originalItems = items;
      const removedItem = items.find(item => item[idKey] === itemId);
      
      if (!removedItem) return;
      
      // Remove item immediately (optimistic)
      setItems(prev => prev.filter(item => item[idKey] !== itemId));
      setIsLoading(true);

      try {
        await serverRemove();
        setIsLoading(false);
        
        if (successMessage) {
          toast.success(successMessage);
        }
        
        onSuccess?.();
      } catch (err: any) {
        // Restore item on error
        setItems(originalItems);
        setIsLoading(false);
        toast.error('Failed to remove item');
        onError?.(err);
      }
    },
    [items, idKey, onSuccess, onError]
  );

  return {
    items,
    setItems,
    isLoading,
    addItem,
    updateItem,
    removeItem,
  };
}
