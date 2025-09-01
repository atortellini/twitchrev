import { Platform } from './Platform';

export interface Streamer {
    name: string;
    platform: Platform;
    id: string;
}

export class StreamerEntity implements Streamer {
    constructor(
        public readonly name: string,
        public readonly platform: Platform,
        public readonly id: string
    ) {
        if (!name || !platform || !id) {
            throw new Error('All streamer fields are required');
        }
    }

    equals(other: Streamer): boolean {
        return this.name === other.name && this.platform === other.platform;
    }

    getKey(): string {
        return `${this.name}-${this.platform}`;
    }

    toString(): string {
        return `${this.name} (${this.platform})`;
    }
}
