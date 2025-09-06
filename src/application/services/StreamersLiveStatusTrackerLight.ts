import {IPlatformStreamerLiveTracker, IStreamersLiveStatusManager, IStreamersLiveStatusProvider, ITrackedStreamerRepository} from '../../domain/interfaces';
import {Platform, Streamer, StreamStatus} from '../../domain/models';
import {logger} from '../../utils';


type StatusCb = (status: StreamStatus) => void;
type StreamerCb = (streamer: Streamer) => void;

export class StreamersLiveStatusTrackerLight implements
    IStreamersLiveStatusManager, IStreamersLiveStatusProvider {
  constructor(
      private platformTrackers: Map<Platform, IPlatformStreamerLiveTracker>,
  ) {}

  /**
   * Maybe return boolean for successful result
   */
  async addStreamer(name: string, platform: Platform): Promise<void> {
    return await this.withTracker(platform, pt => pt.addStreamer(name), {
      errorMsg: (`Streamers live tracker: Error while adding ${name} for '${
          platform}':`)
    });
  }

  async removeStreamer(name: string, platform: Platform):
      Promise<boolean>{return await this.withTracker(
          platform, pt => pt.removeStreamer(name), {
            onMissing: false,
            onError: false,
            errorMsg: `Streamers live tracker: Error while removing '${
                name} for '${platform}':`
          })

      }

  async getTrackedStreamers(): Promise<Streamer[]> {
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

  async getStreamersByPlatform(platform: Platform): Promise<Streamer[]> {
    return await this.withTracker(platform, pt => pt.getTrackedStreamers(), {
      onMissing: [],
      onError: [],
      errorMsg:
          `Streamers live tracker: Error while retrieving tracked streamers for '${
              platform}':`
    });
  }

  async isStreamerTracked(name: string, platform: Platform): Promise<boolean> {
    return await this.withTracker(platform, pt => pt.isTracking(name), {
      onMissing: false,
      onError: false,
      errorMsg: `Streamers live tracker: Error while checking if '${
          name}' is tracked on '${platform}':`
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

  onStreamerWentLive(callback: StatusCb): void {
    this.platformTrackers.values().forEach(pt => pt.onLive(callback));
  }

  onStreamerWentOffline(callback: StatusCb): void {
    this.platformTrackers.values().forEach(pt => pt.onOffline(callback));
  }
  onStreamerAdded(callback: StreamerCb): void {
    this.platformTrackers.values().forEach(pt => pt.onAdded(callback));
  }

  onStreamerRemoved(callback: StreamerCb): void {
    this.platformTrackers.values().forEach(pt => pt.onRemoved(callback));
  }
}
