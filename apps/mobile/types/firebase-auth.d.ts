import type { Persistence } from 'firebase/auth';

/**
 * Declares `getReactNativePersistence`, which exists at runtime but not in the
 * types we resolve.
 *
 * The `firebase/auth` package exports a React Native build — that's what Metro
 * loads, and it's the only build that has this function. Its `package.json`
 * exports map has no `react-native` condition at the `firebase/auth` level, so
 * TypeScript resolves the browser typings instead and reports the function as
 * missing. Everything else about the module types correctly, so this adds back
 * the one export rather than reaching past the package.
 *
 * Checked against firebase 12.19.0 (@firebase/auth 1.13.6, `dist/rn`). Delete
 * this if a later version publishes the condition.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
