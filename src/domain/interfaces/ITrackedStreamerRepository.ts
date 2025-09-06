import { Streamer, Platform } from '../models';

export interface ITrackedStreamerRepository {
    save(streamer: Streamer): Promise<void>;
    findByName(name: string): Promise<Streamer[]>;
    findByPlatform(platform: Platform): Promise<Streamer[]>;
    findByKey(name: string, platform: Platform): Promise<Streamer | null>;
    getAll(): Promise<Streamer[]>;
    delete(name: string, platform: Platform): Promise<boolean>;
    exists(name: string, platform: Platform): Promise<boolean>;
}