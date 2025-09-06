import { SubEvent } from '../models';

export interface IStreamersSubEventProvider {
    onSubEvent(callback: (event: SubEvent) => void): void;

    /**
     * TODO:
     *  Not sure how I feel about mandating the provider interface to have a
     * method to retrieve the subCount of a given streamer, might be something that can be
     * buit off the interface but not strictly part of the subeventprovider.
     * The subevent provider seems to be more strictly providing subevents for a set of streamers,
     * I'm favoring removing it so I will comment it out for now.
     */
    // getSubCount(streamer: Streamer): Promise<number>;
}

