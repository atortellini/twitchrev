import {IPlatformStreamerLiveTracker, IStreamersLiveStatusManager, IStreamersLiveStatusProvider, ITrackedStreamerRepository} from '../../domain/interfaces';
import {Platform, PlatformLiveStream, PlatformUser} from '../../domain/models';
import {logger} from '../../utils';

type LiveStreamCb<P extends Platform> = (ls: PlatformLiveStream<P>) => void;
type StreamerCb<P extends Platform> = (streamer: PlatformUser<P>) => void;

type ExtractPlatforms<T> =
    T extends IPlatformStreamerLiveTracker<infer P>? P : never;
type SupportedPlatforms<
    T extends readonly IPlatformStreamerLiveTracker<Platform>[]> =
    ExtractPlatforms<T[number]>;


export class StreamersLiveStatusTrackerLight<
    const TTrackers extends readonly IPlatformStreamerLiveTracker<Platform>[],
                            TPlatforms extends
        Platform = SupportedPlatforms<TTrackers>> implements
    IStreamersLiveStatusManager<TPlatforms>,
    IStreamersLiveStatusProvider<TPlatforms> {
  private tracker_map:
      Map<TPlatforms, IPlatformStreamerLiveTracker<TPlatforms>>;

  constructor(private trackers: TTrackers) {
    this.tracker_map = new Map(trackers.map(
                           tracker => [tracker.platform, tracker] as const)) as
        Map<TPlatforms, IPlatformStreamerLiveTracker<TPlatforms>>
  }


  async startTracking(streamer: PlatformUser<TPlatforms>): Promise<void> {
    const tracker = this.tracker_map.get(streamer.platform as TPlatforms)!;

    return await tracker.startTracking(streamer);
  }

  async stopTracking(streamer: PlatformUser<TPlatforms>): Promise<void> {
    const tracker = this.tracker_map.get(streamer.platform as TPlatforms)!;

    return await tracker.stopTracking(streamer);
  }

  async getTrackedStreamers(): Promise<PlatformUser<TPlatforms>[]> {
    const settled = await Promise.allSettled(
        [...this.tracker_map.values()].map(pt => pt.getTrackedStreamers()));

    return settled.flatMap(p => {
      if (p.status === 'fulfilled') return p.value;
      logger.error(
          'Streamers live tracker: Error when retrieving tracked streamers:',
          p.reason);
      return [];
    })
  }

  async getStreamersByPlatform(platform: TPlatforms):
      Promise<PlatformUser<TPlatforms>[]> {
    const tracker = this.tracker_map.get(platform)!;

    return await tracker.getTrackedStreamers();
  }

  async isStreamerTracked(streamer: PlatformUser<TPlatforms>):
      Promise<boolean> {
    const tracker = this.tracker_map.get(streamer.platform as TPlatforms)!;

    return await tracker.isTracking(streamer);
  }

  onStreamerWentLive(callback: LiveStreamCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onLive(callback));
  }
  onStreamerWentOffline(callback: StreamerCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onOffline(callback));
  }
  onStreamerStartTracking(callback: StreamerCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onStartTracking(callback));
  }
  onStreamerStopTracking(callback: StreamerCb<TPlatforms>): void {
    this.tracker_map.values().forEach(pt => pt.onStopTracking(callback));
  }
}
