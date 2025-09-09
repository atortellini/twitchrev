import {SubEvent, User} from '../../models';

export interface IStreamersSubEventProvider {
  onSubEvent(callback: (event: SubEvent) => void): void;
  onStartTracking(callback: (streamer: User) => void): void;
  onStopTracking(callback: (streamer: User) => void): void;
}
