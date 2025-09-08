import {Platform, Streamer} from '../../models';

export interface IPlatformAPIUsers {
  readonly platform: Platform;
  resolveStreamer(name: string): Promise<Streamer|null>;
}