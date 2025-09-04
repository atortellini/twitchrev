import {IPlatformStreamerLiveTracker} from '../../domain/interfaces';
import {Platform, Streamer, StreamStatus} from '../../domain/models';
import {logger, Mutex, Strand} from '../../utils';

interface ResolvedStreamer extends Streamer {
  resolvedAt: Date;
}

export class TwitchStreamerLiveTrackerSI implements
    IPlatformStreamerLiveTracker {
  readonly platform = Platform.Twitch;

  private trackedStreamerMutex = new Mutex('tw_livetrkr_streamer_mtx');
  private trackedStreamers = new Set<string>();
  private resolvedStreamers = new Map<string, ResolvedStreamer>();
  private isPolling = false;

  private liveCallbacks: Array<(status: StreamStatus) => void> = [];
  private offlineCallbacks: Array<(status: StreamStatus) => void> = [];
  private addCallbacks: Array<(streamer: Streamer) => void> = [];
  private removeCallbacks: Array<(streamer: Streamer) => void> = [];

  private pollingInterval: NodeJS.Timeout|null = null;


  constructor(
      private twitchAPI: TwitchApi, private pollingIntervalMs: number = 60000) {
    logger.warn(
        `Twitch live tracker: This implementation uses setInterval to perform its polling
        which can result in infrequent results if polls don't complete within interval delay.`);
  }

  /**
   * TODO:
   * AS OF NOW ADD STREAMER DEFAULTS TO ADDING TO LIST EVEN WITH ERRORS FROM
   * FAST POLLING AND/OR EMITTING THE MODIFIYING EVENT. MIGHT CONSIDER CHANGING
   * THE BEHAVIOR TO NOT ADD TO THE SET OF TRACKED STREAMERS IF THESE ERRORS
   * OCCUR. ALSO POSSIBLY TO THROW AN ERROR FROM ADDSTREAMER SO CALLERS KNOW THE
   * STREAMER WASN'T ADDED. POSSIBLY HAVE IT RETURN A PROMISE<BOOLEAN> LIKE
   * REMOVE TO INDICIATE IF IT WAS SUCCESSFUL OR NOT
   *
   * ANOTHER THING. MIGHT WANT TO RECONSIDER AT SOME POINT THE POSITION OF
   * ACQUIRING THE MUTEX AS THE THING THAT REALLY NEEDS TO BE ATOMIC IS ADDING
   * TO THE SET AND EMITTING THE EVENTS TO EVERYONE, IMPLYING IT COULD BE
   * ACQUIRED LATER IN THE FUNCTION, HOWEVER, SINCE ADDSTREAMER ALSO HAS A
   * CHANCE TO IMMEDIATELY CHECH LIVE STATUS THERE COULD BE SOME CORNER CASES
   * WITH MULTIPLE ADDS WHERE SOME AWAIT FOR CHECKLIVESTATUS, SO FOR SIMPLICITY
   * JUST SLAPPED IT AT THE TOP
   */
  async addStreamer(
      name: string,
      ): Promise<void> {
    const name_lowered = name.toLowerCase();

    await this.trackedStreamerMutex.acquire();
    try {
      if (this.trackedStreamers.has(name_lowered)) {
        logger.info(`Twitch live tracker: Already tracking '${name_lowered}'`);
        return;
      }

      let fastCheck: StreamStatus[]|null = null;
      if (this.pollingInterval) {
        try {
          fastCheck = await this.twitchAPI.checkLiveStatus(name_lowered);
        } catch (error) {
          logger.error(
              `Twitch live tracker: Error during live status fast-check for '${
                  name}':`,
              error);
        }
      }

      this.trackedStreamers.add(name_lowered);
      logger.info(`Twitch live tracker: Added ${name_lowered}`);
      try {
        await this.emitModifyingEvent('add', name_lowered);
      } catch (error) {
        logger.error(
            `Twitch live tracker: Failed to emit add event for '${name}':`,
            error);
      }

      if (fastCheck && fastCheck.length) {
        this.updateResolvedStreamerCache(fastCheck[0].streamer, new Date());
        this.processStatusUpdates(fastCheck);
      }
    } finally {
      this.trackedStreamerMutex.release();
    }
  }

  async removeStreamer(
      name: string,
      ): Promise<boolean> {
    const name_lowered = name.toLowerCase();
    await this.trackedStreamerMutex.acquire();
    try {
      const removed = this.trackedStreamers.delete(name_lowered);
      if (removed) {
        logger.info(`Twitch live tracker: Removed ${name_lowered}`);
        try {
          await this.emitModifyingEvent('remove', name_lowered);
        } catch (error) {
          logger.error(
              `Twitch live tracker: Failed to emit remove event for '${name}':`,
              error);
        }
      }
      return removed;
    } finally {
      this.trackedStreamerMutex.release();
    }
  }

  async getTrackedStreamers(): Promise<Streamer[]> {
    await this.trackedStreamerMutex.acquire();
    try {
      const currTracked = Array.from(this.trackedStreamers.values());
      try {
        return await this.retrieveValidResolvedStreamers(currTracked);
      } catch (error) {
        logger.error(
            'Twitch live tracker: Error while retrieving tracked streamers:',
            error);
        throw error;
      }
    } finally {
      this.trackedStreamerMutex.release();
    }
  }

  async isTracking(
      name: string,
      ): Promise<boolean> {
    await this.trackedStreamerMutex.acquire();
    const tracked = this.trackedStreamers.has(name.toLowerCase());
    this.trackedStreamerMutex.release();
    return tracked;
  }

  onLive(
      callback: (status: StreamStatus) => void,
      ): void {
    this.liveCallbacks.push(callback);
  }
  onOffline(
      callback: (status: StreamStatus) => void,
      ): void {
    this.offlineCallbacks.push(callback);
  }
  onAdded(
      callback: (streamer: Streamer) => void,
      ): void {
    this.addCallbacks.push(callback);
  }
  onRemoved(
      callback: (streamer: Streamer) => void,
      ): void {
    this.removeCallbacks.push(callback);
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
  async start(): Promise<void> {
    if (this.pollingInterval) {
      logger.warn('Twitch live tracker: Already running...');
      return;
    }
    logger.info('Twitch live tracker: Starting...');

    const singlePoll = () => {
      this.isPolling = true;
      this.poll()
          .catch(
              (error) => logger.error(
                  'Twitch live tracker: Error during polling:', error))
          .finally(() => this.isPolling = false);
    };

    this.pollingInterval = setInterval(() => {
      if (this.isPolling) {
        logger.warn(`Twitch live tracker: Previous poll has not finished.
                    Consider adjusting poll interval.`);
        return;
      }
      singlePoll();
    }, this.pollingIntervalMs);

    logger.info('Twitch live tracker: Running');
    singlePoll();
  }

  async stop(): Promise<void> {
    if (!this.pollingInterval) {
      logger.warn('Twitch live tracker: Already stopped...');
      return;
    }
    logger.info('Twitch live tracker: Stopping...');

    clearInterval(this.pollingInterval);
    this.pollingInterval = null;

    if (this.isPolling) {
      logger.info(
          'Twitch live tracker: Waiting for outbound polls to finish before stopping...')
      while (this.isPolling) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Twitch live tracker: Stopped');
  }

  private async poll() {
    await this.trackedStreamerMutex.acquire();
    try {
      if (this.trackedStreamers.size === 0) {
        return;
      }
      const streamerNames = Array.from(this.trackedStreamers.values());

      try {
        const statuses: StreamStatus[] =
            await this.twitchAPI.checkLiveStatus(streamerNames);
        const streamers = statuses.length === 1 ? statuses[0].streamer :
                                                  statuses.map(s => s.streamer);
        this.updateResolvedStreamerCache(streamers, new Date());
        this.processStatusUpdates(statuses);
      } catch (error) {
        logger.error(`Error polling Twitch:`, error);
      }
    } finally {
      this.trackedStreamerMutex.release();
    }
  }

  private processStatusUpdates(
      statuses: StreamStatus[],
      ): void {
    for (const status of statuses) {
      if (status.isLive) {
        this.liveCallbacks.forEach(cb => cb(status));
      } else {
        this.offlineCallbacks.forEach(cb => cb(status));
      }
    }
  }

  private isResolutionStale(
      resolved: {resolvedAt: Date},
      ): boolean {
    const staleAfterMS = 86400000;
    return Date.now() - resolved.resolvedAt.getTime() > staleAfterMS;
  }

  private async retrieveValidResolvedStreamers(
      names: string[],
      ): Promise<ResolvedStreamer[]> {
    const valid: ResolvedStreamer[] = [];
    const invalidNames: string[] = [];

    for (const name of names) {
      const cached = this.resolvedStreamers.get(name);
      if (!cached || this.isResolutionStale(cached)) {
        invalidNames.push(name);
      } else {
        valid.push(cached);
      }
    }

    if (invalidNames.length) {
      try {
        const fresh: Streamer[] =
            await this.twitchAPI.resolveStreamer(invalidNames);
        const resolvedAt = new Date();
        const newlyResolved: ResolvedStreamer[] = fresh.map(s => ({
                                                              ...s,
                                                              resolvedAt,
                                                            }));
        this.updateResolvedStreamerCache(fresh, resolvedAt);
        valid.push(...newlyResolved);
      } catch (error) {
        logger.error(
            'Twitch live tracker: Error while resolving streamers:', error);
        throw error;
      }
    }

    return valid;
  }

  private async emitModifyingEvent(
      event: 'add'|'remove',
      streamer_name: string,
      ): Promise<void> {
    try {
      let streamer: Streamer =
          await this.retrieveValidResolvedStreamers([streamer_name])
              .then(r => r[0]);
      switch (event) {
        case 'add': {
          this.addCallbacks.forEach(cb => cb(streamer));
          break;
        }
        case 'remove': {
          this.removeCallbacks.forEach(cb => cb(streamer));
        }
      }
    } catch (error) {
      logger.error(
          `Twitch live tracker: Error when attempting to emit '${
              event}' event for '${streamer_name}':`,
          error);
      throw error;
    }
  }

  private updateResolvedStreamerCache(
      streamer: Streamer|Streamer[],
      resolvedAt: Date,
      ): void {
    if (this.isResolutionStale({resolvedAt})) return;
    if (streamer instanceof Array) {
      streamer.forEach(
          (s) => this.resolvedStreamers.set(s.name, {...s, resolvedAt}));
    } else {
      this.resolvedStreamers.set(streamer.name, {...streamer, resolvedAt});
    }
  }
}