/*
import type { ApiManager } from '@/core/managers/api.manager';

const PATH = '/__KEBAB_NAME__/ping';

export class Ping__NAME__Api {

  private readonly apiManager: ApiManager;

  constructor(options: { apiManager: ApiManager }) {
    this.apiManager = options.apiManager;
  }

  async call(options: { signal?: AbortSignal } = {}): Promise<boolean> {
    const response = await this.apiManager.get(PATH, { signal: options.signal });
    return response.statusCode === 200;
  }

}
*/
