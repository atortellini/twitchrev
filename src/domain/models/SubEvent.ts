import {Platform} from './Platform';

export interface UserInfo {
  readonly id: string;
  readonly name: string;
}
export interface SubEvent {
  readonly platform: Platform;
  readonly broadcaster: UserInfo;
  readonly timestamp: Date;
}

/**
 * TODO:
 * TWITCH SUB EVENT DOES NOT INCLUDE THE MESSAGE PROVIDED WITH THE SUB AS
 * NOT REALLY SURE IF TO HAVE IT IN BASE EVENT OR FOR PARTICULAR
 * EVENTS WHEN A MESSAGE IS EXPECTED (LIKE A RESUB OR NEW SUB).
 * THIS IS BECAUSE TWITCHAPI HAS MESSAGE AS A BASE PART OF THE
 * NOTIFICATION
 * (https://dev.twitch.tv/docs/eventsub/eventsub-reference/#channel-chat-notification-event)
 */

export type TwitchSubEventType = 'sub'|'resub'|'sub_gift'|'community_sub_gift'|
    'gift_paid_upgrade'|'prime_paid_upgrade';

export type TwitchAnySubEvent = TwitchSubEvent|TwitchResubEvent|
    TwitchSubGiftEvent|TwitchCommunitySubGiftEvent|TwitchGiftPaidUpgradeEvent|
    TwitchPrimePaidUpgradeEvent;


export interface TwitchBaseSubEvent extends SubEvent {
  readonly platform: Platform.Twitch;
  readonly type: TwitchSubEventType;
}


export interface TwitchSubEvent extends TwitchBaseSubEvent {
  readonly type: 'sub';
  readonly tier: 1|2|3;
  readonly subscriber: UserInfo;
  readonly isPrime: boolean;
}

export type TwitchResubEvent = TwitchResubEventRegular|TwitchResubEventGift;

export interface TwitchResubEventRegular extends TwitchBaseSubEvent {
  readonly type: 'resub';
  readonly tier: 1|2|3;
  readonly subscriber: UserInfo;
  readonly isPrime: boolean;
  readonly cumulative_months: number;
  readonly duration_months: number;
  readonly streak_months?: number;
  readonly isGift: false;
}

export type TwitchResubEventGift =
    TwitchResubEventGiftAnonymous|TwitchResubEventGiftNamed;

export interface TwitchResubEventGiftAnonymous extends TwitchBaseSubEvent {
  readonly type: 'resub';
  readonly tier: 1|2|3;
  readonly subscriber: UserInfo;
  readonly isPrime: boolean;
  readonly cumulative_months: number;
  readonly duration_months: number;
  readonly streak_months?: number;
  readonly isGift: true;
  readonly gifter_is_anonymous: true;
}

export interface TwitchResubEventGiftNamed extends TwitchBaseSubEvent {
  readonly type: 'resub';
  readonly tier: 1|2|3;
  readonly subscriber: UserInfo;
  readonly isPrime: boolean;
  readonly cumulative_months: number;
  readonly duration_months: number;
  readonly streak_months?: number;
  readonly isGift: true;
  readonly gifter_is_anonymous: false;
  readonly gifter: UserInfo;
}

export type TwitchSubGiftEvent =
    TwitchSubGiftEventAnonymous|TwitchSubGiftEventNamed;

export interface TwitchSubGiftEventAnonymous extends TwitchBaseSubEvent {
  readonly type: 'sub_gift';
  readonly tier: 1|2|3;
  readonly recipient: UserInfo;
  readonly gifter_is_anonymous: true;

  readonly community_gift_id?: string;
}

export interface TwitchSubGiftEventNamed extends TwitchBaseSubEvent {
  readonly type: 'sub_gift';
  readonly tier: 1|2|3;
  readonly recipient: UserInfo;
  readonly gifter_is_anonymous: false;
  readonly gifter: UserInfo;

  readonly community_gift_id?: string;
}

export type TwitchCommunitySubGiftEvent =
    TwitchCommunitySubGiftEventAnonymous|TwitchCommunitySubGiftEventNamed;

export interface TwitchCommunitySubGiftEventAnonymous extends
    TwitchBaseSubEvent {
  readonly type: 'community_sub_gift';
  readonly tier: 1|2|3;
  readonly gifter_is_anonymous: true;
  readonly id: string;
  readonly total: number;
}

export interface TwitchCommunitySubGiftEventNamed extends TwitchBaseSubEvent {
  readonly type: 'community_sub_gift';
  readonly tier: 1|2|3;
  readonly gifter_is_anonymous: false;
  readonly gifter: UserInfo;
  readonly id: string;
  readonly total: number;
  readonly cumulative_total: number;
}
/**
 * TODO: NOT SURE WHAT THIS EVENT MEANS FROM TWITCH API
 */
