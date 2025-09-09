import {LiveStream, Platform, User} from '../../models';

export interface IPlatformStreamerLiveTracker {
  readonly platform: Platform;

  startTracking(streamer: User): Promise<void>;
  stopTracking(streamer: User): Promise<void>;

  getTrackedStreamers(): Promise<User[]>;
  isTracking(streamer: User): Promise<boolean>;

  onLive(callback: (status: LiveStream) => void): void;
  onOffline(callback: (status: User) => void): void;

  onStartTracking(callback: (streamer: User) => void): void;
  onStopTracking(callback: (streamer: User) => void): void;
}
