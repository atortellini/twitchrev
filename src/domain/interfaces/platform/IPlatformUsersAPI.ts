import {Platform, User} from '../../models';

export interface IPlatformUsersAPI {
  readonly platform: Platform;
  getUser(name: string): Promise<User|null>;
  getUsers(name: string[]): Promise<User[]>;
}