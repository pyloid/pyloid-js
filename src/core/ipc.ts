import { pyloidReadyManager } from './pyloidReadyManager';

// Extend window.ipc type definition
// This extends the global Window interface to include the ipc API
declare global {
  interface Window {
    ipc: any;
  }
}

/**
 * Flexible IPC interface that allows any property access
 */
interface IPCInterface {
  [key: string]: any;
}

/**
 * IPC (Inter-Process Communication) class providing access to electron/ipcRenderer or similar backend IPC.
 * All methods automatically wait for Pyloid initialization before executing.
 */
export class IPC {
  /**
   * Ensures that the Pyloid API is ready before executing IPC calls.
   * It checks the ready state and waits for the `whenReady` promise if necessary.
   * @template T The return type of the IPC call.
   * @param {() => Promise<T>} fn The asynchronous function to execute after Pyloid is ready.
   * @returns {Promise<T>} A promise that resolves with the result of the executed function.
   * @private
   */
  private async ensureReady<T>(fn: () => Promise<T>): Promise<T> {
    // Check if window is available (skip in SSR environments)
    if (typeof window === 'undefined') {
      throw new Error('IPC is not available in server-side rendering environment.');
    }

    // Check if ready, if not, wait for the promise from the manager
    if (!pyloidReadyManager.isReady()) {
      await pyloidReadyManager.whenReady(); // Wait for the ready promise to resolve
    }
    // Execute the provided function once ready
    return fn();
  }

  /**
   * Dynamically calls IPC methods using dot notation.
   * Usage: ipc.className.methodName(args...)
   * @param {string} path - The dot-separated path to the IPC method (e.g., "main.getVersion")
   * @param {any[]} args - Arguments to pass to the IPC method
   * @returns {Promise<any>} A promise that resolves with the result of the IPC call
   */
  public async callIPC(path: string, ...args: any[]): Promise<any> {
    return this.ensureReady(async () => {
      const parts = path.split('.');
      let current: any = window.ipc;

      // Navigate through the path
      for (let i = 0; i < parts.length - 1; i++) {
        if (current && typeof current === 'object') {
          current = current[parts[i]];
        } else {
          throw new Error(
            `IPC path '${path}' is not accessible. '${parts
              .slice(0, i + 1)
              .join('.')}' is not an object.`
          );
        }
      }

      const methodName = parts[parts.length - 1];
      if (!current || typeof current[methodName] !== 'function') {
        throw new Error(`IPC method '${path}' is not available or not a function.`);
      }

      return current[methodName](...args);
    });
  }
}

/**
 * Proxy handler for IPC to enable dot notation access
 */
const ipcProxyHandler: ProxyHandler<IPC> = {
  get(target: IPC, prop: string | symbol): any {
    if (typeof prop === 'string' && prop !== 'callIPC' && prop !== 'ensureReady') {
      // Return a proxy for nested access
      return new Proxy(() => {}, {
        get(_: any, nestedProp: string | symbol): any {
          if (typeof nestedProp === 'string') {
            const fullPath = prop + '.' + nestedProp;
            return (...args: any[]) => target.callIPC(fullPath, ...args);
          }
          return undefined;
        },
        apply(_: any, __: any, args: any[]) {
          return target.callIPC(prop, ...args);
        },
      });
    }
    return (target as any)[prop];
  },
};

/**
 * Singleton instance of the IPC class wrapped with a proxy for dot notation access.
 * Import this instance to use IPC methods in your application.
 * Example: `import { ipc } from 'pyloid-js'; ipc.main.getVersion().then(version => console.log(version));`
 */
export const ipc: IPCInterface = new Proxy(new IPC(), ipcProxyHandler);
