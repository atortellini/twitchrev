import {Platform, PlatformLiveStream} from '../../models';

export interface IPlatformStreamsAPI<P extends Platform> {
  readonly platform: P;
  getStreams(streamerIds: string[]): Promise<PlatformLiveStream<P>[]>;
}