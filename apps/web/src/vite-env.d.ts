/// <reference types="vite/client" />

declare module '@demo/client' {
  export function demoApiFetch<T>(path: string, init?: RequestInit): Promise<T>;
  export function resetDemoSession(): void;
}
