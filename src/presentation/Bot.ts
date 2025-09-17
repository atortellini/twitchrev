import {ChatClient, ChatMessage} from '@twurple/chat';

import {IBotCommand} from '../domain/interfaces/chatbot';
import {TwitchChatMessageEntity} from '../domain/models';
import {logger} from '../utils';

type CommandTrigger = string;

export class Bot {
  private command_map: Map<CommandTrigger, IBotCommand>;
  static readonly logger_tag = '[CHATBOT]';
  constructor(
      commands: IBotCommand[], private chat_client: ChatClient,
      private channels: string[]) {
    this.command_map = new Map(commands.map(c => [c.trigger, c]));
    logger.warn(`${
        Bot.logger_tag} Incomplete implementation; not all events of chatclient are handled`);
  }
  async start(): Promise<void> {
    logger.info(`${Bot.logger_tag} Starting...`);
    this.chat_client.onConnect(() => {
      this.actionOnAllChannels((c) => this.chat_client.join(c), 'Join')
          .then(() => logger.info(`${Bot.logger_tag} Started`));
    });
    this.chat_client.onMessage(
        (ch, usr, txt, msg) => this.handleTwurpleMessage(ch, usr, txt, msg));

    this.chat_client.connect();
  }

  async stop(): Promise<void> {
    logger.info(`${Bot.logger_tag} Stopping...`);
    this.chat_client.onDisconnect(() => {
      logger.info(`${Bot.logger_tag} Stopped`);
    });

    this.chat_client.quit();
  }


  private async actionOnAllChannels(
      action: (channel: string) => Promise<void>, action_log_name: string) {
    const settled =
        await Promise.allSettled(this.channels.map(channel => action(channel)));
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        logger.info(
            `${Bot.logger_tag} '${this.channels[i]}' - ${action_log_name}`);
      } else {
        logger.info(
            `${Bot.logger_tag} '${this.channels[i]} - ${
                action_log_name} (FAILED):`,
            r.reason);
      }
    });
  }


  private async handleTwurpleMessage(
      channel: string, user: string, text: string,
      msg: ChatMessage): Promise<void> {
    const message = TwitchChatMessageEntity.fromTwurpleMessageEvent(
        channel, user, text, msg);
    if (!TwitchChatMessageEntity.isCommand(message)) return;

    const cmd_invoke = TwitchChatMessageEntity.getCommand(message)!;

    const executor = this.command_map.get(cmd_invoke.trigger);

    if (!executor) {
      logger.info(
          `${Bot.logger_tag} '${cmd_invoke.user}' attempted to invoke '${
              cmd_invoke.trigger}'; command does not exist`);
      return;
    }

    if (!executor.canExecute(cmd_invoke)) {
      logger.info(
          `${Bot.logger_tag} '${cmd_invoke.user}' attempted to invoke '${
              cmd_invoke.trigger}; user does not have permission'`);
      return;
    }

    try {
      const response = await executor.execute(cmd_invoke);

      if (response) {
        await this.chat_client.say(
            cmd_invoke.channel, response, {replyTo: cmd_invoke.context});
      }

      logger.info(`${Bot.logger_tag} Executed command '${
          cmd_invoke.trigger}' invoked by '${cmd_invoke.user}'`);
    } catch (error) {
      logger.error(
          `${Bot.logger_tag} Error exeucting command '${
              cmd_invoke.trigger}' invoked by '${cmd_invoke.user}':`,
          error);

      try {
        await this.chat_client.say(
            cmd_invoke.channel,
            'F@$#!....error while processing your commmand.',
            {replyTo: cmd_invoke.context});
      } catch (send_error) {
        logger.error(
            `${Bot.logger_tag} Failed to send error message:`, send_error);
      }
    }
  }
}