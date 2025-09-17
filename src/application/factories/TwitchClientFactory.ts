import {ApiClient} from '@twurple/api';
import {RefreshingAuthProvider} from '@twurple/auth';
import {ChatClient} from '@twurple/chat';
import {EventSubWsListener} from '@twurple/eventsub-ws';
import {promises as fs} from 'fs';
import path from 'path';

import {logger} from '../../utils';


export interface TwitchConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  tokenFilePath: string;
}

export interface TwitchClients {
  api: ApiClient;
  chat: ChatClient;
  events: EventSubWsListener;
}

export class TwitchClientFactory {
  static async create(config: TwitchConfig): Promise<TwitchClients> {
    try {
      const authProvider = new RefreshingAuthProvider(
          {clientId: config.clientId, clientSecret: config.clientSecret});

      authProvider.onRefresh(async (userId, new_token_data) => {
        logger.info(`Twitch token refreshed for user: ${userId}`);
        try {
          const filepath = path.resolve(config.tokenFilePath);
          await fs.writeFile(
              filepath, JSON.stringify(new_token_data, null, 2), 'utf-8');
          logger.info(`Saved new token data to ${filepath}`);
        } catch (error) {
          logger.error(`Failed to persist refreshed token:`, error);
        }
      });

      await authProvider.addUserForToken(
          {
            accessToken: config.accessToken,
            refreshToken: config.refreshToken,
            expiresIn: null,
            obtainmentTimestamp: 0
          },
          ['chat']);


      const _api_client = new ApiClient({authProvider});
      const _chat_client = new ChatClient({authProvider});
      const _eventsub_ws = new EventSubWsListener({apiClient: _api_client});

      logger.info('Twitch providers created successfully');

      return {
        api: _api_client,
        chat: _chat_client,
        events: _eventsub_ws,
      };
    } catch (error) {
      logger.error('Failed to create Twitch providers', error);
      throw error;
    }
  }
}