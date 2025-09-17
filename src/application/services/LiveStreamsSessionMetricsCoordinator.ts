import {IStreamersLiveStatusProvider, IStreamersSubEventProvider} from '../../domain/interfaces';
import {LiveStream, Platform, PlatformLiveStream, PlatformSubEvent, PlatformUser, SubEvent, SubEventGuards, TwitchAnySubEvent, User} from '../../domain/models';
import {logger} from '../../utils';

type SessionMetricsMap = {
  [Platform.Twitch]: TwitchSessionMetrics,
}

type PlatformSessionMetrics<P extends Platform> = SessionMetricsMap[P];

interface SubTierMetrics {
  total: number;
  gifted: number;
  regular: number;
}

interface TwitchSessionMetrics {
  subscriptions: {
    tier1: SubTierMetrics; tier2: SubTierMetrics; tier3: SubTierMetrics;
    totals: {all: number; gifted: number; regular: number};
  };
}

interface ActiveStreamSession<P extends Platform> {
  isLive: true;
  stream: PlatformLiveStream<P>;
  metrics: PlatformSessionMetrics<P>;
}

interface InactiveStreamSession {
  isLive: false;
}

type StreamSession<P extends Platform> =
    ActiveStreamSession<P>|InactiveStreamSession;


export interface ILiveStreamSessionMetricsProvider<
    TPlatforms extends Platform> {
  isLive(streamer: PlatformUser<TPlatforms>): boolean;
  getSessionMetrics(streamer: PlatformUser<TPlatforms>):
      PlatformSessionMetrics<TPlatforms>|null;
  // getAllActiveSessions(): {
  //   streamer: PlatformUser<TPlatforms>,
  //   session: PlatformSessionMetrics<TPlatforms>
  // }[];
}



namespace StreamerKeyGenerator {
  export type StreamerKey = string;

  export function fromUser(streamer: User): StreamerKey {
    return `${streamer.name.toLowerCase()}-${streamer.platform}`;
  }
  export function fromStream(stream: LiveStream): StreamerKey {
    return `${stream.user_name.toLowerCase()}-${stream.platform}`;
  }
  export function fromSubEvent(event: SubEvent): StreamerKey {
    return `${event.broadcaster.name.toLowerCase()}-${event.platform}`;
  }
}

namespace SessionMetricsFactory {
  export function createEmpty<P extends Platform>(platform: P):
      PlatformSessionMetrics<P> {
    switch (platform) {
      case Platform.Twitch: {
        return {
          subscriptions: {
            tier1: {total: 0, gifted: 0, regular: 0},
            tier2: {total: 0, gifted: 0, regular: 0},
            tier3: {total: 0, gifted: 0, regular: 0},
            totals: {all: 0, gifted: 0, regular: 0}
          }
        };
      }
    }
  }
}

export namespace SessionMetricsFormatter {
  export function formatTwitchSessionMetrics(
      name: string, metrics: TwitchSessionMetrics): string {
    const {tier1, tier2, tier3, totals} = metrics.subscriptions;
    return `${name}: ${totals.all} sub(s) | T1:${tier1.total} T2:${
        tier2.total} T3:${tier3.total}`;
  }
}

namespace SubEventProcessor {
  export function updateMetrics<P extends Platform>(
      metrics: PlatformSessionMetrics<P>, subevent: PlatformSubEvent<P>): void {
    if (SubEventGuards.isTwitchAnySubEvent(subevent)) {
      updateTwitchMetrics(metrics, subevent);
    }
  }

