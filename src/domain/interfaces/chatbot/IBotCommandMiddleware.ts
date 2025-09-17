import {TwitchChatCommand} from '../../models';

export interface IBotCommandMiddleware {
  canExecute(command: TwitchChatCommand): boolean;
}