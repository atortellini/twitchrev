import { Streamer } from './Streamer';

export interface SubEvent {
    streamer: Streamer;
    subscriberName: string;
    tier: number;
    isGift: boolean;
    timestamp: Date;
    months?: number;
    message?: string;
}

export class SubEventEntity implements SubEvent {
    constructor(
        public readonly streamer: Streamer,
        public readonly subscriberName: string,
        public readonly tier: number,
        public readonly isGift: boolean,
        public readonly timestamp: Date = new Date(),
        public readonly months?: number,
        public readonly message?: string
    ) {}
}