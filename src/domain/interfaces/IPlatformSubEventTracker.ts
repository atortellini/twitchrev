import { SubEvent, Streamer, Platform } from '../models';

export interface IPlatformSubEventTracker {
    readonly platform: Platform;

    addStreamer(streamer: Streamer): Promise<void>;
    removeStreamer(streamer: Streamer): Promise<boolean>;
    getTrackedStreamers(): Promise<Streamer[]>;

    onSubEvent(callback: (event: SubEvent) => void): void;

    start(): Promise<void>;
    stop(): Promise<void>;

}

/**
 * TOOD:
 * Not sure if to have start/stop tracking overloaded to allow names/ids/ as well as streamer objs
 */