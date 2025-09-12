import {Platform, PlatformLiveStream, PlatformUser} from '../../models';

export interface IStreamersLiveStatusProvider<TPlatforms extends Platform> {
  onStreamerWentLive(
      callback: (streamer: PlatformLiveStream<TPlatforms>) => void): void;
  onStreamerWentOffline(callback: (streamer: PlatformUser<TPlatforms>) => void):
      void;
  onStreamerStartTracking(
      callback: (streamer: PlatformUser<TPlatforms>) => void): void;
  onStreamerStopTracking(
      callback: (streamer: PlatformUser<TPlatforms>) => void): void;
}