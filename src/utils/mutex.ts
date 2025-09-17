import { logger } from "./logger";

export class Mutex {
    private isLocked = false;
    private queue: Array<{
        resolve: () => void;
        id: string;
    }> = [];
    private lockCounter = 0;

    constructor(private name: string = 'mutex') {}

    async acquire(): Promise<void> {
        return new Promise<void>((resolve) => {
            const lockId = `lock-${++this.lockCounter}`;

            if (!this.isLocked) {
                this.isLocked = true;
                logger.debug(`Mutex '${this.name}': Acquired ${lockId} immediately`);
                resolve();
            } else {
                logger.debug(`Mutex '${this.name}': Queueing ${lockId} (queue length: ${this.queue.length + 1})`);
                this.queue.push({
                    resolve,
                    id: lockId
                });
            }
        });
    }

    release(): void {
        if (!this.isLocked) {
            throw new Error(`Mutex '${this.name}': Attempted to be release unlocked mutex`);
        }

        if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            logger.debug(`Mutex '${this.name}': Passing lock to ${next.id} (queue remaining: ${this.queue.length})`);
            next.resolve();
        } else {
            this.isLocked = false;
            logger.debug(`Mutex: '${this.name}': Released without waiters`);
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