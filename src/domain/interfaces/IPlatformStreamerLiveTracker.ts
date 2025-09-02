import { Platform, Streamer, StreamStatus } from '../models';

export interface IPlatformStreamerLiveTracker {
    readonly platform: Platform;
    
    addStreamer(name: string): Promise<void>;
    removeStreamer(name: string): Promise<boolean>;
    getTrackedStreamers(): Promise<string[]>;
    isTracking(streamer: string): Promise<boolean>;

    onLive(callback: (status: StreamStatus) => void): void;
    onOffline(callback: (status: StreamStatus) => void): void;

    start(): Promise<void>;
    stop(): Promise<void>;
}
