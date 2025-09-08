import {Platform, Streamer} from '../../models';

export interface IStreamersLiveStatusManager {
  startTracking(streamer: Streamer): Promise<void>;
  stopTracking(streamer: Streamer): Promise<void>;
  getTrackedStreamers(): Promise<Streamer[]>;
  getStreamersByPlatform(platform: Platform): Promise<Streamer[]>;
  isStreamerTracked(streamer: Streamer): Promise<boolean>;
}