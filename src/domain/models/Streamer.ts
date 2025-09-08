import {HelixStream, HelixUser} from '@twurple/api';

import {Platform} from './Platform';

export interface Streamer {
  platform: Platform;
  display_name: string;
  name: string;
  id: string;
  creation_date?: Date;
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

  export function fromHelixUser(hu: HelixUser): Streamer {
    return {
      platform: Platform.Twitch, display_name: hu.displayName, name: hu.name,
          id: hu.id, creation_date: hu.creationDate
    }
  }
  export function fromHelixStream(hs: HelixStream): Streamer {
    return {
      platform: Platform.Twitch, display_name: hs.userDisplayName,
          name: hs.userName, id: hs.userId
    }
  }
}
