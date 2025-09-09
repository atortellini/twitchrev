import {IPlatformStreamerLiveTracker, IStreamersLiveStatusManager, IStreamersLiveStatusProvider, ITrackedStreamerRepository} from '../../domain/interfaces';
import {LiveStream, Platform, User} from '../../domain/models';
import {logger} from '../../utils';


type LiveStreamCb = (status: LiveStream) => void;
type StreamerCb = (streamer: User) => void;

export class StreamersLiveStatusTrackerLight implements
    IStreamersLiveStatusManager, IStreamersLiveStatusProvider {
  constructor(
      private platformTrackers: Map<Platform, IPlatformStreamerLiveTracker>,
  ) {}


  async startTracking(streamer: User): Promise<void> {
    return await this.withTracker(
        streamer.platform, pt => pt.startTracking(streamer), {
          errorMsg: (`Streamers live tracker: Error while adding '${
              streamer.name}' for '${streamer.platform}':`)
        });
  }

  async stopTracking(streamer: User):
      Promise<void>{return await this.withTracker(
          streamer.platform, pt => pt.stopTracking(streamer), {
            errorMsg: `Streamers live tracker: Error while removing '${
                streamer.name}' for '${streamer.platform}':`
          })

      }

  async getTrackedStreamers(): Promise<User[]> {
    const settled =
        await Promise.allSettled([...this.platformTrackers.values()].map(
            pt => pt.getTrackedStreamers()));

    return settled.flatMap(p => {
      if (p.status === 'fulfilled') return p.value;
      logger.error(
          'Streamers live tracker: Error when retrieving tracked streamers:',
          p.reason);
      return [];
    })
  }

  async getStreamersByPlatform(platform: Platform): Promise<User[]> {
    return await this.withTracker(platform, pt => pt.getTrackedStreamers(), {
      onMissing: [],
      onError: [],
      errorMsg:
          `Streamers live tracker: Error while retrieving tracked streamers for '${
              platform}':`
    });
  }

  async isStreamerTracked(streamer: User): Promise<boolean> {
    return await this.withTracker(
        streamer.platform, pt => pt.isTracking(streamer), {
          onMissing: false,
          onError: false,
          errorMsg: `Streamers live tracker: Error while checking if '${
              streamer.name}' is tracked on '${streamer.platform}':`
        });
  }


  private async withTracker<T>(
      platform: Platform,
      action: (tracker: IPlatformStreamerLiveTracker) => Promise<T>,
      opts: {onMissing?: T; onError?: T; errorMsg?: string;}): Promise<T> {
    const {onMissing, onError, errorMsg} = opts ?? {};

    const tracker = this.platformTrackers.get(platform);
    if (!tracker) {
      logger.warn(
          `Streamers live tracker: Platform '${platform}' is not supported`);
      if (onMissing !== undefined) return onMissing;
      throw new Error(
          `Platform '${platform}' is not supported for live tracking`);
    }

    try {
      return await action(tracker);
    } catch (error) {
      if (errorMsg) logger.error(errorMsg, error);
      if (onError !== undefined) return onError;
      throw error;
    }
  }

  onStreamerWentLive(callback: LiveStreamCb): void {
    this.platformTrackers.values().forEach(pt => pt.onLive(callback));
  }
  onStreamerWentOffline(callback: StreamerCb): void {
    this.platformTrackers.values().forEach(pt => pt.onOffline(callback));
  }
  onStreamerStartTracking(callback: StreamerCb): void {
    this.platformTrackers.values().forEach(pt => pt.onStartTracking(callback));
  }
  onStreamerStopTracking(callback: StreamerCb): void {
    this.platformTrackers.values().forEach(pt => pt.onStopTracking(callback));
  }
}
