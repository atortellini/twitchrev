import {IPlatformSubEventTracker, IStreamersSubEventManager, IStreamersSubEventProvider} from '../../domain/interfaces';
import {Platform} from '../../domain/models';
import {logger} from '../../utils';

type ExtractUser<T> =
    T extends IPlatformSubEventTracker<infer U, any>? U : never;
type ExtractEvent<T> =
    T extends IPlatformSubEventTracker<any, infer E>? E : never;

export class StreamersSubEventTrackerLight<
    TTrackers extends IPlatformSubEventTracker<any, any>[]> implements
    IStreamersSubEventManager<ExtractUser<TTrackers[number]>>,
    IStreamersSubEventProvider<
        ExtractUser<TTrackers[number]>, ExtractEvent<TTrackers[number]>> {
  private tracker_map: Map<Platform, IPlatformSubEventTracker<any, any>>;

  constructor(trackers: TTrackers) {
    this.tracker_map = new Map(trackers.map(t => [t.platform, t]));
  }


  async startTracking(streamer: ExtractUser<TTrackers[number]>): Promise<void> {
    return await this.withTracker(
        streamer.platform, pt => pt.startTracking(streamer), {
          errorMsg: (`Streamers sub tracker: Error while adding '${
              streamer.name}' for '${streamer.platform}':`)
        });
  }

  async stopTracking(streamer: ExtractUser<TTrackers[number]>): Promise<void> {
    return await this.withTracker(
        streamer.platform, pt => pt.stopTracking(streamer), {
          errorMsg: `Streamers sub tracker: Error while removing '${
              streamer.name}' for '${streamer.platform}':`
        });
  }

  async getTrackedStreamers(): Promise<ExtractUser<TTrackers[number]>[]> {
    const settled = await Promise.allSettled(
        [...this.tracker_map.values()].map(pt => pt.getTrackedStreamers()));

    return settled.flatMap(p => {
      if (p.status === 'fulfilled') return p.value;
      logger.error(
          'Streamers sub tracker: Error when retrieving tracked streamers:',
          p.reason);
      return [];
    });
  }

  async getStreamersByPlatform<P extends TTrackers[number]['platform']>(
      platform: P):
      Promise<ExtractUser<Extract<TTrackers[number], {platform: P}>>[]> {
    return await this.withTracker(platform, pt => pt.getTrackedStreamers(), {
      errorMsg:
          `Streamers sub tracker: Error while retrieving tracked streamers for '${
              platform}':`
    });
  }

  async isStreamerTracked(streamer: ExtractUser<TTrackers[number]>):
      Promise<boolean> {
    return await this.withTracker(
        streamer.platform, pt => pt.isTracking(streamer), {
          errorMsg: `Streamers sub tracker: Error while checking if '${
              streamer.name}' is tracked on '${streamer.platform}':`
        });
  }

  private async withTracker<T>(
      platform: Platform,
      action: (tracker: IPlatformSubEventTracker<any, any>) => Promise<T>,
      opts: {onMissing?: T; onError?: T; errorMsg?: string;}): Promise<T> {
    const {onMissing, onError, errorMsg} = opts ?? {};

    const tracker = this.tracker_map.get(platform);
    if (!tracker) {
      logger.warn(
          `Streamers sub tracker: Platform '${platform}' is not supported`);
      if (onMissing !== undefined) return onMissing;
      throw new Error(
          `Platform '${platform}' is not supported for sub tracking`);
    }

    try {
      return await action(tracker);
    } catch (error) {
      if (errorMsg) logger.error(errorMsg, error);
      if (onError !== undefined) return onError;
      throw error;
    }
  }

  onSubEvent(callback: (e: ExtractEvent<TTrackers[number]>) => void): void {
    this.tracker_map.values().forEach(pt => pt.onSubEvent(callback));
  }
  onStartTracking(callback: (e: ExtractUser<TTrackers[number]>) => void): void {
    this.tracker_map.values().forEach(pt => pt.onStartTracking(callback));
  }
  onStopTracking(callback: (e: ExtractUser<TTrackers[number]>) => void): void {
    this.tracker_map.values().forEach(pt => pt.onStopTracking(callback));
  }
}
