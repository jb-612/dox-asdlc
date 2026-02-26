// ---------------------------------------------------------------------------
// Container pool shutdown hook registration (P15-F05, T23)
//
// Wires pool.teardown() to:
//   - app.on('before-quit')
//   - process.on('SIGTERM')
//   - process.on('SIGINT')
//
// Teardown is idempotent -- only runs once regardless of how many signals
// or events fire.
// ---------------------------------------------------------------------------

/**
 * Minimal interface for the shutdown target (Electron app or test double).
 * Only requires an `on` method for the 'before-quit' event.
 */
export interface ShutdownTarget {
  on(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Register shutdown hooks that call `teardownFn` when the app is about to
 * quit or the process receives SIGTERM/SIGINT.
 *
 * @param teardownFn  Async function that cleans up containers (pool.teardown)
 * @param target      Object with an `on` method (Electron app or test stub)
 */
export function registerShutdownHooks(
  teardownFn: () => Promise<void>,
  target: ShutdownTarget,
): void {
  let tornDown = false;

  const doTeardown = async (): Promise<void> => {
    if (tornDown) return;
    tornDown = true;
    try {
      await teardownFn();
    } catch {
      // Best effort -- do not let teardown errors prevent shutdown
    }
  };

  target.on('before-quit', doTeardown);

  process.on('SIGTERM', doTeardown);
  process.on('SIGINT', doTeardown);
}
