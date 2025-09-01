import { logger } from "./logger";

export class Strand {
    private queue: Array<{
        id: string;
        operation: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
        timestamp: number;
    }> = [];

    private isProcessing = false;
    private operationCounter = 0;
    private completedOperations = 0;

    async post<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const id = `op-${++this.operationCounter}`;
            
            this.queue.push({
                id,
                operation,
                resolve,
                reject,
                timestamp: Date.now()
            });

            logger.debug(`Enqueued operation ${id} (queue lenght: ${this.queue.length})`);

            this.runStrand();
        })
    }

    private async runStrand(): Promise<void> {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                if (!item) continue;

                try {
                    const startTime = Date.now();
                    logger.debug (`Executing operation: ${item.id}`);

                    const result = await item.operation();

                    const durationTime = Date.now() - startTime;
                    logger.debug(`Completed operation: ${item.id} in ${durationTime}ms`);

                    this.completedOperations++;
                    item.resolve(result);

                } catch (error) {
                    logger.error(`Operation ${item.id} failed`, error);
                    item.reject(error);
                }
            }
        } finally {
            this.isProcessing = false;
        }

    }


    getMetrics() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            totalOperations: this.operationCounter,
            completedOperations: this.completedOperations,
            pendingOperations: this.operationCounter - this.completedOperations
        };
    }

    clear(): void {
        this.queue.forEach(item => {
            item.reject(new Error('Strand was emptied'));
        });
        this.queue.length = 0;
    }
}