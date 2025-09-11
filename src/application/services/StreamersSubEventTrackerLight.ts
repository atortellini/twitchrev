import {IPlatformSubEventTracker, IStreamersSubEventManager, IStreamersSubEventProvider} from '../../domain/interfaces';
import {Platform, PlatformSubEvent, PlatformUser} from '../../domain/models';
import {logger} from '../../utils';

type SubEventCb<P extends Platform> = (e: PlatformSubEvent<P>) => void;
type StreamerCb<P extends Platform> = (streamer: PlatformUser<P>) => void;

type ExtractPlatforms<T> =
    T extends IPlatformSubEventTracker<infer P>? P : never;
type SupportedPlatforms<
    T extends readonly IPlatformSubEventTracker<Platform>[]> =
    ExtractPlatforms<T[number]>;


export class StreamersSubEventTrackerLight<
    const TTrackers extends readonly IPlatformSubEventTracker<Platform>[],
                            TPlatforms extends
        Platform = SupportedPlatforms<TTrackers>> implements
    IStreamersSubEventManager<TPlatforms>,
    IStreamersSubEventProvider<TPlatforms> {
  private tracker_map: Map<TPlatforms, IPlatformSubEventTracker<TPlatforms>>;

  constructor(trackers: TTrackers) {
    this.tracker_map = new Map(trackers.map(
                           tracker => [tracker.platform, tracker] as const)) as
        Map<TPlatforms, IPlatformSubEventTracker<TPlatforms>>;
  }


  async startTracking<P extends TPlatforms>(streamer: PlatformUser<P>):
      Promise<void> {
    const tracker = this.tracker_map.get(streamer.platform as TPlatforms)!;

    return await tracker.startTracking(streamer);
  }

  async stopTracking<P extends TPlatforms>(streamer: PlatformUser<P>):
      Promise<void> {
    const tracker = this.tracker_map.get(streamer.platform as TPlatforms)!;

    return await tracker.stopTracking(streamer);
  }

  async getTrackedStreamers(): Promise<PlatformUser<TPlatforms>[]> {
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

  async getStreamersByPlatform(platform: TPlatforms):
      Promise<PlatformUser<TPlatforms>[]> {
    const tracker = this.tracker_map.get(platform)!;

    return await tracker.getTrackedStreamers();
  }

  async isStreamerTracked<P extends TPlatforms>(streamer: PlatformUser<P>):
      Promise<boolean> {
    const tracker = this.tracker_map.get(streamer.platform as TPlatforms)!;

    return await tracker.isTracking(streamer);
  }

  onSubEvent(callback: SubEventCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onSubEvent(callback));
  }
  onStartTracking(callback: StreamerCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onStartTracking(callback));
  }
  onStopTracking(callback: StreamerCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onStopTracking(callback));
  }
}
