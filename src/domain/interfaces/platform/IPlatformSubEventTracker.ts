import {Platform, SubEvent, User} from '../../models';

export interface IPlatformSubEventTracker {
  readonly platform: Platform;

  startTracking(streamer: User): Promise<void>;
  stopTracking(streamer: User): Promise<boolean>;

  getTrackedStreamers(): Promise<User[]>;
  isTracking(streamer: User): Promise<boolean>;

  onSubEvent(callback: (event: SubEvent) => void): void;
  onStartTracking(callback: (streamer: User) => void): void;
  onStopTracking(callback: (streamer: User) => void): void;
}
