import {TwitchAnySubEvent} from './SubEvent';
import {TwitchUser} from './User';

export enum Platform {
  Twitch = 'twitch',
}

export type PlatformTypeMap = {
  [Platform.Twitch]: {user: TwitchUser, subevent: TwitchAnySubEvent},
};

export type PlatformUser<P extends Platform> = PlatformTypeMap[P]['user'];
export type PlatformSubEvent<P extends Platform> =
    PlatformTypeMap[P]['subevent'];

export const SUPPORTED_PLATFORMS = Object.values(Platform);
