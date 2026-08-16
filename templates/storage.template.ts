/*
import type { PreferencesStorage } from '@/core/storages/preferences.storage';

const VALUE_KEY = '__KEBAB_NAME__.value';

export class __NAME__Storage {

  private readonly preferencesStorage: PreferencesStorage;

  constructor(options: { preferencesStorage: PreferencesStorage }) {
    this.preferencesStorage = options.preferencesStorage;
  }

  read(): Promise<string | null> {
    return this.preferencesStorage.readString(VALUE_KEY);
  }

  write(value: string): Promise<void> {
    return this.preferencesStorage.writeString(VALUE_KEY, value);
  }

  remove(): Promise<void> {
    return this.preferencesStorage.remove(VALUE_KEY);
  }

}
*/
