import {ApplicationConfig} from '../presentation';

export const config: ApplicationConfig =
    {
      twitch: {
        clientId: process.env.TWITCH_CLIENT_ID!,
        clientSecret: process.env.TWITCH_CLIENT_SECRET!,
        accessToken: process.env.TWITCH_ACCESS_TOKEN!,
        refreshToken: process.env.TWITCH_REFRESH_TOKEN!,
        userId: process.env.TWITCH_ACCOUNT_USERID!,
        tokenFilePath: process.env.TWITCH_REFRESHED_TOKEN_PATH!
      },
      polling:
          {intervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '30000')},
      storage: {
        /* TODO: NOT SUPPORTED IN IMPLEMENTATION YET*/
        type: 'memory',
        filePath: undefined
      },
      bot: {channels: process.env.BOT_DEFAULT_CHANNELS?.split(',') || []}


    }

function validateConfig() {
  const required = [
    'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_ACCESS_TOKEN',
    'TWITCH_REFRESH_TOKEN', 'TWITCH_ACCOUNT_USERID',
    'TWITCH_REFRESHED_TOKEN_PATH'
  ];

  const missing = required.filter((env_var => !process.env[env_var]));

  if (missing.length > 0) {
    throw new Error(
        `Missing required envrionment variables: ${missing.join(', ')}`);
  }
}

validateConfig();