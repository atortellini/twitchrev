import { StreamStatus, Streamer } from '../models';

export interface IStreamersLiveStatusProvider {
    onStreamerWentLive(callback: (streamer: StreamStatus) => void): void;
    onStreamerWentOffline(callback: (streamer: StreamStatus) => void): void;
    onStreamerAdded(callback: (streamer: Streamer) => void): void;
    onStreamerRemoved(callback: (streamer: Streamer) => void): void;
}