import {HelixStream} from '@twurple/api';

import {Streamer, StreamerEntity} from './Streamer';

export interface LiveStream {
  streamer: Streamer;
  id: string;
  start_date: Date;
  title: string;
  game_id: string;
  game_name: string;
  viewers?: Number;
}

export namespace LiveStreamEntity {
  export function fromHelixStream(hs: HelixStream): LiveStream {
    return {
      streamer: StreamerEntity.fromHelixStream(hs), id: hs.id,
          start_date: hs.startDate, title: hs.title, game_id: hs.gameId,
          game_name: hs.gameName, viewers: hs.viewers
    }
  }
}
