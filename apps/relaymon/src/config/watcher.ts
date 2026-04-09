import { loadConfig } from "./config.ts";
import type { Config } from "../types/config.ts";
import { getLogger } from "../utils/logger.ts";

const logger = getLogger("ConfigWatcher");

export interface ConfigWatcherOptions {
  configPath: string;
  onReload: (config: Config) => void;
  onError?: (error: Error) => void;
  debounceMs?: number; // Default 500ms
}

/**
 * Start a config file watcher that hot-reloads the config when the file changes.
 *
 * Watches for both "modify" and "create" events because atomic rename
 * (tmp + rename) generates a create event, not modify, on some Linux kernels
 * (inotify behavior — the UI server uses this write pattern).
 *
 * @param options - Watcher configuration options
 * @returns A stop function that closes the watcher when called
 */
export function startConfigWatcher(options: ConfigWatcherOptions): () => void {
  const { configPath, onReload, onError, debounceMs = 500 } = options;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let watcher: Deno.FsWatcher | null = null;

  async function watchLoop(): Promise<void> {
    try {
      watcher = Deno.watchFs(configPath);

      for await (const event of watcher) {
        if (stopped) break;

        if (event.kind === "modify" || event.kind === "create") {
          // Debounce: cancel any pending reload and restart the timer
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(async () => {
            debounceTimer = null;
            if (stopped) return;

            logger.info("Config file changed, reloading...");

            try {
              const newConfig = await loadConfig(configPath);
              logger.info("Config reloaded successfully");
              onReload(newConfig);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              logger.warn(`Config reload failed: ${error.message} — keeping current config`);
              if (onError) {
                onError(error);
              }
            }
          }, debounceMs);
        }
      }
    } catch (err) {
      if (!stopped) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.warn(`Config watcher error: ${error.message}`);
        if (onError) {
          onError(error);
        }
      }
    }
  }

  // Start the watch loop (fire-and-forget — errors are caught inside)
  watchLoop();

  // Return stop function
  return function stopWatcher(): void {
    stopped = true;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (watcher !== null) {
      try {
        watcher.close();
      } catch {
        // Ignore errors on close — watcher may already be closed
      }
      watcher = null;
    }
  };
}
