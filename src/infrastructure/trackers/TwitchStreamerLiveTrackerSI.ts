import { IPlatformStreamerLiveTracker } from "../../domain/interfaces";
import { Platform, Streamer, StreamStatus } from "../../domain/models";
import { logger } from "../../utils";
import { Strand } from "../../utils";
import { Mutex } from "../../utils";

interface ResolvedStreamer extends Streamer {
    resolvedAt: Date;
}

export class TwitchStreamerLiveTrackerSI implements IPlatformStreamerLiveTracker {
    readonly platform = Platform.Twitch;

    private trackedStreamerMutex = new Mutex('tw_livetrkr_streamer_mtx');
    private trackedStreamers = new Set<string>();
    private resolvedStreamers = new Map<string, ResolvedStreamer>();
    private isPolling = false;

    private liveCallbacks: Array<(status: StreamStatus) => void> = [];
    private offlineCallbacks: Array<(status: StreamStatus) => void> = [];
    private addCallbacks: Array<(streamer: Streamer) => void> = [];
    private removeCallbacks: Array<(streamer: Streamer) => void> = [];
    
    private pollingInterval: NodeJS.Timeout | null = null;


    constructor(
        private twitchAPI: TwitchApi,
        private pollingIntervalMs: number = 60000
    ) { logger.warn(`Twitch live tracker: This implementation uses setInterval to perform its polling
        which can result in infrequent results if polls don't complete within interval delay.`); }

    async addStreamer(name: string): Promise<void> {
        const s = name.toLowerCase();
        await this.trackedStreamerMutex.acquire();

        if (this.pollingInterval) {
            try {
                const result: StreamStatus[] = await this.twitchAPI.checkLiveStatus(s);
        
                this.updateResolvedStreamerCache(result[0].streamer, new Date());

                this.processStatusUpdates(result);
            } catch (error) {
                logger.error('Twitch live tracker: Error during polling:', error);
            }
        }
        this.trackedStreamers.add(s);
        logger.info(`Twitch live tracker: Added ${name}`);
        try {
            await this.emitModifyingEvent("add", name);
        } catch (error) {
            logger.error(`Twitch live tracker: Failed to emit add event for '${name}':`, error);
        }
        this.trackedStreamerMutex.release();

    }

    async removeStreamer(name: string): Promise<boolean> {
        await this.trackedStreamerMutex.acquire();
        const removed = this.trackedStreamers.delete(name.toLowerCase());
        if (removed) {
            logger.info(`Twitch live tracker: Removed ${name}`);
        }
        try {
            await this.emitModifyingEvent("remove", name);
        } catch (error) {
            logger.error(`Twitch live tracker: Failed to emit remove event for '${name}':`, error);
        }
        this.trackedStreamerMutex.release();
        return removed;
    }

    async getTrackedStreamers(): Promise<Streamer[]> {
       await this.trackedStreamerMutex.acquire();
        const currTracked = Array.from(this.trackedStreamers.values());
        const results = await Promise.allSettled(
            currTracked.map(name => this.retrieveValidResolvedStreamer(name)));

        const validRetrievedStreamers: Streamer[] = results.reduce<Streamer[]>((acc, r) => {
            if (r.status === 'fulfilled') acc.push(r.value);
            else logger.error("Twitch live tracker: Error while retrieving tracked streamers", r.reason)
            return acc;
        }, [])

        this.trackedStreamerMutex.release();
        return validRetrievedStreamers;
    }

    async isTracking(name: string): Promise<boolean> {
        await this.trackedStreamerMutex.acquire();
        const tracked = this.trackedStreamers.has(name.toLowerCase());
        this.trackedStreamerMutex.release();
        return tracked;
    }

    onLive(callback: (status: StreamStatus) => void): void {
        this.liveCallbacks.push(callback);
    }
    onOffline(callback: (status: StreamStatus) => void): void {
        this.offlineCallbacks.push(callback);
    }
    onAdded(callback: (streamer: Streamer) => void): void {
        this.addCallbacks.push(callback);
    }
    onRemoved(callback: (streamer: Streamer) => void): void {
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
            .catch((error) => logger.error('Twitch live tracker: Error during polling:', error))
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
            logger.warn("Twitch live tracker: Already stopped...");
            return;
        }
        logger.info('Twitch live tracker: Stopping...');

        clearInterval(this.pollingInterval);
        this.pollingInterval = null;

        if (this.isPolling) {
            logger.info('Twitch live tracker: Waiting for outbound polls to finish before stopping...')
            while (this.isPolling) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } 

        logger.info('Twitch live tracker: Stopped');   
    }

    private async poll() {
        return await this.trackedStreamerMutex.withLock(async () => {
        if (this.trackedStreamers.size === 0) {
                return;
            }
            const streamerNames = Array.from(this.trackedStreamers.values());
    
            try {
                const statuses: StreamStatus[] = await this.twitchAPI.checkLiveStatus(streamerNames);
                const streamers = statuses.length === 1
                    ? statuses[0].streamer
                    : statuses.map(s => s.streamer);
                this.updateResolvedStreamerCache(streamers, new Date());
                this.processStatusUpdates(statuses);
            } catch (error) {
                logger.error(`Error polling Twitch:`, error);
            }
        });
    }

    private processStatusUpdates(statuses: StreamStatus[]): void {
        for (const status of statuses) {
            if (status.isLive) {
                this.liveCallbacks.forEach(cb => cb(status));
            } else {
                this.offlineCallbacks.forEach(cb => cb(status));
            }
        }
    }

    private isResolutionStale(resolved: ResolvedStreamer): boolean {
        const staleAfterMS = 86400000;
        return Date.now() - resolved.resolvedAt.getTime() > staleAfterMS;
    }

    /**
     * TODO:
     *  Maybe make this function less jank
     */
    private async retrieveValidResolvedStreamers(names: string[]): Promise<ResolvedStreamer[]> {
        let attemptRetrieveStreamers = names.map((name) => this.resolvedStreamers.get(name));
        let validRetrievals: ResolvedStreamer[] = [];
        const invalidStreamerNames = attemptRetrieveStreamers.reduce<string[]>((acc, r, i) => {
            if (!r || this.isResolutionStale(r)) acc.push(names[i]);
            else validRetrievals.push(r);
            return acc;
        }, [])
        try {
            const newValid: Streamer[] = await this.twitchAPI.resolveStreamer(invalidStreamerNames);
            const resolvedAt = new Date();
            validRetrievals = validRetrievals.concat(newValid.map<ResolvedStreamer>(s => {
                return {...s, resolvedAt };
            }));
            this.updateResolvedStreamerCache(newValid, resolvedAt);
        } catch (error) {
            logger.error('Twitch live tracker: Error while resolving streamers:', error);
            throw error;
        }
        return validRetrievals;
    
    }
    
    private async emitModifyingEvent(event: 'add' | 'remove', streamer_name: string) {
        let streamer: Streamer = await this.retrieveValidResolvedStreamer(streamer_name);
        
        switch (event) {
            case 'add': {
                this.addCallbacks.forEach(cb => cb(streamer));
                break;
            }
            case 'remove': {
                this.removeCallbacks.forEach(cb => cb(streamer));
            }
        }
    }

    private updateResolvedStreamerCache(streamer: Streamer | Streamer[], resolvedAt: Date) {
        if (streamer instanceof Array) {
            streamer.forEach((s) => this.resolvedStreamers.set(s.name, {...s, resolvedAt }));
        } else {
            this.resolvedStreamers.set(streamer.name, {...streamer, resolvedAt});
        }
    }
}