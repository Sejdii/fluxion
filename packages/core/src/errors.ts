/** A mistake in how the command was used. Maps to exit code 1. */
export class UsageError extends Error {
  override readonly name = 'UsageError';
}

/** A problem with the data or its source (gh, repository, remote). Maps to exit code 2. */
export class DataError extends Error {
  override readonly name = 'DataError';
}
