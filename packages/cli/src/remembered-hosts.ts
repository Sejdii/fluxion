export interface RememberedHosts {
  using<T>(find: (hosts: string[]) => Promise<T>): Promise<T>;
}

export function rememberedHosts(load: () => Promise<string[]>): RememberedHosts {
  let hosts: Promise<string[]> | undefined;
  return {
    using: async (find) => {
      try {
        return await find(await (hosts ??= load()));
      } catch (error) {
        hosts = undefined;
        throw error;
      }
    },
  };
}
