import {HelixStream} from '@twurple/api';

import {Platform} from './Platform';

export interface LiveStream {
  readonly platform: Platform;
  readonly user_id: string;
  readonly user_name: string;
  readonly user_display_name: string;
  readonly id: string;
  readonly start_date: Date;
  readonly title: string;
  readonly viewers: number;
}

export interface TwitchLiveStream extends LiveStream {
  readonly platform: Platform.Twitch;
  readonly game_id: string;
  readonly game_name: string;
  readonly type: 'live'|'vodcast'|'';
}

export namespace LiveStreamEntity {
  export function isTwitchLiveStream(stream: LiveStream):
      stream is TwitchLiveStream {
    return (stream.platform === Platform.Twitch);
  }
}

export namespace TwitchLiveStreamEntity {
  export function fromHelixStream(hs: HelixStream): TwitchLiveStream {
    return {
      platform: Platform.Twitch,
      user_id: hs.userId,
      user_name: hs.userName,
      user_display_name: hs.userDisplayName,
      id: hs.id,
      start_date: hs.startDate,
      title: hs.title,
      viewers: hs.viewers,
      game_id: hs.gameId,
      game_name: hs.gameName,
      type: hs.type
    };
  }
}
