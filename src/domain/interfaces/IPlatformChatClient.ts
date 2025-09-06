import { ChatMessage, Platform } from '../models';

export interface IPlatformChatClient {
    readonly platform: Platform;
    connect(channels: string[]): Promise<void>;
    disconnect(channels?: string[]): Promise<void>;
    sendMessage(channel: string, message: string): Promise<void>;
    onMessage(callback: (message: ChatMessage) => void): void;

    /* Platform dependent if functionality like this exists */
    replyMessage?(reply_target: ChatMessage, message: string): Promise<void>;
}