import { LOG_LEVELS } from "../config/constants";

class Logger {
    private level: LOG_LEVELS;

    constructor(level: LOG_LEVELS = LOG_LEVELS.INFO) {
        this.level = level;
    }

    setLevel(level: LOG_LEVELS): void {
        this.level = level;
    }

    error(message: string, ...args: any[]): void {
        if (this.shouldLog(LOG_LEVELS.ERROR)) {
            console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.shouldLog(LOG_LEVELS.WARN)) {
            console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.shouldLog(LOG_LEVELS.INFO)) {
            console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LOG_LEVELS.DEBUG)) {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }

    private shouldLog(level: LOG_LEVELS): boolean {
        return level <= this.level
    }
}

export const logger = new Logger(
   (Number(process.env.LOG_LEVEL) ?? LOG_LEVELS.INFO));