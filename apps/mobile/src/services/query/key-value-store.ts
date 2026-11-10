/**
 * Where the persisted server cache lives: the contract of the TanStack persister (D6). The real one is
 * the separate `sacou-cache.db`, never the court's `sacou.db`.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