export type TwitchGiftPaidUpgradeEvent =
    TwitchGiftPaidUpgradeEventAnonymous|TwitchGiftPaidUpgradeEventNamed;

export interface TwitchGiftPaidUpgradeEventAnonymous extends
    TwitchBaseSubEvent {
  readonly type: 'gift_paid_upgrade';
  readonly gifter_is_anonymous: true;
}

export interface TwitchGiftPaidUpgradeEventNamed extends TwitchBaseSubEvent {
  readonly type: 'gift_paid_upgrade';
  readonly gifter_is_anonymous: false;
  readonly gifter: UserInfo;
}

export interface TwitchPrimePaidUpgradeEvent extends TwitchBaseSubEvent {
  readonly type: 'prime_paid_upgrade';
  readonly tier: 1|2|3;
  readonly subscriber: UserInfo;
}

/**
 * TODO: DOESTNT INCLUDE PAY IT FORWARD EVENT FROM TWITCHAPI I DONT REALLY KNOW
 * WHAT THAT IS
 */

export namespace SubEventGuards {
  export namespace Twitch {
    export function isTwitchBaseSubEvent(event: SubEvent):
        event is TwitchBaseSubEvent {
      return event.platform === Platform.Twitch;
    }

    export function isTwitchSubEvent(event: TwitchBaseSubEvent):
        event is TwitchSubEvent {
      return event.type === 'sub';
    }

    export function isTwitchResubEvent(event: TwitchBaseSubEvent):
        event is TwitchResubEvent {
      return event.type === 'resub';
    }

    export function isTwitchResubEventRegular(event: TwitchResubEvent):
        event is TwitchResubEventRegular {
      return !event.isGift;
    }

    export function isTwitchResubEventGift(event: TwitchResubEvent):
        event is TwitchResubEventGift {
      return event.isGift;
    }

    export function isTwitchResubEventGiftAnonymous(
        event: TwitchResubEventGift): event is TwitchResubEventGiftAnonymous {
      return event.gifter_is_anonymous;
    }

    export function isTwitchResubEventGiftNamed(event: TwitchResubEventGift):
        event is TwitchResubEventGiftNamed {
      return !event.gifter_is_anonymous;
    }


    export function isTwitchSubGiftEvent(event: TwitchBaseSubEvent):
        event is TwitchSubGiftEvent {
      return event.type === 'sub_gift';
    }

    export function isTwitchSubGiftEventAnonymous(event: TwitchSubGiftEvent):
        event is TwitchSubGiftEventAnonymous {
      return event.gifter_is_anonymous;
    }

    export function isTwitchSubGiftEventNamed(event: TwitchSubGiftEvent):
        event is TwitchSubGiftEventNamed {
      return !event.gifter_is_anonymous;
    }

    export function isTwitchCommunitySubGiftEvent(event: TwitchBaseSubEvent):
        event is TwitchCommunitySubGiftEvent {
      return event.type === 'community_sub_gift';
    }

    export function isTwitchCommunitySubGiftEventAnonymous(
        event: TwitchCommunitySubGiftEvent):
        event is TwitchCommunitySubGiftEventAnonymous {
      return event.gifter_is_anonymous;
    }

    export function isTwitchCommunitySubGiftEventNamed(
        event: TwitchCommunitySubGiftEvent):
        event is TwitchCommunitySubGiftEventNamed {
      return !event.gifter_is_anonymous;
    }

    export function isTwitchGiftPaidUpgradeEvent(event: TwitchBaseSubEvent):
        event is TwitchGiftPaidUpgradeEvent {
      return event.type === 'gift_paid_upgrade';
    }

    export function isTwitchGiftPaidUpgradeEventAnonymous(
        event: TwitchGiftPaidUpgradeEvent):
        event is TwitchGiftPaidUpgradeEventAnonymous {
      return event.gifter_is_anonymous;
    }

    export function isTwitchGiftPaidUpgradeEventNamed(
        event: TwitchGiftPaidUpgradeEvent):
        event is TwitchGiftPaidUpgradeEventNamed {
      return !event.gifter_is_anonymous;
    }

    export function isTwitchPrimePaidUpgradeEvent(event: TwitchBaseSubEvent):
        event is TwitchPrimePaidUpgradeEvent {
      return event.type === 'prime_paid_upgrade';
    }
  }
}

export namespace SubEventEntity {}

export namespace TwitchSubEventEntity {}
