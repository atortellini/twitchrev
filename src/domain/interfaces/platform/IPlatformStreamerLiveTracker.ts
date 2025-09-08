import {LiveStream, Platform, Streamer} from '../../models';

export interface IPlatformStreamerLiveTracker {
  readonly platform: Platform;

  startTracking(streamer: Streamer): Promise<void>;
  stopTracking(streamer: Streamer): Promise<void>;

  getTrackedStreamers(): Promise<Streamer[]>;
  isTracking(streamer: Streamer): Promise<boolean>;

  onLive(callback: (status: LiveStream) => void): void;
  onOffline(callback: (status: Streamer) => void): void;

  onStartTracking(callback: (streamer: Streamer) => void): void;
  onStopTracking(callback: (streamer: Streamer) => void): void;
}
