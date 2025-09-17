import {Platform, PlatformSubEvent, PlatformUser} from '../../models';


export interface IPlatformSubEventTracker<P extends Platform> {
  readonly platform: P;

  startTracking(streamer: PlatformUser<P>): Promise<void>;
  stopTracking(streamer: PlatformUser<P>): Promise<void>;

  getTrackedStreamers(): Promise<PlatformUser<P>[]>;
  isTracking(streamer: PlatformUser<P>): Promise<boolean>;

  onSubEvent(callback: (event: PlatformSubEvent<P>) => void): void;
  onStartTracking(callback: (streamer: PlatformUser<P>) => void): void;
  onStopTracking(callback: (streamer: PlatformUser<P>) => void): void;
}
