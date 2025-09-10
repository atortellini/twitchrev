import {EventSubChannelChatNotificationEvent, EventSubSubscription} from '@twurple/eventsub-base';
import {EventSubWsListener} from '@twurple/eventsub-ws';
import {EventEmitter} from 'node:events';

import {IPlatformSubEventTracker} from '../../domain/interfaces';
import {Platform, TwitchAnySubEvent, TwitchUser} from '../../domain/models';
import {TwitchSubEventFactory} from '../../domain/models/TwitchSubEventEntities';
import {logger} from '../../utils';

type StreamerId = string;
interface SubscriptionInfo {
  channel: TwitchUser, sub: EventSubSubscription
}

enum TrackerEvents {
  start_tracking = 'start-tracking',
  stop_tracking = 'stop-tracking',
  subevent = 'subevent'
}

export class TwitchSubEventTracker implements
    IPlatformSubEventTracker<TwitchUser, TwitchAnySubEvent> {
  readonly platform = Platform.Twitch;
  private event_emitter = new EventEmitter();
  private subscription_map = new Map<StreamerId, SubscriptionInfo>();


  constructor(
      private eventsub_ws: EventSubWsListener,
      private authorized_user: TwitchUser) {}

  async startTracking(streamer: TwitchUser): Promise<void> {
    if (this.subscription_map.has(streamer.id)) {
      throw new Error(`Already tracking '${streamer.name}' for ${
          this.platform} sub tracker`);
    }

    this.subscription_map.set(streamer.id, {
      channel: streamer,
      sub: this.eventsub_ws.onChannelChatNotification(
          streamer.id, this.authorized_user.id,
          this.handleChatNotificationEvent)
    });

    this.event_emitter.emit(TrackerEvents.start_tracking, streamer);
  }

  async stopTracking(streamer: TwitchUser): Promise<void> {
    const entry = this.subscription_map.get(streamer.id);
    if (entry) {
      entry.sub.stop();
      this.subscription_map.delete(streamer.id);
      logger.info(`Twitch sub tracker: Stopped tracking '${streamer.name}'`);
      this.event_emitter.emit(TrackerEvents.stop_tracking);
    } else {
      logger.info(`Twitch sub tracker: Was not tracking '${streamer.name}'`);
    }
  }

  async getTrackedStreamers(): Promise<TwitchUser[]> {
    return [...this.subscription_map.values()].map(si => si.channel);
  }

  async isTracking(streamer: TwitchUser): Promise<boolean> {
    return this.subscription_map.has(streamer.id);
  }

  onStartTracking(callback: (streamer: TwitchUser) => void): void {
    this.event_emitter.on(TrackerEvents.start_tracking, callback);
  }

  onStopTracking(callback: (streamer: TwitchUser) => void): void {
    this.event_emitter.on(TrackerEvents.stop_tracking, callback);
  }

  onSubEvent(callback: (event: TwitchAnySubEvent) => void): void {
    this.event_emitter.on(TrackerEvents.subevent, callback);
  }

  private handleChatNotificationEvent(e: EventSubChannelChatNotificationEvent):
      void {
    const event = TwitchSubEventFactory.fromChannelChatNotificationEvent(e);
    if (event) {
      this.event_emitter.emit(TrackerEvents.subevent, event);
    }
  }
}
