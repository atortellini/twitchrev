import { ChatMessage, ChatContext } from '../models';
import { IBotCommandMiddleware } from './IBotCommandMiddleware';

export interface IBotCommand {
    readonly trigger: string;
    readonly description: string;
    readonly usage: string;
    readonly middleware?: IBotCommandMiddleware;

    canExecute(message: ChatMessage): boolean;
    execute(args: string[], context: ChatContext): boolean;
}