import {User} from '../../models';

export interface IStreamersSubEventManager {
  startTracking(streamer: User): Promise<void>;
  stopTracking(streamer: User): Promise<void>;
}