import {TwitchLiveStream} from './LiveStream';
import {TwitchAnySubEvent} from './SubEvent';
import {TwitchUser} from './User';

export enum Platform {
  Twitch = 'twitch',
}

export type PlatformTypeMap = {
  [Platform.Twitch]: {
    user: TwitchUser,
    livestream: TwitchLiveStream,
    subevent: TwitchAnySubEvent
  },
};

export type PlatformUser<P extends Platform> = PlatformTypeMap[P]['user'];
export type PlatformLiveStream<P extends Platform> =
    PlatformTypeMap[P]['livestream'];
export type PlatformSubEvent<P extends Platform> =
    PlatformTypeMap[P]['subevent'];

export const SUPPORTED_PLATFORMS = Object.values(Platform);
