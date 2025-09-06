import {Platform, Streamer, StreamStatus} from '../../models';

export interface IPlatformStreamerLiveTracker {
  readonly platform: Platform;

  addStreamer(name: string): Promise<void>;
  removeStreamer(name: string): Promise<boolean>;

  getTrackedStreamers(): Promise<Streamer[]>;
  isTracking(streamer: string): Promise<boolean>;

  onLive(callback: (status: StreamStatus) => void): void;
  onOffline(callback: (status: StreamStatus) => void): void;

  onAdded(callback: (streamer: Streamer) => void): void;
  onRemoved(callback: (streamer: Streamer) => void): void;

  start(): Promise<void>;
  stop(): Promise<void>;
}
