import { Platform, Streamer } from "../models";

export interface IPlatformStreamerInfoAPI {
    readonly platform: Platform;
    resolveStreamerName(name: string): Promise<Streamer>;
}