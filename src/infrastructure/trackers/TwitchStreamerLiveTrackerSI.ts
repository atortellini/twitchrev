import {EventEmitter} from 'node:events';

import {IPlatformStreamerLiveTracker} from '../../domain/interfaces';
import {LiveStream, Platform, Streamer} from '../../domain/models';
import {logger, Mutex} from '../../utils';

type LiveStreamCb = (status: LiveStream) => void;
type StreamerCb = (streamer: Streamer) => void;
type StreamerId = string;
type LiveStreamId = string;

/**
 * Might want to include the LiveStream object
 * in the state so I can include methods to retrieve
 * the current livestreams and stuff for users of interafce. Would require
 * modifying a couple methods
 */
interface StreamerState {
  streamer: Streamer, current_stream_id?: LiveStreamId
}

enum TrackerEvents {
  start_tracking = 'start-tracking',
  stop_tracking = 'stop-tracking',
  live = 'live',
  offline = 'offline'
}

export class TwitchStreamerLiveTrackerSI implements
    IPlatformStreamerLiveTracker {
  readonly platform = Platform.Twitch;
  private event_emitter = new EventEmitter();

  private tracked_streamer_mtx = new Mutex('tw_livetrkr_streamer_mtx');
  private tracked_streamers = new Map<StreamerId, StreamerState>();

  private polling_interval: NodeJS.Timeout|null = null;
  private isPolling = false;

  constructor(
      private twitchAPI: TwitchApi, private pollingIntervalMs: number = 60000) {
    logger.warn(
        `Twitch live tracker: using setInterval; poll delays longer than the interval can skew results.`);
  }

  async startTracking(streamer: Streamer): Promise<void> {
    return await this.tracked_streamer_mtx.withLock(async () => {
      if (streamer.platform !== Platform.Twitch) {
        throw new Error(
            `Invalid platform '${streamer.platform}' for twitch live tracker`);
      }

      if (this.tracked_streamers.has(streamer.id)) {
        throw new Error(
            `Already tracking '${streamer.name}' with twitch live tracker`);
      }

      this.tracked_streamers.set(streamer.id, {streamer});

      logger.info(`Twitch live tracker: Started tracking '${
          streamer.name}' (ID: ${streamer.id})`);

      this.event_emitter.emit(TrackerEvents.start_tracking, streamer);

      if (this.tracked_streamers.size === 1) {
        this.startPolling();
      }
    });
  }

  async stopTracking(streamer: Streamer): Promise<void> {
    return await this.tracked_streamer_mtx.withLock(async () => {
      if (this.tracked_streamers.delete(streamer.id)) {
        logger.info(`Twitch live tracker: Stopped tracking '${streamer.name}'`);
        this.event_emitter.emit(TrackerEvents.stop_tracking, streamer);

        if (this.tracked_streamers.size === 0) {
          this.stopPolling();
        }
      } else {
        logger.info(`Twitch live tracker: Was not tracking '${streamer.name}'`);
      }
    });
  }

  async getTrackedStreamers(): Promise<Streamer[]> {
    return await this.tracked_streamer_mtx.withLock(
        async () => [...this.tracked_streamers.values()].map(
            ss => ss.streamer));
  }

  async isTracking(streamer: Streamer): Promise<boolean> {
    return await this.tracked_streamer_mtx.withLock(
        async () => this.tracked_streamers.has(streamer.id));
  }

  onLive(callback: LiveStreamCb): void {
    this.event_emitter.on(TrackerEvents.live, callback);
  }
  onOffline(callback: StreamerCb): void {
    this.event_emitter.on(TrackerEvents.offline, callback);
  }
  onStartTracking(callback: StreamerCb): void {
    this.event_emitter.on(TrackerEvents.start_tracking, callback);
  }
  onStopTracking(callback: StreamerCb): void {
    this.event_emitter.on(TrackerEvents.stop_tracking, callback);
  }

  /**
   * ISSUE:
   *     Issue with this implementation is that, suppose
   *     multiple polls were to get backed up. Anything reading
   *     the this.isPolling value could give incorrect
   *     information on the current state of events as the oldest
   *     poll will set isPolling to false when finsihed, even though more
   *     poll requests could exist in line. Additionally, results
   *     could be out of order providing incorrect updates on the status
   *     of streamers.
   *
   * EDIT:
   *     Now that if the previous poll is still going, subsequent ones will
   *     immediately return, the issue of out of order results will not occur.
   *     However, future updates that would have occurred are now held up by
   *     the oldest, incomplete poll.
   */
  private startPolling(): void {
    if (this.polling_interval) {
      logger.warn('Twitch live tracker: Already running...');
      return;
    }
    logger.info('Twitch live tracker: Starting...');

    this.schedulePoll();
    this.runPoll();

    logger.info('Twitch live tracker: Running');
  }

  private stopPolling(): void {
    if (!this.polling_interval) {
      logger.warn('Twitch live tracker: Already stopped...');
      return;
    }
    logger.info('Twitch live tracker: Stopping...');

    clearInterval(this.polling_interval);
    this.polling_interval = null;
    logger.info('Twitch live tracker: Stopped');
  }

  private schedulePoll(): void {
    this.polling_interval = setInterval(() => {
      if (!this.isPolling)
        this.runPoll();
      else
        logger.warn(`Twitch live tracker: Previous poll has not finished. 
        Consider adjusting poll interval.`);
    }, this.pollingIntervalMs);
  }

  private async runPoll(): Promise<void> {
    this.isPolling = true;
    try {
      await this.poll();
    } catch (error) {
      logger.error('Twitch live tracker: Error during polling:', error);
    } finally {
      this.isPolling = false;
    }
  }

  private async poll() {
    return await this.tracked_streamer_mtx.withLock(async () => {
      if (this.tracked_streamers.size === 0) {
        return
      }
      const streamerIds = [...this.tracked_streamers.keys()];
      try {
        const streams: LiveStream[] =
            await this.twitchAPI.getStreams(streamerIds);
        this.processStatusUpdates(streams);
      } catch (error) {
        logger.error('Twitch live tracker: Error polling Twitch:', error);
      }
    });
  }

  private processStatusUpdates(livestreams: LiveStream[]): void {
    const current_livestreams = new Map<StreamerId, LiveStream>();

    for (const stream of livestreams) {
      current_livestreams.set(stream.streamer.id, stream);
    }

    for (const [streamer_id, streamer_state] of this.tracked_streamers) {
      const current_stream = current_livestreams.get(streamer_id);
      const previous_stream_id = streamer_state.current_stream_id;

      const wasLive = previous_stream_id !== undefined;
      const isLive = current_stream !== undefined;

      if (wasLive && !isLive) {
        streamer_state.current_stream_id = undefined;
        this.event_emitter.emit(TrackerEvents.offline, streamer_state.streamer);
        logger.info(
            `Twitch live tracker: ${streamer_state.streamer.name} is offline`);
      } else if (isLive) {
        const isNewStream =
            !wasLive || current_stream.id !== previous_stream_id;

        if (isNewStream) {
          streamer_state.current_stream_id = current_stream.id;
          this.event_emitter.emit(TrackerEvents.live, current_stream);
          logger.info(
              `Twitch live tracker: ${streamer_state.streamer.name} is live`);
        }
      }
    }
  }
}
