import {LiveStream, User} from '../../models';

export interface IStreamersLiveStatusProvider {
  onStreamerWentLive(callback: (streamer: LiveStream) => void): void;
  onStreamerWentOffline(callback: (streamer: User) => void): void;
  onStreamerStartTracking(callback: (streamer: User) => void): void;
  onStreamerStopTracking(callback: (streamer: User) => void): void;
}