import {User} from '../../models';

export interface IStreamersSubEventManager<TUser extends User = User> {
  startTracking(streamer: TUser): Promise<void>;
  stopTracking(streamer: TUser): Promise<void>;
}