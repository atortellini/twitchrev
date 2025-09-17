import {logger} from './logger';

export class Mutex {
  private isLocked = false;
  private queue: Array<{resolve: () => void; id: string;}> = [];
  private lockCounter = 0;
  private logger_tag;

  constructor(name: string = 'mutex') {
    this.logger_tag = `[MUTEX-${name}]`;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      const lockId = `lock-${++this.lockCounter}`;

      if (!this.isLocked) {
        this.isLocked = true;
        logger.debug(`${this.logger_tag} Acquired ${lockId} immediately`);
        resolve();
      } else {
        logger.debug(`${this.logger_tag} Queueing ${lockId} (queue length: ${
            this.queue.length + 1})`);
        this.queue.push({resolve, id: lockId});
      }
    });
  }

  release(): void {
    if (!this.isLocked) {
      throw new Error(
          `${this.logger_tag} Attempted to be release unlocked mutex`);
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      logger.debug(`${this.logger_tag} Passing lock to ${
          next.id} (queue remaining: ${this.queue.length})`);
      next.resolve();
    } else {
      this.isLocked = false;
      logger.debug(`${this.logger_tag} Released without waiters`);
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}