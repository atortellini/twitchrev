import { Platform, Streamer } from "../models";
import { IPlatformSubEventTracker } from "./IPlatformSubEventTracker";

export interface IStreamersSubEventManager {
    startTracking(streamer: Streamer): Promise<void>;
    stopTracking(streamer: Streamer): Promise<void>;
    /**
     * TODO:
     *  Not sure if I want startTracking overloaded to work for being called with jsut
     *  the streamer name and their platform
     */
    
    /**
     * TODO:
     *  Not sure if I want to keep addtrackingprovider as part of
     * the interface or instead just in my implementation have them passed
     * to the constructor like in my livestatusmanager
     * 
     */
    addTrackingProvider(tracker: IPlatformSubEventTracker): void;
}