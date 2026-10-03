export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {'no-key'|'throttled'|'auth'|'network'|'not-found'|'bad-data'} kind
   */
  constructor(message, kind) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

export function errorFromStatus(provider, status) {
  if (status === 429) return new ApiError(`${provider} rate limit reached`, 'throttled');
  if (status === 401 || status === 403) return new ApiError(`${provider} rejected the API key`, 'auth');
  if (status === 404) return new ApiError(`${provider} endpoint not found`, 'not-found');
  return new ApiError(`${provider} returned HTTP ${status}`, 'network');
}
