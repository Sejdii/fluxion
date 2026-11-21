export interface Cache<V> {
  get(key: string): Promise<V | undefined>;
  set(key: string, value: V): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryCache<V> implements Cache<V> {
  private readonly entries = new Map<string, V>();

  get(key: string): Promise<V | undefined> {
    return Promise.resolve(this.entries.get(key));
  }

  set(key: string, value: V): Promise<void> {
    this.entries.set(key, value);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }
}
