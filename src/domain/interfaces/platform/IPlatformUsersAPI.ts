import {Platform, PlatformUser} from '../../models';

export interface IPlatformUsersAPI<P extends Platform> {
  readonly platform: P;
  getUser(name: string): Promise<PlatformUser<P>|null>;
  getUsers(name: string[]): Promise<PlatformUser<P>[]>;
}