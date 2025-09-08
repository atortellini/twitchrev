import {LiveStream, Platform, Streamer} from '../../models';

export interface IPlatformAPIStreams {
  readonly platform: Platform;
  getStreams(streamerIds: string[]): Promise<LiveStream[]>;
}