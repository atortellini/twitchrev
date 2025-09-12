import {Platform, PlatformUser} from '../../models';

export interface IStreamersLiveStatusManager<TPlatforms extends Platform> {
  startTracking(streamer: PlatformUser<TPlatforms>): Promise<void>;
  stopTracking(streamer: PlatformUser<TPlatforms>): Promise<void>;
  getTrackedStreamers(): Promise<PlatformUser<TPlatforms>[]>;
  getStreamersByPlatform(platform: TPlatforms):
      Promise<PlatformUser<TPlatforms>[]>;
  isStreamerTracked(streamer: PlatformUser<TPlatforms>): Promise<boolean>;
}