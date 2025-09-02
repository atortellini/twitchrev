import { Streamer, Platform } from '../models';

export interface IStreamersLiveStatusManager {
    addStreamer(name: string, platform: Platform): Promise<void>;
    removeStreamer(name: string, platform: Platform): Promise<boolean>;
    getTrackedStreamers(): Promise<Streamer[]>;
    getStreamersByPlatform(platform: Platform): Promise<Streamer[]>;
    isStreamerTracked(name: string, platform: Platform): Promise<boolean>;
}