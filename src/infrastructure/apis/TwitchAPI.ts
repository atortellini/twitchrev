import {ApiClient} from '@twurple/api';

import {IPlatformAPIStreams, IPlatformAPIUsers} from '../../domain/interfaces';
import {LiveStream, LiveStreamEntity, Platform, Streamer, StreamerEntity} from '../../domain/models';
import {logger} from '../../utils';



export class TwitchAPI implements IPlatformAPIStreams, IPlatformAPIUsers {
  readonly platform = Platform.Twitch;

  constructor(private api_client: ApiClient) {}

  async getStreams(streamerIds: string[]): Promise<LiveStream[]> {
    if (streamerIds.length === 0) return [];
    try {
      const streams =
          await this.api_client.streams.getStreamsByUserIds(streamerIds);
      return streams.map(hs => LiveStreamEntity.fromHelixStream(hs));
    } catch (error) {
      logger.error('Twitch API: Error getting streams:', error);
      throw error;
    }
  }

  async resolveStreamer(name: string): Promise<Streamer|null> {
    if (!name) return null;
    try {
      const user = await this.api_client.users.getUserByName(name);
      if (user !== null) {
        return StreamerEntity.fromHelixUser(user);
      }
      return null;
    } catch (error) {
      logger.error(`Twitch API: Error resolving '${name}':`, error);
      throw error;
    }
  }
}