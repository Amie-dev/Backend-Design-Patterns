export type LogFields = Record<string, unknown>;
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

/** Minimal structured logger: one JSON object per line. */
export function createLogger(level: LogLevel, base: LogFields = {}): Logger {
  const write = (
    entryLevel: LogLevel,
    message: string,
    fields: LogFields = {},
  ): void => {
    if (LEVEL_WEIGHT[entryLevel] < LEVEL_WEIGHT[level]) return;

    const line = JSON.stringify({
      time: new Date().toISOString(),
      level: entryLevel,
      message,
      ...base,
      ...fields,
    });

    if (entryLevel === "error") console.error(line);
    else console.log(line);
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  };
}

export function createNoopLogger(): Logger {
  const noop = (): void => undefined;
  return { debug: noop, info: noop, warn: noop, error: noop };
}
