import {LiveStream, Platform} from '../../models';

export interface IPlatformStreamsAPI {
  readonly platform: Platform;
  getStreams(streamerIds: string[]): Promise<LiveStream[]>;
}