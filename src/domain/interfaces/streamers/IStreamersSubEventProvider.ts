import {SubEvent, User} from '../../models';

export interface IStreamersSubEventProvider<
    TUser extends User = User, TSubEvent extends SubEvent = SubEvent> {
  onSubEvent(callback: (event: TSubEvent) => void): void;
  onStartTracking(callback: (streamer: TUser) => void): void;
  onStopTracking(callback: (streamer: TUser) => void): void;
}
