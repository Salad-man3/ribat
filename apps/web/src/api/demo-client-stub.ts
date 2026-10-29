/** Production web never calls this. The demo Vite config aliases `@demo/client` to the real bridge. */
export function demoApiFetch<T>(_path: string, _init: RequestInit = {}): Promise<T> {
  return Promise.reject(new Error('Demo client is only available in the demo build'));
}

export function resetDemoSession(): void {
  throw new Error('Demo client is only available in the demo build');
}
