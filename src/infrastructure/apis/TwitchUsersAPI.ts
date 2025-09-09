import {ApiClient} from '@twurple/api';

import {IPlatformUsersAPI} from '../../domain/interfaces';
import {Platform, TwitchUser, TwitchUserEntity} from '../../domain/models';
import {logger} from '../../utils';


export class TwitchUsersAPI implements IPlatformUsersAPI {
  readonly platform = Platform.Twitch;
  private cache = new Map < string, {
    user: TwitchUser|null;
    timestamp: number
  }
  >();
  constructor(private api_client: ApiClient) {}

  async getUsers(names: string[]): Promise<TwitchUser[]> {
    if (names.length === 0) return [];
    try {
      const users = await this.api_client.users.getUsersByNames(names);
      return users.map(u => TwitchUserEntity.fromHelixUser(u));
    } catch (error) {
      logger.error(`TwitchUsersAPI: Error resolving '${names}':`, error);
      throw error;
    }
  }
  async getUser(name: string): Promise<TwitchUser|null> {
    if (!name) return null;
    const name_lower = name.toLowerCase();
    const cache_entry = this.cache.get(name_lower);

    if (cache_entry !== undefined && this.isCacheValid(cache_entry.timestamp)) {
      return cache_entry.user;
    }

    try {
      const user = await this.api_client.users.getUserByName(name_lower);
      const twitchStreamer =
          user !== null ? TwitchUserEntity.fromHelixUser(user) : null;

      this.cache.set(name_lower, {user: twitchStreamer, timestamp: Date.now()});

      return twitchStreamer;
    } catch (error) {
      logger.error(`TwitchUsersAPI: Error resolving '${name}':`, error);
      throw error;
    }
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < 60 * 60 * 1000;
  }
}