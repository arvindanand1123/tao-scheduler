enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

class Logger {
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  private static formatMessage(level: LogLevel, message: string): string {
    const timestamp = Logger.getTimestamp();
    const levelColor = Logger.getLevelColor(level);
    const resetColor = "\x1b[0m";

    return `${timestamp} [${levelColor}${level}${resetColor}]: ${message}`;
  }

  private static getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.INFO:
        return "\x1b[32m"; // Green
      case LogLevel.WARN:
        return "\x1b[33m"; // Yellow
      case LogLevel.ERROR:
        return "\x1b[31m"; // Red
      case LogLevel.DEBUG:
        return "\x1b[34m"; // Blue
      default:
        return "";
    }
  }

  static info(message: string): void {
    console.log(Logger.formatMessage(LogLevel.INFO, message));
  }

  static warn(message: string): void {
    console.warn(Logger.formatMessage(LogLevel.WARN, message));
  }

  static error(message: string): void {
    console.error(Logger.formatMessage(LogLevel.ERROR, message));
  }

  static debug(message: string): void {
    console.debug(Logger.formatMessage(LogLevel.DEBUG, message));
  }
}

export default Logger;
