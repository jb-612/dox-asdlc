// ---------------------------------------------------------------------------
// usePoolStatus hook (P15-F05, T16)
//
// Custom React hook that subscribes to the CONTAINER_POOL_STATUS IPC channel
// and exposes the current ContainerRecord[] to renderer components.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import type { ContainerRecord } from '../../shared/types/execution';

/**
 * Subscribe to container pool status updates from the main process.
 *
 * Returns the latest snapshot of all container records. The array is
 * replaced entirely on each IPC push (not merged).
 *
 * The listener is cleaned up on unmount.
 */
export function usePoolStatus(): ContainerRecord[] {
  const [containers, setContainers] = useState<ContainerRecord[]>([]);

  useEffect(() => {
    const channel = 'container:pool-status';

    const handler = (records: ContainerRecord[]) => {
      setContainers(records);
    };

    // Subscribe to IPC push events from main process
    window.electronAPI.onEvent(channel, handler as (...args: unknown[]) => void);

    return () => {
      window.electronAPI.removeListener(channel);
    };
  }, []);

  return containers;
}
