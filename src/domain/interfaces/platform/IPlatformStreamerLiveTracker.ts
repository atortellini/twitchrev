import {Platform, PlatformLiveStream, PlatformUser} from '../../models';

export interface IPlatformStreamerLiveTracker<P extends Platform> {
  readonly platform: P;

  startTracking(streamer: PlatformUser<P>): Promise<void>;
  stopTracking(streamer: PlatformUser<P>): Promise<void>;

  getTrackedStreamers(): Promise<PlatformUser<P>[]>;
  isTracking(streamer: PlatformUser<P>): Promise<boolean>;

  onLive(callback: (status: PlatformLiveStream<P>) => void): void;
  onOffline(callback: (status: PlatformUser<P>) => void): void;

  onStartTracking(callback: (streamer: PlatformUser<P>) => void): void;
  onStopTracking(callback: (streamer: PlatformUser<P>) => void): void;
}
