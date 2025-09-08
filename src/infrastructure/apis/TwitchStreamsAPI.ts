import {ApiClient} from '@twurple/api';

import {IPlatformStreamsAPI} from '../../domain/interfaces';
import {Platform, TwitchLiveStream, TwitchLiveStreamEntity} from '../../domain/models';
import {logger} from '../../utils';

export class TwitchStreamsAPI implements IPlatformStreamsAPI {
  readonly platform = Platform.Twitch;

  constructor(private api_client: ApiClient) {}

  async getStreams(streamerIds: string[]): Promise<TwitchLiveStream[]> {
    if (streamerIds.length === 0) return [];
    try {
      const streams =
          await this.api_client.streams.getStreamsByUserIds(streamerIds);
      return streams.map(hs => TwitchLiveStreamEntity.fromHelixStream(hs));
    } catch (error) {
      logger.error('TwitchStreamsAPI: Error getting streams:', error);
      throw error;
    }
  }
}