export interface ChatContext {
    channelId: string;
    channelName: string;
    userId: string;
    username: string;
    isModerator: boolean;
    isBroadcaster: boolean;
}

export interface ChatMessage {
    content: string;
    context: ChatContext;
}

export class ChatMessageEntity implements ChatMessage {
    constructor(
        public readonly content: string,
        public readonly context: ChatContext,
        public readonly timestamp: Date = new Date()
    ) {}

    isCommand(prefix: string = '$'): boolean {
        return this.content.startsWith(prefix)
    }

    getCommand(prefix: string = '$'): string {
        if (!this.isCommand(prefix)) return '';
        return this.content.split(' ', 1)[0].substring(prefix.length);
    }

    getArgs(prefix: string = '$'): string[] {
        if (!this.isCommand(prefix)) return [];
        return this.content.split(' ').slice(1);
    }
}