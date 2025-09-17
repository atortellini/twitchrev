

import {SubsCommand} from '../application/commands/SubsCommand';
import {TrackCommand} from '../application/commands/TrackCommand';
import {TwitchClientFactory, TwitchConfig} from '../application/factories';
import {StreamersLiveStatusTrackerLight, StreamersSubEventTrackerLight} from '../application/services';
import {LiveStreamSessionMetricsCoordinator} from '../application/services/LiveStreamsSessionMetricsCoordinator';
import {Platform} from '../domain/models';
import {TwitchUsersAPI} from '../infrastructure/apis';
import {TwitchStreamsAPI} from '../infrastructure/apis/TwitchStreamsAPI';
import {PollingStreamerLiveTrackerSI} from '../infrastructure/trackers';
import {TwitchSubEventTracker} from '../infrastructure/trackers/TwitchSubEventTracker';
import {logger} from '../utils';

import {Bot} from './Bot';

export interface ApplicationConfig {
  twitch: TwitchConfig
  polling: {intervalMs: number;};
  storage: {type: 'memory'|'file'; filePath?: string;};
  bot: {channels: string[];};
}

export class Application {
  private bot?: Bot;
  private streamer_live_tracker?: StreamersLiveStatusTrackerLight<Platform>;
  private streamer_subevent_tracker?: StreamersSubEventTrackerLight<Platform>;
  private streamer_session_metrics?:
      LiveStreamSessionMetricsCoordinator<Platform>;


  constructor(private config: ApplicationConfig) {}

  async start(): Promise<void> {
    logger.info('[APPLICATION] Starting...');

    try {
      const twitch = await TwitchClientFactory.create(this.config.twitch);

      const users_api = new TwitchUsersAPI(twitch.api);
      const streams_api = new TwitchStreamsAPI(twitch.api);

      const live_tracker = new PollingStreamerLiveTrackerSI(
          Platform.Twitch, streams_api, this.config.polling.intervalMs);

      this.streamer_live_tracker =
          new StreamersLiveStatusTrackerLight([live_tracker]);

      const sub_event_tracker =
          new TwitchSubEventTracker(twitch.events, this.config.twitch.userId);

      this.streamer_subevent_tracker =
          new StreamersSubEventTrackerLight([sub_event_tracker]);

      this.streamer_session_metrics = new LiveStreamSessionMetricsCoordinator(
          this.streamer_live_tracker, this.streamer_subevent_tracker);


      const track_cmd = new TrackCommand(
          this.streamer_live_tracker, this.streamer_subevent_tracker,
          users_api);

      const subs_cmd =
          new SubsCommand(this.streamer_session_metrics, users_api);

      const commands = [track_cmd, subs_cmd];

      this.bot = new Bot(commands, twitch.chat, this.config.bot.channels);

      await this.bot.start();

      logger.info(`[APPLICATION] Started succesfully`);
    } catch (error) {
      logger.error(`[APPLICATION] Failed to start:`, error);
      throw error;
    }
  }
}