import {Platform, User} from '../../models';

export interface IStreamersLiveStatusManager {
  startTracking(streamer: User): Promise<void>;
  stopTracking(streamer: User): Promise<void>;
  getTrackedStreamers(): Promise<User[]>;
  getStreamersByPlatform(platform: Platform): Promise<User[]>;
  isStreamerTracked(streamer: User): Promise<boolean>;
}