import {TwitchChatCommand} from '../../domain/models';

export namespace CreatorMiddleware {
  export function canExecute(cmd: TwitchChatCommand): boolean {
    return cmd.user.toLowerCase() === '';
  }
}