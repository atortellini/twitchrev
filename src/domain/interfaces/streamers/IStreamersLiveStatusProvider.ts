import {LiveStream, Streamer} from '../../models';

export interface IStreamersLiveStatusProvider {
  onStreamerWentLive(callback: (streamer: LiveStream) => void): void;
  onStreamerWentOffline(callback: (streamer: Streamer) => void): void;
  onStreamerStartTracking(callback: (streamer: Streamer) => void): void;
  onStreamerStopTracking(callback: (streamer: Streamer) => void): void;
}