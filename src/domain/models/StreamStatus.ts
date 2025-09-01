import { Streamer } from './Streamer';

export interface StreamStatus {
    streamer: Streamer;
    isLive: boolean;
    timestamp: Date;
    streamID?: string;
}

class StreamStatusEntity implements StreamStatus {
    constructor(
        public readonly streamer: Streamer,
        public readonly isLive: boolean,
        public readonly timestamp: Date = new Date(),
        public readonly streamID?: string
    ) {}
    
    static createLive(
        streamer: Streamer,
        streamID?: string
    ): StreamStatusEntity {
        return new StreamStatusEntity(streamer, true, new Date(), streamID);
    }

    static createOffline(streamer: Streamer): StreamStatusEntity {
        return new StreamStatusEntity(streamer, false, new Date());
    }
}
