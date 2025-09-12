import {Platform, PlatformUser} from '../../models';


export interface IStreamersSubEventManager<TPlatforms extends Platform> {
  startTracking(streamer: PlatformUser<TPlatforms>): Promise<void>;
  stopTracking(streamer: PlatformUser<TPlatforms>): Promise<void>;
}