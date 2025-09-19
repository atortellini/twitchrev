import {IBotCommand} from '../../domain/interfaces/chatbot';
import {IPlatformUsersAPI} from '../../domain/interfaces/platform';
import {IStreamersLiveStatusManager, IStreamersSubEventManager} from '../../domain/interfaces/streamers';
import {Platform, SUPPORTED_PLATFORMS, TwitchChatCommand} from '../../domain/models';
import {CreatorMiddleware} from '../middleware/CreatorMiddleware';

export class TrackCommand implements IBotCommand {
  readonly trigger = 'track';
  readonly description = 'Track a streamer';
  readonly usage =
      '$track {start|stop} <username>[,<username>...] [<platform=twitch>]';
  readonly middleware = CreatorMiddleware;

  constructor(
      private readonly live_status_manager:
          IStreamersLiveStatusManager<Platform>,
      private readonly subevent_manager: IStreamersSubEventManager<Platform>,
      private readonly twitch_api: IPlatformUsersAPI<Platform.Twitch>) {}
  canExecute(command: TwitchChatCommand): boolean {
    return (
        (this.trigger === command.trigger) &&
        this.middleware.canExecute(command));
  }

  async execute(command: TwitchChatCommand): Promise<string> {
    const args = command.rest.split(' ');

    const validNumArgs = ((args.length === 2) || (args.length === 3));

    if (!validNumArgs) {
      return `Usage: ${this.usage}`
    }

    const [directive, usernames_csv, platform_str] = args;

    const platform = platform_str?.toLowerCase() as Platform || Platform.Twitch;

    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return `Unsupported platform. Supported platforms: ${
          SUPPORTED_PLATFORMS.join(', ')}`;
    }

    const isValidDirective =
        ((directive === 'start') || (directive === 'stop'));

    if (!isValidDirective) {
      return `Usage: ${this.usage}`
    }

    const usernames = usernames_csv.split(',');

    const users =
        await Promise.all(usernames.map(name => this.twitch_api.getUser(name)));


    for (let i = 0; i < users.length; i++) {
      if (!users[i]) {
        return `Unknown user '${usernames[i]}' for platform '${platform}'`;
      }
    }

    const [live_action, subevent_action] = directive === 'start' ?
        [
          this.live_status_manager.startTracking.bind(this.live_status_manager),
          this.subevent_manager.startTracking.bind(this.subevent_manager)
        ] :
        [
          this.live_status_manager.stopTracking.bind(this.live_status_manager),
          this.subevent_manager.stopTracking.bind(this.subevent_manager)
        ];

    const results = await Promise.allSettled(users.map(
        user => Promise.all([live_action(user!), subevent_action(user!)])));

    const rejected = results.filter((p) => p.status === 'rejected');
    if (rejected.length > 0) {
      const reasons = rejected.map(r => String(r.reason)).join('; ');
      throw new Error(
          `Failed to ${directive} tracking for some users: ${reasons}`);
    }

    return `${directive === 'start' ? 'Now' : 'Stopped'} tracking user${
        usernames.length > 1 ? 's' :
                               ''}: ${usernames.join(', ')} on ${platform}`;
  }
}
