export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = items.entries();
  let failed = false;
  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) {
      if (failed) return;
      try {
        results[index] = await task(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
