/**
 * Idle Guard - requestIdleCallback wrapper for non-blocking sub-agent execution.
 *
 * SUBG-03: Long-running sub-agents use requestIdleCallback to avoid blocking UI.
 *
 * requestIdleCallback is a browser API that schedules work during idle periods.
 * Falls back to setTimeout if requestIdleCallback is not available (e.g., Node.js).
 */

export interface IdleGuardOptions {
  /** Maximum time to wait in milliseconds (requestIdleCallback timeout) */
  timeout?: number;
}

/**
 * Schedule a callback to run during idle time.
 *
 * @param callback - Function to call when idle
 * @param options - Optional configuration
 * @returns Cancel function to cancel the scheduled callback
 */
export function scheduleIdleCallback(
  callback: () => void,
  options?: IdleGuardOptions
): () => void {
  // Check if requestIdleCallback is available
  if (typeof requestIdleCallback !== 'undefined') {
    let handle: number;

    if (options?.timeout) {
      handle = requestIdleCallback(callback, { timeout: options.timeout });
    } else {
      handle = requestIdleCallback(callback);
    }

    // Return cancel function
    return () => cancelIdleCallback(handle);
  }

  // Fallback to setTimeout
  let handle: ReturnType<typeof setTimeout>;

  if (options?.timeout) {
    handle = setTimeout(callback, options.timeout);
  } else {
    handle = setTimeout(callback, 0);
  }

  // Return cancel function
  return () => clearTimeout(handle);
}

/**
 * Wrap an async function to run during idle time.
 *
 * @param fn - Async function to wrap
 * @param options - Optional configuration
 * @returns Promise that resolves with the function result
 */
export function runWhenIdle<T>(
  fn: () => Promise<T>,
  options?: IdleGuardOptions
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = scheduleIdleCallback(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, options);

    // Safety timeout - if idle callback doesn't fire within timeout, run anyway
    if (options?.timeout) {
      const safetyTimeout = setTimeout(() => {
        cancel();
        fn().then(resolve).catch(reject);
      }, (options.timeout * 2) + 100);

      // Clear safety timeout when done
      scheduleIdleCallback(() => clearTimeout(safetyTimeout));
    }
  });
}

/**
 * Process an array of items with idle breaks between each item.
 * Yields to the browser main thread between processing items.
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item (returns Promise)
 * @param options - Optional configuration
 * @returns Promise that resolves with array of results
 */
export async function processWithIdleBreaks<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options?: IdleGuardOptions
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Process the item
    const result = await processor(item, i);
    results.push(result);

    // Yield to idle if there are more items
    if (i < items.length - 1) {
      await new Promise<void>((resolve) => {
        const cancel = scheduleIdleCallback(() => resolve(), options);

        // Safety fallback - resolve after timeout if idle callback doesn't fire
        if (options?.timeout) {
          setTimeout(() => {
            cancel();
            resolve();
          }, options.timeout + 50);
        }
      });
    }
  }

  return results;
}
