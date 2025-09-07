import {Platform} from './Platform';

export interface Streamer {
  platform: Platform;
  display_name: string;
  name: string;
  id: string;
  creation_date?: Date;
}

export class StreamerEntity implements Streamer {
  constructor(
      public readonly platform: Platform, public readonly display_name: string,
      public readonly name: string, public readonly id: string,
      public readonly creation_date?: Date) {
    if (!platform || !display_name || !name || !id) {
      throw new Error(
          'Mandatory streamer fields must be initialized with values');
    }
  }

  equals(other: Streamer): boolean {
    return this.id === other.id && this.platform === other.platform;
  }

  getKey(): string {
    return `${this.name}-${this.platform}`;
  }

  toString(): string {
    return `${this.display_name} (${this.platform})`;
  }
}
