import {EventEmitter} from 'node:events';

import {IPlatformStreamerLiveTracker, IPlatformStreamsAPI} from '../../domain/interfaces/platform';
import {LiveStream, Platform, PlatformLiveStream, PlatformUser} from '../../domain/models';
import {logger, Mutex} from '../../utils';

type LiveStreamCb<P extends Platform> = (status: PlatformLiveStream<P>) => void;
type StreamerCb<P extends Platform> = (streamer: PlatformUser<P>) => void;
type StreamerId = string;
type LiveStreamId = string;

/**
 * Might want to include the LiveStream object
 * in the state so I can include methods to retrieve
 * the current livestreams and stuff for users of interafce. Would require
 * modifying a couple methods
 */

enum TrackerEvents {
  start_tracking = 'start-tracking',
  stop_tracking = 'stop-tracking',
  live = 'live',
  offline = 'offline'
}

interface StreamerState<P extends Platform> {
  streamer: PlatformUser<P>, current_stream_id?: LiveStreamId
}
export class PollingStreamerLiveTrackerSI<P extends Platform> implements
    IPlatformStreamerLiveTracker<P> {
  private event_emitter = new EventEmitter();

  private tracked_streamer_mtx;
  private tracked_streamers = new Map<StreamerId, StreamerState<P>>();

  private polling_interval: NodeJS.Timeout|null = null;
  private isPolling = false;

  constructor(
      readonly platform: P, private platformAPI: IPlatformStreamsAPI<P>,
      private pollingIntervalMs: number = 60000) {
    logger.warn(`${
        this.platform} live tracker: using setInterval; poll delays longer than the interval can skew results.`);
    this.tracked_streamer_mtx = new Mutex(`${this.platform}-poll-livetrkr`);
  }

  async startTracking(streamer: PlatformUser<P>): Promise<void> {
    return await this.tracked_streamer_mtx.withLock(async () => {
      if (streamer.platform !== this.platform) {
        throw new Error(`Invalid platform '${streamer.platform}' for ${
            this.platform} live tracker`);
      }

      if (this.tracked_streamers.has(streamer.id)) {
        throw new Error(`Already tracking '${streamer.name}' with ${
            this.platform} live tracker`);
      }

      this.tracked_streamers.set(streamer.id, {streamer});

      logger.info(`${this.platform} live tracker: Started tracking '${
          streamer.name}' (ID: ${streamer.id})`);

      this.event_emitter.emit(TrackerEvents.start_tracking, streamer);

      if (this.tracked_streamers.size === 1) {
        this.startPolling();
      }
    });
  }

  async stopTracking(streamer: PlatformUser<P>): Promise<void> {
    return await this.tracked_streamer_mtx.withLock(async () => {
      if (this.tracked_streamers.delete(streamer.id)) {
        logger.info(`${this.platform} live tracker: Stopped tracking '${
            streamer.name}'`);
        this.event_emitter.emit(TrackerEvents.stop_tracking, streamer);

        if (this.tracked_streamers.size === 0) {
          this.stopPolling();
        }
      } else {
        logger.info(`${this.platform} live tracker: Was not tracking '${
            streamer.name}'`);
      }
    });
  }

  async getTrackedStreamers(): Promise<PlatformUser<P>[]> {
    return await this.tracked_streamer_mtx.withLock(
        async () => [...this.tracked_streamers.values()].map(
            ss => ss.streamer));
  }

  async isTracking(streamer: PlatformUser<P>): Promise<boolean> {
    return await this.tracked_streamer_mtx.withLock(
        async () => this.tracked_streamers.has(streamer.id));
  }

  onLive(callback: LiveStreamCb<P>): void {
    this.event_emitter.on(TrackerEvents.live, callback);
  }
  onOffline(callback: StreamerCb<P>): void {
    this.event_emitter.on(TrackerEvents.offline, callback);
  }
  onStartTracking(callback: StreamerCb<P>): void {
    this.event_emitter.on(TrackerEvents.start_tracking, callback);
  }
  onStopTracking(callback: StreamerCb<P>): void {
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
      logger.warn(`${this.platform} live tracker: Already running...`);
      return;
    }
    logger.info(`${this.platform} live tracker: Starting...`);

    this.schedulePoll();
    this.runPoll();

    logger.info(`${this.platform} live tracker: Running`);
  }

  private stopPolling(): void {
    if (!this.polling_interval) {
      logger.warn(`${this.platform} live tracker: Already stopped...`);
      return;
    }
    logger.info(`${this.platform} live tracker: Stopping...`);

    clearInterval(this.polling_interval);
    this.polling_interval = null;
    logger.info(`${this.platform} live tracker: Stopped`);
  }

  private schedulePoll(): void {
    this.polling_interval = setInterval(() => {
      if (!this.isPolling)
        this.runPoll();
      else
        logger.warn(
            `${this.platform} live tracker: Previous poll has not finished. 
        Consider adjusting poll interval.`);
    }, this.pollingIntervalMs);
  }

  private async runPoll(): Promise<void> {
    this.isPolling = true;
    try {
      await this.poll();
    } catch (error) {
      logger.error(
          `${this.platform} live tracker: Error during polling:`, error);
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
        const streams = await this.platformAPI.getStreams(streamerIds);
        this.processStatusUpdates(streams);
      } catch (error) {
        logger.error(
            `${this.platform} live tracker: Error polling ${this.platform}:`,
            error);
      }
    });
  }

  private processStatusUpdates(livestreams: LiveStream[]): void {
    const current_livestreams = new Map<StreamerId, LiveStream>();

    for (const stream of livestreams) {
      current_livestreams.set(stream.user_id, stream);
    }

    for (const [streamer_id, streamer_state] of this.tracked_streamers) {
      const current_stream = current_livestreams.get(streamer_id);
      const previous_stream_id = streamer_state.current_stream_id;

      const wasLive = previous_stream_id !== undefined;
      const isLive = current_stream !== undefined;

      if (wasLive && !isLive) {
        streamer_state.current_stream_id = undefined;
        this.event_emitter.emit(TrackerEvents.offline, streamer_state.streamer);
        logger.info(`${this.platform} live tracker: ${
            streamer_state.streamer.name} is offline`);
      } else if (isLive) {
        const isNewStream =
            !wasLive || current_stream.id !== previous_stream_id;

        if (isNewStream) {
          streamer_state.current_stream_id = current_stream.id;
          this.event_emitter.emit(TrackerEvents.live, current_stream);
          logger.info(`${this.platform} live tracker: ${
              streamer_state.streamer.name} is live`);
        }
      }
    }
  }
}