  function updateTwitchMetrics(
      metrics: TwitchSessionMetrics, subevent: TwitchAnySubEvent): void {
    if (SubEventGuards.Twitch.isTwitchGiftPaidUpgradeEvent(subevent) ||
        SubEventGuards.Twitch.isTwitchCommunitySubGiftEvent(subevent)) {
      logger.warn(`[SESSION-METRICS] Ignoring event: '${subevent.type}'`);
      return;
    }

    const tier = subevent.tier;
    const tier_key = `tier${tier}` as const;

    if (SubEventGuards.Twitch.isGiftRelated(subevent)) {
      metrics.subscriptions[tier_key].gifted++;
      metrics.subscriptions.totals.gifted++;
    } else {
      metrics.subscriptions[tier_key].regular++;
      metrics.subscriptions.totals.regular++;
    }
    metrics.subscriptions[tier_key].total++;
    metrics.subscriptions.totals.all++;

    logger.info(`[SESSION_METRICS] Sub event processed for '${
        subevent.broadcaster.name}': '${subevent.type}' `);
  }
}

export class LiveStreamSessionMetricsCoordinator<TPlatforms extends Platform>
    implements ILiveStreamSessionMetricsProvider<TPlatforms> {
  private readonly session_map =
      new Map<StreamerKeyGenerator.StreamerKey, StreamSession<TPlatforms>>();
  private readonly key_gen = StreamerKeyGenerator;

  constructor(
      private readonly live_status_provider:
          IStreamersLiveStatusProvider<TPlatforms>,
      private readonly subevent_provider:
          IStreamersSubEventProvider<TPlatforms>) {
    this.setupEventListeners();
  }

  isLive(streamer: PlatformUser<TPlatforms>): boolean {
    const session = this.getSession(streamer);
    return session?.isLive ?? false;
  }

  getSessionMetrics(streamer: PlatformUser<TPlatforms>):
      PlatformSessionMetrics<TPlatforms>|null {
    const session = this.getSession(streamer);
    return session?.isLive ? session.metrics : null;
  }

  // getAllActiveSessions(): {
  //   streamer: PlatformUser<TPlatforms>,
  //   session: PlatformSessionMetrics<TPlatforms>
  // }[] {

  // }

  private setupEventListeners(): void {
    this.live_status_provider.onStreamerStartTracking(streamer => {
      const key = this.key_gen.fromUser(streamer);
      this.session_map.set(key, {isLive: false});
      logger.debug(`[SESSION-METRICS] Started tracking '${streamer.name}' on '${
          streamer.platform}'`);
    });

    this.live_status_provider.onStreamerStopTracking(streamer => {
      const key = this.key_gen.fromUser(streamer);
      this.session_map.delete(key);
      logger.debug(`[SESSION-METRICS] Stopped tracking '${streamer.name}' on '${
          streamer.platform}'`);
    });

    this.live_status_provider.onStreamerWentLive(stream => {
      const key = this.key_gen.fromStream(stream);
      const metrics = SessionMetricsFactory.createEmpty(stream.platform);

      this.session_map.set(key, {isLive: true, stream, metrics});

      logger.info(`[SESSION-METRICS] '${stream.user_name}' went live on '${
          stream.platform}'`);
    });

    this.live_status_provider.onStreamerWentOffline(streamer => {
      const key = this.key_gen.fromUser(streamer);
      this.session_map.set(key, {isLive: false});

      logger.info(`[SESSION-METRICS] '${streamer.name}' went offline on '${
          streamer.platform}'`);
    });

    this.subevent_provider.onSubEvent(e => {
      this.handleSubEvent(e);
    });
  }

  private handleSubEvent(e: PlatformSubEvent<TPlatforms>): void {
    const key = this.key_gen.fromSubEvent(e);
    const session = this.session_map.get(key);

    if (!session) {
      logger.debug(
          `[SESSION-METRICS] Ignoring sub event for untracked streamer: ${
              e.broadcaster.name}`);
      return;
    }

    if (!session.isLive) {
      logger.debug(
          `[SESSION-METRICS] Ignoring sub event for offline streamer: ${
              e.broadcaster.name}`);
      return;
    }

    SubEventProcessor.updateMetrics(session.metrics, e);
  }

  private getSession(streamer: PlatformUser<TPlatforms>):
      StreamSession<TPlatforms>|undefined {
    const key = this.key_gen.fromUser(streamer);
    return this.session_map.get(key);
  }
}