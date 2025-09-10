import {Platform, SubEvent, User} from '../../models';

export interface IPlatformSubEventTracker<
    TUser extends User, TSubEvent extends SubEvent> {
  readonly platform: Platform;

  startTracking(streamer: TUser): Promise<void>;
  stopTracking(streamer: TUser): Promise<void>;

  getTrackedStreamers(): Promise<TUser[]>;
  isTracking(streamer: TUser): Promise<boolean>;

  onSubEvent(callback: (event: TSubEvent) => void): void;
  onStartTracking(callback: (streamer: TUser) => void): void;
  onStopTracking(callback: (streamer: TUser) => void): void;
}
