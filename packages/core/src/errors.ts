export class UsageError extends Error {
  override readonly name = 'UsageError';
}

export class DataError extends Error {
  override readonly name = 'DataError';
}
