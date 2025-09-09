import {EventSubChannelChatCommunitySubGiftNotificationEvent, EventSubChannelChatGiftPaidUpgradeNotificationEvent, EventSubChannelChatNotificationEvent, EventSubChannelChatPrimePaidUpgradeNotificationEvent, EventSubChannelChatResubNotificationEvent, EventSubChannelChatSubGiftNotificationEvent, EventSubChannelChatSubNotificationEvent} from '@twurple/eventsub-base';

import {logger} from '../../utils';

import {Platform} from './Platform';
import {TwitchAnySubEvent, TwitchCommunitySubGiftEvent, TwitchGiftPaidUpgradeEvent, TwitchPrimePaidUpgradeEvent, TwitchResubEvent, TwitchSubEvent, TwitchSubGiftEvent} from './SubEvent';

function parseTier(tier: string): 1|2|3 {
  switch (tier) {
    case '1000':
      return 1;
    case '2000':
      return 2;
    case '3000':
      return 3;
    default:
      return 1;
  }
}

export namespace TwitchBaseSubEventEntity {}

export namespace TwitchSubEventEntity {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatSubNotificationEvent): TwitchSubEvent {
    return {
      platform: Platform.Twitch,
      broadcaster: {id: e.broadcasterId, name: e.broadcasterName},
      timestamp: new Date(),
      type: 'sub',
      tier: parseTier(e.tier),
      subscriber: {id: e.chatterId, name: e.chatterName},
      isPrime: e.isPrime
    };
  }
}

export namespace TwitchResubEventEntity {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatResubNotificationEvent): TwitchResubEvent {
    const base = {
      platform: Platform.Twitch,
      broadcaster: {id: e.broadcasterId, name: e.broadcasterName},
      timestamp: new Date(),
      type: 'resub' as const,
      tier: parseTier(e.tier),
      subscriber: {id: e.chatterId, name: e.chatterName},
      isPrime: e.isPrime,
      cumulative_months: e.cumulativeMonths,
      duration_months: e.durationMonths,
      streak_months: e.streakMonths ?? undefined,

    };

    if (!e.isGift) {
      return {
        ...base, isGift: false
      }
    }

    if (e.isGifterAnonymous) {
      return {...base, isGift: true, gifter_is_anonymous: true};
    }

    return {
      ...base,
      isGift: true,
      gifter_is_anonymous: false,
      gifter: {id: e.gifterId!, name: e.gifterName!}
    };
  }
}

export namespace TwitchSubGiftEventEntity {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatSubGiftNotificationEvent): TwitchSubGiftEvent {
    const base = {
      platform: Platform.Twitch,
      broadcaster: {id: e.broadcasterId, name: e.broadcasterName},
      timestamp: new Date(),
      type: 'sub_gift' as const,
      tier: parseTier(e.tier),
      recipient: {id: e.recipientId, name: e.recipientName},
      community_gift_id: e.communityGiftId ?? undefined
    };

    if (e.chatterIsAnonymous) {
      return {...base, gifter_is_anonymous: true};
    }
    return {
      ...base,
      gifter_is_anonymous: false,
      gifter: {id: e.chatterId, name: e.chatterName}
    };
  }
}

export namespace TwitchCommunitySubGiftEventEntity {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatCommunitySubGiftNotificationEvent):
      TwitchCommunitySubGiftEvent {
    const base = {
      platform: Platform.Twitch,
      broadcaster: {id: e.broadcasterId, name: e.broadcasterName},
      timestamp: new Date(),
      type: 'community_sub_gift' as const,
      tier: parseTier(e.tier),
      id: e.id,
      total: e.amount
    };

    if (e.chatterIsAnonymous) {
      return {...base, gifter_is_anonymous: true};
    }
    return {
      ...base,
      gifter_is_anonymous: false,
      gifter: {id: e.chatterId, name: e.chatterName},
      cumulative_total: e.cumulativeAmount!
    };
  }
}

export namespace TwitchGiftPaidUpgradeEventEntity {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatGiftPaidUpgradeNotificationEvent):
      TwitchGiftPaidUpgradeEvent {
    const base = {
      platform: Platform.Twitch,
      broadcaster: {id: e.broadcasterId, name: e.broadcasterName},
      timestamp: new Date(),
      type: 'gift_paid_upgrade' as const
    };

    if (e.isGifterAnonymous) {
      return {...base, gifter_is_anonymous: true};
    }
    return {
      ...base,
      gifter_is_anonymous: false,
      gifter: {id: e.gifterId!, name: e.gifterName!}
    };
  }
}

export namespace TwitchPrimePaidUpgradeEventEntity {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatPrimePaidUpgradeNotificationEvent):
      TwitchPrimePaidUpgradeEvent {
    return {
      platform: Platform.Twitch,
      broadcaster: {id: e.broadcasterId, name: e.broadcasterName},
      timestamp: new Date(),
      type: 'prime_paid_upgrade' as const,
      tier: parseTier(e.tier),
      subscriber: {id: e.chatterId, name: e.chatterName}
    };
  }
}

export namespace TwitchSubEventFactory {
  export function fromChannelChatNotificationEvent(
      e: EventSubChannelChatNotificationEvent): TwitchAnySubEvent|undefined {
    switch (e.type) {
      case 'sub': {
        return TwitchSubEventEntity.fromChannelChatNotificationEvent(e);
      }
      case 'resub': {
        return TwitchResubEventEntity.fromChannelChatNotificationEvent(e);
      }
      case 'sub_gift': {
        return TwitchSubGiftEventEntity.fromChannelChatNotificationEvent(e);
      }
      case 'community_sub_gift': {
        return TwitchCommunitySubGiftEventEntity
            .fromChannelChatNotificationEvent(e);
      }
      case 'gift_paid_upgrade': {
        logger.warn(
            'TwitchSubEventFactory: GiftPaidUpgradeEvent being created...')
        return TwitchGiftPaidUpgradeEventEntity
            .fromChannelChatNotificationEvent(e);
      }
      case 'prime_paid_upgrade': {
        return TwitchPrimePaidUpgradeEventEntity
            .fromChannelChatNotificationEvent(e);
      }
      default: {
        logger.info(
            'TwitchSubEventFactory: Ignoring ChannelChatNotifcationEvent of non-sub type');
        return undefined;
      }
    }
  }
}