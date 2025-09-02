import { Platform, Streamer, StreamStatus } from '../models';

export interface IPlatformStreamerLiveTracker {
    readonly platform: Platform;
    
    addStreamer(streamer: Streamer): Promise<void>;
    removeStreamer(streamer: Streamer): Promise<boolean>;
    getTrackedStreamers(streamer: Streamer): Promise<Streamer[]>;
    isTracking(streamer: Streamer): Promise<boolean>;

    onLive(callback: (status: StreamStatus) => void): void;
    onOffline(callback: (status: StreamStatus) => void): void;

    start(): Promise<void>;
    stop(): Promise<void>;
}
