import { ChatMessage } from '../models';

export interface IBotCommandMiddleware {
    canExecute(message: ChatMessage): boolean;
}