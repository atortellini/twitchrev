import {IPlatformStreamerLiveTracker} from '../../domain/interfaces';
import {Platform, Streamer, StreamStatus} from '../../domain/models';
import {logger, Mutex} from '../../utils';


const STALE_MS = 24 * 60 * 60 * 1000;

interface ResolvedStreamer extends Streamer {
  resolvedAt: Date;
}

type TrackerEvent = 'add'|'remove';
type StatusCb = (status: StreamStatus) => void;
type StreamerCb = (streamer: Streamer) => void;

export class TwitchStreamerLiveTrackerSI implements
    IPlatformStreamerLiveTracker {
  readonly platform = Platform.Twitch;

  private trackedStreamerMutex = new Mutex('tw_livetrkr_streamer_mtx');
  private trackedStreamers = new Set<string>();
  private resolvedStreamers = new Map<string, ResolvedStreamer>();

  private pollingInterval: NodeJS.Timeout|null = null;
  private isPolling = false;

  private liveCallbacks: StatusCb[] = [];
  private offlineCallbacks: StatusCb[] = [];
  private addCallbacks: StreamerCb[] = [];
  private removeCallbacks: StreamerCb[] = [];


  constructor(
      private twitchAPI: TwitchApi, private pollingIntervalMs: number = 60000) {
    logger.warn(
        `Twitch live tracker: using setInterval; poll delays longer than the interval can skew results.`);
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



  async addStreamer(name: string): Promise<void> {
    const name_lowered = name.toLowerCase();
    return await this.trackedStreamerMutex.withLock(async () => {
      if (this.trackedStreamers.has(name_lowered)) {
        logger.info(`Twitch live tracker: Already tracking '${name_lowered}'`);
        return;
      }
      try {
        let [streamer] =
            await this.retrieveValidResolvedStreamers([name_lowered]);
        this.trackedStreamers.add(name_lowered);
        logger.info(`Twitch live tracker: Added '${name_lowered}'`);
        this.emitModifyingEvent('add', streamer);
      } catch (error) {
        logger.error(
            `Twitch live tracker: Failed to add '${name_lowered}':`, error);
        throw error;
      }
    });
  }

  /**
   * INFO:
   * DO TO ADDSTREAMER ENSURING THAT A STREAMER BE VALID PRIOR TO ADDING THEM
   * TO THE SET, THE SET OF TRACKED STREAMERS SHOULD HAVE THE INVARIANT THAT
   * THEY ARE VALID STREAMERS AND THE RESOLVEDSTREAMER SET SHOULD ONLY HAVE
   * VALID STREAMERS. THIS MEANS THAT REMOVESTREAMER SHOULD BE ABLE TO
   * IMMEDIATELY RETRIEVE FROM RESOLVEDSTREAMERS AND USE THAT OBJECT FOR THE
   * CALLBACKS
   *
   */
  async removeStreamer(name: string): Promise<boolean> {
    const name_lowered = name.toLowerCase();
    return await this.trackedStreamerMutex.withLock(async () => {
      const removed = this.trackedStreamers.delete(name_lowered);
      if (removed) {
        logger.info(`Twitch live tracker: Removed ${name_lowered}`);

        const resolved = this.resolvedStreamers.get(name_lowered);
        if (!resolved) {
          logger.warn(`Twitch live tracker: Resolved info for '${
              name_lowered}' missing from cache. Unable to invoke remove callbacks.`);
        } else {
          this.emitModifyingEvent('remove', resolved);
        }
      } else {
        logger.info(`Twitch live tracker: Not tracking ${name_lowered}`);
      }
      return removed;
    });
  }

  async getTrackedStreamers(): Promise<Streamer[]> {
    return await this.trackedStreamerMutex.withLock(async () => {
      const names = Array.from(this.trackedStreamers);
      return this.retrieveValidResolvedStreamers(names);
    });
  }

  async isTracking(name: string): Promise<boolean> {
    return await this.trackedStreamerMutex.withLock(
        async () =>
            Promise.resolve(this.trackedStreamers.has(name.toLowerCase())));
  }

  onLive(callback: StatusCb): void {
    this.liveCallbacks.push(callback);
  }
  onOffline(callback: StatusCb): void {
    this.offlineCallbacks.push(callback);
  }
  onAdded(callback: StreamerCb): void {
    this.addCallbacks.push(callback);
  }
  onRemoved(callback: StreamerCb): void {
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

    this.schedulePoll();
    this.runPoll();

    logger.info('Twitch live tracker: Running');
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


  private schedulePoll(): void {
    this.pollingInterval = setInterval(() => {
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

  /**
   * INFO:
   * IN MY MIND POLL REQUIRES TRACKEDSTREAMERMUTEX SINCE, WHEN IT AWAITS
   * FOR AN API CALL A REMOVE STREAMER METHOD COULD BE COMPLETELY INVOKED,
   * ALONG WITH ALL REMOVE EVENT CALLBACKS BUT THEN A LIVE RESPONSE WILL STILL
   * BE RECEIVED FOR THAT STREAMER EVENTUALLY. WHICH I GUESS ISNT THE WORst
   * THING SINCE IT WOULD ONLY BE ONE POLL SO I THINK I WILL REMOVE THE MUTEX
   * FOR NOW.
   * ANOTHER REASON FOR A MUTEX BETWEEN ADD/POLL IS THAT, DEPENDING ON HOW THEIR
   * INDEPENDENT POLLING INTERLEAVES, IT COULD BE THE CASE THAT ADD AWAITS ON
   * EMITTING ITS ADD EVENT AFTER JUST RECEIVING THAT STREAMER A IS OFFLINE.
   * HOWEVER, AT THAT MOMENT POLL'S QUERY TO THE TWITCH API RETURNS SAYING
   * STREAMER A IS OFFLINE. SINCE THEIR EXECUTION HAS BEEN INTERLEAVED, IT'S
   * INDETERMINATE AT THAT MOMENT WHAT THE STATE OF STREAMER A ACTUALLY IS UNTIL
   * A LATER QUERY IS MADE THAT IS NOT INTERLEAVED. THIS CREATES AN ISSUE FOR
   * THOSE LISTENING TO THE OFFLINE/ONLINE EVENTS. DEPENDING ON WHICH THE EVENT
   * LOOP DECIDES TO CONTINUE EXECUTING FIRST, THE ONLINE OR OFFLINE COULD BE
   * EMITTED FIRST, FOLLOWED BY THE OTHER. HOWEVER, WITH HAVING A MUTEX ITS
   * ENSURED THAT THE MOST RECENT EVENT EMIT WILL REFLECT THE LATEST
   * UNDERSTANDING OF THE STREAMER'S ONLINE STATUS. FOR THAT, I WILL BE KEEPING
   * THE MUTEX
   */
  private async poll() {
    return await this.trackedStreamerMutex.withLock(async () => {
      if (this.trackedStreamers.size === 0) {
        return
      }
      const streamerNames = Array.from(this.trackedStreamers);
      try {
        const statuses: StreamStatus[] =
            await this.twitchAPI.checkLiveStatus(streamerNames);
        const streamers = statuses.length === 1 ? statuses[0].streamer :
                                                  statuses.map(s => s.streamer);
        this.updateResolvedStreamerCache(streamers, new Date());
        this.processStatusUpdates(statuses);
      } catch (error) {
        logger.error('Twitch live tracker: Error polling Twitch:', error);
      }
    });
  }

  private emitModifyingEvent(event: TrackerEvent, streamer: Streamer): void {
    const cbs = event === 'add' ? this.addCallbacks : this.removeCallbacks;
    cbs.forEach(cb => cb(streamer));
  }

  private processStatusUpdates(statuses: StreamStatus[]): void {
    for (const status of statuses) {
      const cbs = status.isLive ? this.liveCallbacks : this.offlineCallbacks;
      cbs.forEach(cb => cb(status));
    }
  }

  private isResolutionStale({resolvedAt}: {resolvedAt: Date}): boolean {
    return Date.now() - resolvedAt.getTime() > STALE_MS;
  }

  private async retrieveValidResolvedStreamers(
      names: string[],
      ): Promise<ResolvedStreamer[]> {
    const valid: ResolvedStreamer[] = [];
    const invalidNames: string[] = [];

    for (const name of names) {
      const cached = this.resolvedStreamers.get(name);
      if (cached && !this.isResolutionStale(cached)) {
        valid.push(cached);
      } else {
        invalidNames.push(name);
      }
    }

    if (invalidNames.length) {
      try {
        const fresh: Streamer[] =
            await this.twitchAPI.resolveStreamers(invalidNames);
        const resolvedAt = new Date();
        const newlyResolved: ResolvedStreamer[] =
            fresh.map(s => ({...s, resolvedAt}));

        this.updateResolvedStreamerCache(fresh, resolvedAt);
        valid.push(...newlyResolved);
      } catch (error) {
        logger.error(
            `Twitch live tracker: Error while resolving streamers '${
                invalidNames}':`,
            error);
        throw error;
      }
    }

    return valid;
  }

  private updateResolvedStreamerCache(
      streamer: Streamer|Streamer[], resolvedAt: Date): void {
    if (this.isResolutionStale({resolvedAt})) return;
    const updateCache = (s: Streamer) =>
        this.resolvedStreamers.set(s.name, {...s, resolvedAt});
    Array.isArray(streamer) ? streamer.forEach(updateCache) :
                              updateCache(streamer);
  }
}
