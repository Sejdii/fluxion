export const LOW_SAMPLE_THRESHOLD = 5;

export function isLowSample(mergedPullRequests: number): boolean {
  return mergedPullRequests < LOW_SAMPLE_THRESHOLD;
}
