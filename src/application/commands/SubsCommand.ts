import {IBotCommand, IPlatformUsersAPI} from '../../domain/interfaces';
import {Platform, SUPPORTED_PLATFORMS, TwitchChatCommand} from '../../domain/models';
import {CreatorMiddleware} from '../middleware/CreatorMiddleware';
import {ILiveStreamSessionMetricsProvider, SessionMetricsFormatter} from '../services/LiveStreamsSessionMetricsCoordinator';

export class SubsCommand implements IBotCommand {
  readonly trigger = 'subs';
  readonly description = 'Query the number of subs earned for a live streamer';
  readonly usage = '$subs <username> [<platform=twitch>]';
  readonly middleware = CreatorMiddleware;

  constructor(
      private readonly stream_metrics_provider:
          ILiveStreamSessionMetricsProvider<Platform>,
      private readonly twitch_api: IPlatformUsersAPI<Platform.Twitch>) {}

  canExecute(command: TwitchChatCommand): boolean {
    return (
        (this.trigger === command.trigger) &&
        this.middleware.canExecute(command));
  }

  async execute(command: TwitchChatCommand): Promise<string> {
    const args_str = command.rest;

    if (!args_str) {
      return `Usage: ${this.usage}`;
    }

    const args = args_str.split(' ');

    const validNumArgs = ((args.length === 1) || (args.length === 2));

    if (!validNumArgs) {
      return `Usage: ${this.usage}`;
    }

    const [username, platform_str] = args;

    const platform = platform_str?.toLowerCase() as Platform || Platform.Twitch;


    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return `Unsupported platform. Supported platforms: ${
          SUPPORTED_PLATFORMS.join(', ')}`;
    }

    const user = await this.twitch_api.getUser(username);
    if (!user) {
      return `Unknown user ${username} on ${platform}`;
    }

    const metrics = this.stream_metrics_provider.getSessionMetrics(user);

    if (!metrics) {
      return `Metrics are not being tracked for ${user.name} on ${
          user.platform}`;
    }

    return SessionMetricsFormatter.formatTwitchSessionMetrics(
        user.name, metrics);
  }
}
