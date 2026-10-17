export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
};

const WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Minimal structured logger: one JSON object per line.
 *
 * The base logger is created once per process; `child()` adds request fields.
 * Swap this for pino/winston without touching call sites.
 */
export function createLogger(
  level: LogLevel = "info",
  base: LogFields = {},
  sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger {
  const write = (entryLevel: LogLevel, message: string, fields?: LogFields) => {
    if (WEIGHT[entryLevel] < WEIGHT[level]) return;

    sink(
      JSON.stringify({
        time: new Date().toISOString(),
        level: entryLevel,
        msg: message,
        ...base,
        ...fields,
      }),
    );
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (fields) => createLogger(level, { ...base, ...fields }, sink),
  };
}

/** Silent logger for unit tests. */
export function createNoopLogger(): Logger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => createNoopLogger(),
  };
}
