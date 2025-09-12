import {HelixUser} from '@twurple/api';

import {Platform} from './Platform';

export interface User {
  readonly platform: Platform;
  readonly display_name: string;
  readonly name: string;
  readonly id: string;
}

export interface TwitchUser extends User {
  readonly platform: Platform.Twitch;
  readonly creation_date: Date;
  readonly pfp_url: string;
  readonly broadcaster_type: 'partner'|'affiliate'|'';
  readonly type: ''|'staff'|'admin'|'global_mod';
}

export namespace UserEntity {
  export function equals(t: User, o: User): boolean {
    return t.id === o.id && t.platform === o.platform
  }
  export function getKey(t: User): string {
    return `${t.name}-${t.platform}`;
  }
  export function toString(t: User): string {
    return `${t.display_name} (${t.platform})`;
  }

  export function isTwitchUser(user: User): user is TwitchUser {
    return (user.platform === Platform.Twitch);
  }

}

export namespace TwitchUserEntity {
  export function fromHelixUser(hu: HelixUser): TwitchUser {
    return {
      platform: Platform.Twitch,
      display_name: hu.displayName,
      name: hu.name,
      id: hu.id,
      creation_date: hu.creationDate,
      pfp_url: hu.profilePictureUrl,
      broadcaster_type: hu.broadcasterType,
      type: hu.type
    };
  }
}
