import {Platform, Streamer} from '../../models';

export interface IPlatformUsersAPI {
  readonly platform: Platform;
  getUser(name: string): Promise<Streamer|null>;
  getUsers(name: string[]): Promise<Streamer[]>;
}