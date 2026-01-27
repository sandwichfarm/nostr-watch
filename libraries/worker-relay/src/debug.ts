import { getLogger, installConsoleLogLevelFilter, setGlobalLogLevel } from "@nostrwatch/utils";

const logger = getLogger("worker-relay");

export function debugLog(scope: string, msg: string, ...args: Array<any>) {
  logger.debug(`[${scope}] ${msg}`, ...args);
}

export function setLogging(v: boolean) {
  setGlobalLogLevel(v ? "debug" : "warn");
  installConsoleLogLevelFilter();
}
