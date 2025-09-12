import {Platform, PlatformSubEvent, PlatformUser, TwitchUser, User} from '../../models';

export interface IStreamersSubEventProvider<TPlatforms extends Platform> {
  onSubEvent(callback: (event: PlatformSubEvent<TPlatforms>) => void): void;
  onStartTracking(callback: (streamer: PlatformUser<TPlatforms>) => void): void;
  onStopTracking(callback: (streamer: PlatformUser<TPlatforms>) => void): void;
}