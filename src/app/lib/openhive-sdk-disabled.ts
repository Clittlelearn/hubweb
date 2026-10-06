export { ethers } from 'ethers';

const SDK_DISABLED_MESSAGE =
  'HiveX SDK is temporarily disabled. Read-only account queries are still available.';

export class OpenHiveSdk {
  static async create(_options?: unknown): Promise<any> {
    throw new Error(SDK_DISABLED_MESSAGE);
  }
}
