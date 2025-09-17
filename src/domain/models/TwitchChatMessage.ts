import {ChatMessage} from '@twurple/chat';

export interface TwitchChatMessage {
  readonly channel: string;
  readonly user: string;
  readonly content: string;
  readonly context: ChatMessage;
}

export interface TwitchChatCommand extends TwitchChatMessage {
  readonly prefix: string;
  readonly trigger: string;
  readonly rest: string;
}

export namespace TwitchChatMessageEntity {
  export function fromTwurpleMessageEvent(
      channel: string, user: string, text: string,
      msg: ChatMessage): TwitchChatMessage {
    return {channel, user, content: text, context: msg};
  }

  export function isCommand(msg: TwitchChatMessage, prefix: string = '$'):
      boolean {
    return msg.content.startsWith(prefix);
  }

  export function getCommand(msg: TwitchChatMessage, prefix: string = '$'):
      TwitchChatCommand|null {
    if (!TwitchChatMessageEntity.isCommand(msg, prefix)) return null;
    const tmp = msg.content.split(' ');
    return {
      prefix,
      trigger: tmp[0].substring(prefix.length),
      rest: tmp.slice(1).join(' '),
      ...msg
    };
  }
}