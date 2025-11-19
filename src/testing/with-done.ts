export type DoneFn = (error?: unknown) => void;

/**
 * Wraps legacy Jasmine-style `done` callbacks so they work in Vitest.
 */
export function withDone(fn: (done: DoneFn) => void): () => Promise<void> {
  return async () =>
    new Promise<void>((resolve, reject) => {
      const done: DoneFn = (error) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        resolve();
      };

      try {
        fn(done);
      } catch (error) {
        done(error);
      }
    });
}
