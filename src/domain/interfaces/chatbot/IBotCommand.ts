import {TwitchChatCommand} from '../../models';

import {IBotCommandMiddleware} from './IBotCommandMiddleware';

export interface IBotCommand {
  readonly trigger: string;
  readonly description: string;
  readonly usage: string;
  readonly middleware?: IBotCommandMiddleware;

  canExecute(command: TwitchChatCommand): boolean;
  execute(command: TwitchChatCommand): Promise<string>;
}