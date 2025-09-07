import {Streamer} from './Streamer';

export interface LiveStream {
  streamer: Streamer;
  id: string;
  start_date: Date;
  title: string;
  game_id: string;
  game_name: string;
  viewers?: Number;
}

export class LiveStreamEntity implements LiveStream {
  constructor(
      public readonly streamer: Streamer, public readonly id: string,
      public readonly start_date: Date, public readonly title: string = '',
      public readonly game_id: string = '',
      public readonly game_name: string = '',
      public readonly viewers?: Number) {}
}
