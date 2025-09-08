import {HelixStream, HelixUser} from '@twurple/api';

import {Platform} from './Platform';

export interface Streamer {
  readonly platform: Platform;
  readonly display_name: string;
  readonly name: string;
  readonly id: string;
}

export interface TwitchStreamer extends Streamer {
  readonly platform: Platform.Twitch;
  readonly creation_date: Date;
  readonly pfp_url: string;
  readonly broadcaster_type: 'partner'|'affiliate'|'';
  readonly type: ''|'staff'|'admin'|'global_mod';
}

export namespace StreamerEntity {
  export function equals(t: Streamer, o: Streamer): boolean {
    return t.id === o.id && t.platform === o.platform
  }
  export function getKey(t: Streamer): string {
    return `${t.name}-${t.platform}`;
  }
  export function toString(t: Streamer): string {
    return `${t.display_name} (${t.platform})`;
  }

}

export namespace TwitchStreamerEntity {
  export function fromHelixUser(hu: HelixUser): TwitchStreamer {
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
