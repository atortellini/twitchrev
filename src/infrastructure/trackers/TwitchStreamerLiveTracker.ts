import { IPlatformStreamerLiveTracker } from "../../domain/interfaces";
import { Platform, Streamer, StreamStatus } from "../../domain/models";
import { logger } from "../../utils";
import { Strand } from "../../utils";
import { Mutex } from "../../utils";

interface ResolvedStreamer extends Streamer {
    resolvedAt: Date;
}

export class TwitchStreamerLiveTracker implements IPlatformStreamerLiveTracker {
    readonly platform = Platform.Twitch;

    private resolvedCacheMutex = new Mutex();
    private trackedStreamerMutex = new Mutex('_tw_trckd_strmr');
    private strandStartStop = new Strand('_tw_live_start_stop');
    private isRunning = false;
    private trackedStreamers = new Set<string>();
    private resolvedStreamers = new Map<string, ResolvedStreamer>();

    private liveCallbacks: Array<(status: StreamStatus) => void> = [];
    private offlineCallbacks: Array<(status: StreamStatus) => void> = [];
    private addCallbacks: Array<(streamer: Streamer) => void> = [];
    private removeCallbacks: Array<(streamer: Streamer) => void> = [];
    
    private pollingTimeout: NodeJS.Timeout | null = null;


    constructor(
        private twitchAPI: TwitchApi,
        private pollingIntervalMs: number = 60000
    ) {}

    async addStreamer(name: string): Promise<void> {
        if (this.isRunning) {
            await this.trackedStreamerMutex.acquire();
            /**
             * TODO:
             *  Think about whether it would
             *  work if add/remove/poll were executed
             *  on their own strand
             */
        }
        const s = name.toLowerCase();
        this.trackedStreamers.add(s);
        logger.info(`Twitch live tracker: Added ${name}`);
    }

    async removeStreamer(name: string): Promise<boolean> {
        const lower = name.toLowerCase();
        await this.trackedStreamerMutex.acquire();
        const removed = this.trackedStreamers.delete(name.toLowerCase());
        if (removed) {
            logger.info(`Twitch live tracker: Removed ${name}`);
        }
        this.trackedStreamerMutex.release();
        return removed;
    }

    async getTrackedStreamers(): Promise<Streamer[]> {
        await this.resolvedCacheMutex.acquire();
        const streamers: Streamer[] = [];

        let unresolvedOrStaleStreamers = Array.from(this.trackedStreamers.values())
            .map((s) => this.resolvedStreamers.get(s))
            .filter((resolved) => (!resolved || this.isResolutionStale(resolved)));
        

        for (const streamer of this.trackedStreamers) {
            let resolved = this.resolvedStreamers.get(streamer);
            if (!resolved || this.isResolutionStale(resolved)) {
                resolved = await this.resolveStreamer(streamer)
            }
        }
        return Array.from(this.trackedStreamers.values());
    }

    async isTracking(name: string): Promise<boolean> {
        return this.trackedStreamers.has(name.toLowerCase());
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

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Ignoring attempt to start Twitch live tracker when it is already running...');
        } else {
            this.isRunning = true;
            return this.strandStartStop.post(async () => {
                logger.info('Starting Twitch live tracker');
                await this.poll();
                const repeatedPolling = () => {
                    this.poll()
                        .catch((error) => {
                            logger.error('Error during Twitch polling:', error);
                        })
                        .finally(() => {
                            if (this.isRunning) 
                                this.pollingTimeout = setTimeout(repeatedPolling, this.pollingIntervalMs);
                        })
                }
                this.pollingTimeout = setTimeout(repeatedPolling, this.pollingIntervalMs);
                setTimeout()
            });
        }
    }

    async stop(): Promise<void> {
        if (this.isRunning) {
            this.isRunning = false;
            return this.strandStartStop.post(async () => {
                if (this.pollingTimeout) {
                    clearTimeout(this.pollingTimeout);
                    this.pollingTimeout = null;
                }
                logger.info('Stopped Twitch live tracker');
            })
        }

        logger.warn("Ignoring attempt to stop Twitch live tracker while it wasn't running...");
        
    }

    private async poll() {
        await this.trackedStreamerMutex.acquire();
        if (this.trackedStreamers.size === 0) return;

        const streamerNames = Array.from(this.trackedStreamers.values());

        try {
            const statuses = await this.twitchAPI.checkLiveStatus(streamerNames);
            this.processStatusUpdates(statuses);
        } catch (error) {
            logger.error(`Error polling Twitch:`, error);
        } finally {
            this.trackedStreamerMutex.release();
        }
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

    private async resolveStreamers(names: string[]): Promise<ResolvedStreamer[]> {

    }
}