import {Platform, Streamer} from '../models';

export interface IStreamersLiveStatusManager {
  addStreamer(name: Streamer, platform: Platform): Promise<void>;
  removeStreamer(name: Streamer, platform: Platform): Promise<boolean>;
  getTrackedStreamers(): Promise<Streamer[]>;
  getStreamersByPlatform(platform: Platform): Promise<Streamer[]>;
  isStreamerTracked(name: Streamer, platform: Platform): Promise<boolean>;
  /**
   * TODO:
   *  Not sure about this interface and also whether I should have the interface
   * require Streamer objs to interact with them. Downsides are that those
   * interacting with the interfaces have to have access to the platform
   * specific api
   */
}