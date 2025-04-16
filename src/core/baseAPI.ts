// Extend window.__PYLOID__ type definition
// This extends the global Window interface to include the PYLOID API methods
declare global {
  interface Window {
    __PYLOID__: {
      getData: () => Promise<any>;
      startSystemDrag: () => Promise<void>;
      getWindowId: () => Promise<string>;
      getWindowProperties: () => Promise<WindowProperties>;
      close: () => Promise<void>;
      hide: () => Promise<void>;
      show: () => Promise<void>;
      focus: () => Promise<void>;
      showAndFocus: () => Promise<void>;
      fullscreen: () => Promise<void>;
      toggleFullscreen: () => Promise<void>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      unmaximize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      isFullscreen: () => Promise<boolean>;
      isMaximized: () => Promise<boolean>;
      setTitle: (title: string) => Promise<void>;
      setSize: (width: number, height: number) => Promise<void>;
      setPosition: (x: number, y: number) => Promise<void>;
      setFrame: (frame: boolean) => Promise<void>;
      getFrame: () => Promise<boolean>;
      getTitle: () => Promise<string>;
      getSize: () => Promise<Size>;
      getPosition: () => Promise<Position>;
      setClipboardText: (text: string) => Promise<void>;
      getClipboardText: () => Promise<string>;
      setClipboardImage: (imagePath: string, format: string) => Promise<void>;
      getClipboardImage: () => Promise<string>;
      quit: () => Promise<void>;
      getPlatform: () => Promise<Platform>;
      isProduction: () => Promise<boolean>;
      getProductionPath: (path: string) => Promise<string>;
      getRpcUrl: () => Promise<string>;
    };
  }
}

// Interface definitions
/**
 * Represents the properties of a window
 * Can contain any key-value pairs as window properties
 */
export interface WindowProperties {
  [key: string]: any;
}

/**
 * Represents the size dimensions of a window
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Represents the position coordinates of a window
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Supported platform types for the application
 */
export type Platform = 'windows' | 'linux' | 'macos';

/**
 * Manages the ready state of the Pyloid API.
 * Ensures that API calls are only made after the Pyloid system is fully initialized
 * by polling for the existence of `window.__PYLOID__`.
 */
class PyloidReadyManager {
  private ready: boolean = false;
  private readyPromise: Promise<void>;
  private resolveReadyPromise!: () => void;
  private rejectReadyPromise!: (reason?: any) => void;
  private pollingInterval: number | null = null;
  private pollingTimeout: number | null = null;

  /**
   * Creates an instance of PyloidReadyManager.
   * Initializes the polling mechanism to check for `window.__PYLOID__`.
   * @param {number} [checkInterval=20] - The interval in milliseconds to poll for `window.__PYLOID__`.
   * @param {number} [timeoutDuration=10000] - The maximum time in milliseconds to wait for `window.__PYLOID__` before rejecting the promise.
   */
  constructor(private checkInterval = 20, private timeoutDuration = 10000) {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReadyPromise = resolve;
      this.rejectReadyPromise = reject;

      // Check immediately if __PYLOID__ is already available
      if (typeof window !== 'undefined' && window.__PYLOID__) {
        console.log('PyloidReadyManager: __PYLOID__ found immediately.');
        this.setReady();
        // If in a browser environment, start polling
      } else if (typeof window !== 'undefined') {
        console.log(
          `PyloidReadyManager: __PYLOID__ not found. Starting polling every ${this.checkInterval}ms.`
        );
        // Start polling interval
        this.pollingInterval = window.setInterval(() => {
          if (window.__PYLOID__) {
            console.log('PyloidReadyManager: __PYLOID__ found via polling.');
            this.stopPolling(); // Stop polling once found
            this.setReady(); // Set state to ready
          }
        }, this.checkInterval);

        // Set timeout for polling
        this.pollingTimeout = window.setTimeout(() => {
          if (!this.ready) {
            console.error(
              `PyloidReadyManager: Polling timed out after ${this.timeoutDuration}ms. __PYLOID__ was not injected.`
            );
            this.stopPolling(); // Stop polling on timeout
            this.rejectReadyPromise(new Error('Pyloid initialization timed out.')); // Reject the promise
          }
        }, this.timeoutDuration);
        // Handle cases where window object is not available (e.g., server-side rendering)
      } else {
        console.error('PyloidReadyManager: window object is not available.');
        this.rejectReadyPromise(new Error('Window object not found.'));
      }
    });
  }

  /**
   * Stops the polling interval and the timeout timer.
   * Clears the interval and timeout IDs stored in the instance.
   */
  private stopPolling(): void {
    if (this.pollingInterval !== null) {
      window.clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.pollingTimeout !== null) {
      window.clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  /**
   * Sets the ready state to true, stops any ongoing polling, and resolves the ready promise.
   * This method is called internally when `window.__PYLOID__` is detected.
   * Ensures the ready state is only set once.
   */
  setReady(): void {
    if (!this.ready) {
      // Prevent setting ready multiple times
      this.ready = true;
      this.stopPolling(); // Ensure polling is stopped
      console.log('PyloidReadyManager: Pyloid is ready.');
      this.resolveReadyPromise(); // Resolve the promise to allow API calls
    }
  }

  /**
   * Checks if the Pyloid API is ready.
   * @returns {boolean} True if Pyloid is ready, false otherwise.
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Returns a promise that resolves when the Pyloid API is ready.
   * The promise will reject if the initialization times out.
   * Use this to wait for Pyloid initialization before making API calls.
   * @returns {Promise<void>} A promise that resolves when ready, or rejects on timeout.
   */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }
}

/**
 * Singleton instance of the PyloidReadyManager.
 * Used internally by BaseAPI to manage the ready state.
 */
const pyloidReadyManager = new PyloidReadyManager();

/**
 * Base API class providing asynchronous methods to interact with the Pyloid backend via `window.__PYLOID__`.
 * All methods automatically wait for Pyloid initialization before executing.
 */
export class BaseAPI {
  /**
   * Ensures that the Pyloid API is ready before executing the provided function.
   * It checks the ready state and waits for the `whenReady` promise if necessary.
   * @template T The return type of the function to execute.
   * @param {() => Promise<T>} fn The asynchronous function to execute after Pyloid is ready.
   * @returns {Promise<T>} A promise that resolves with the result of the executed function.
   * @private
   */
  private async ensureReady<T>(fn: () => Promise<T>): Promise<T> {
    // Check if ready, if not, wait for the promise from the manager
    if (!pyloidReadyManager.isReady()) {
      await pyloidReadyManager.whenReady(); // Wait for the ready promise to resolve
    }
    // Execute the provided function once ready
    return fn();
  }

  /**
   * Retrieves generic data passed from the Pyloid backend during initialization.
   * @returns {Promise<any>} A promise that resolves with the data.
   */
  getData(): Promise<any> {
    return this.ensureReady(() => window.__PYLOID__.getData());
  }

  /**
   * Gets the unique identifier for the current window.
   * @returns {Promise<string>} A promise that resolves with the window ID string.
   */
  getWindowId(): Promise<string> {
    return this.ensureReady(() => window.__PYLOID__.getWindowId());
  }

  /**
   * Retrieves properties associated with the current window.
   * @returns {Promise<WindowProperties>} A promise that resolves with an object containing window properties.
   */
  getWindowProperties(): Promise<WindowProperties> {
    return this.ensureReady(() => window.__PYLOID__.getWindowProperties());
  }

  /**
   * Closes the current window.
   * @returns {Promise<void>} A promise that resolves when the close operation is initiated.
   */
  close(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.close());
  }

  /**
   * Hides the current window.
   * @returns {Promise<void>} A promise that resolves when the hide operation is initiated.
   */
  hide(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.hide());
  }

  /**
   * Shows the current window if it is hidden.
   * @returns {Promise<void>} A promise that resolves when the show operation is initiated.
   */
  show(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.show());
  }

  /**
   * Brings the current window to the foreground and gives it focus.
   * @returns {Promise<void>} A promise that resolves when the focus operation is initiated.
   */
  focus(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.focus());
  }

  /**
   * Shows the window (if hidden) and brings it to the foreground with focus.
   * @returns {Promise<void>} A promise that resolves when the operation is initiated.
   */
  showAndFocus(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.showAndFocus());
  }

  /**
   * Makes the current window fullscreen.
   * @returns {Promise<void>} A promise that resolves when the fullscreen operation is initiated.
   */
  fullscreen(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.fullscreen());
  }

  /**
   * Toggles the fullscreen state of the current window.
   * @returns {Promise<void>} A promise that resolves when the toggle operation is initiated.
   */
  toggleFullscreen(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.toggleFullscreen());
  }

  /**
   * Minimizes the current window.
   * @returns {Promise<void>} A promise that resolves when the minimize operation is initiated.
   */
  minimize(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.minimize());
  }

  /**
   * Maximizes the current window.
   * @returns {Promise<void>} A promise that resolves when the maximize operation is initiated.
   */
  maximize(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.maximize());
  }

  /**
   * Restores the window from a maximized state.
   * @returns {Promise<void>} A promise that resolves when the unmaximize operation is initiated.
   */
  unmaximize(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.unmaximize());
  }

  /**
   * Toggles the maximized state of the current window.
   * @returns {Promise<void>} A promise that resolves when the toggle operation is initiated.
   */
  toggleMaximize(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.toggleMaximize());
  }

  /**
   * Checks if the current window is in fullscreen mode.
   * @returns {Promise<boolean>} A promise that resolves with true if fullscreen, false otherwise.
   */
  isFullscreen(): Promise<boolean> {
    return this.ensureReady(() => window.__PYLOID__.isFullscreen());
  }

  /**
   * Checks if the current window is maximized.
   * @returns {Promise<boolean>} A promise that resolves with true if maximized, false otherwise.
   */
  isMaximized(): Promise<boolean> {
    return this.ensureReady(() => window.__PYLOID__.isMaximized());
  }

  /**
   * Sets the title of the current window.
   * @param {string} title - The new title for the window.
   * @returns {Promise<void>} A promise that resolves when the title is set.
   */
  setTitle(title: string): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.setTitle(title));
  }

  /**
   * Sets the size (width and height) of the current window.
   * @param {number} width - The desired width in pixels.
   * @param {number} height - The desired height in pixels.
   * @returns {Promise<void>} A promise that resolves when the size is set.
   */
  setSize(width: number, height: number): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.setSize(width, height));
  }

  /**
   * Sets the position (x and y coordinates) of the current window.
   * @param {number} x - The desired x-coordinate (distance from the left edge of the screen).
   * @param {number} y - The desired y-coordinate (distance from the top edge of the screen).
   * @returns {Promise<void>} A promise that resolves when the position is set.
   */
  setPosition(x: number, y: number): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.setPosition(x, y));
  }

  /**
   * Sets whether the window should have a standard OS frame (title bar, borders).
   * @param {boolean} frame - True to show the frame, false to hide it (frameless).
   * @returns {Promise<void>} A promise that resolves when the frame state is set.
   */
  setFrame(frame: boolean): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.setFrame(frame));
  }

  /**
   * Gets the current frame state of the window (whether it has a standard OS frame).
   * @returns {Promise<boolean>} A promise that resolves with true if the frame is visible, false otherwise.
   */
  getFrame(): Promise<boolean> {
    return this.ensureReady(() => window.__PYLOID__.getFrame());
  }

  /**
   * Gets the current title of the window.
   * @returns {Promise<string>} A promise that resolves with the window title string.
   */
  getTitle(): Promise<string> {
    return this.ensureReady(() => window.__PYLOID__.getTitle());
  }

  /**
   * Gets the current size (width and height) of the window.
   * @returns {Promise<Size>} A promise that resolves with an object containing the width and height.
   */
  getSize(): Promise<Size> {
    return this.ensureReady(() => window.__PYLOID__.getSize());
  }

  /**
   * Gets the current position (x and y coordinates) of the window.
   * @returns {Promise<Position>} A promise that resolves with an object containing the x and y coordinates.
   */
  getPosition(): Promise<Position> {
    return this.ensureReady(() => window.__PYLOID__.getPosition());
  }

  /**
   * Sets the system clipboard text content.
   * @param {string} text - The text to write to the clipboard.
   * @returns {Promise<void>} A promise that resolves when the clipboard text is set.
   */
  setClipboardText(text: string): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.setClipboardText(text));
  }

  /**
   * Gets the current text content from the system clipboard.
   * @returns {Promise<string>} A promise that resolves with the clipboard text.
   */
  getClipboardText(): Promise<string> {
    return this.ensureReady(() => window.__PYLOID__.getClipboardText());
  }

  /**
   * Sets the system clipboard image content from a file path.
   * Note: The backend implementation determines how the image path is handled.
   * @param {string} imagePath - The path to the image file.
   * @param {string} format - The format of the image (e.g., 'png', 'jpeg'). This might be backend-specific.
   * @returns {Promise<void>} A promise that resolves when the clipboard image is set.
   */
  setClipboardImage(imagePath: string, format: string): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.setClipboardImage(imagePath, format));
  }

  /**
   * Gets the current image content from the system clipboard, typically as a base64 encoded string or a temporary file path.
   * Note: The return format depends on the backend implementation.
   * @returns {Promise<string>} A promise that resolves with the clipboard image data (e.g., base64 string or path).
   */
  getClipboardImage(): Promise<string> {
    return this.ensureReady(() => window.__PYLOID__.getClipboardImage());
  }

  /**
   * Quits the entire application (not just the current window).
   * @returns {Promise<void>} A promise that resolves when the quit operation is initiated.
   */
  quit(): Promise<void> {
    return this.ensureReady(() => window.__PYLOID__.quit());
  }

  /**
   * Gets the underlying operating system platform.
   * @returns {Promise<Platform>} A promise that resolves with the platform name ('windows', 'linux', or 'macos').
   */
  getPlatform(): Promise<Platform> {
    return this.ensureReady(() => window.__PYLOID__.getPlatform());
  }

  /**
   * Checks if the application is running in production mode (e.g., packaged).
   * @returns {Promise<boolean>} A promise that resolves with true if in production, false otherwise.
   */
  isProduction(): Promise<boolean> {
    return this.ensureReady(() => window.__PYLOID__.isProduction());
  }

  /**
   * Resolves a relative path to an absolute path within the application's production build directory.
   * Useful for accessing bundled assets when running in production.
   * @param {string} path - The relative path within the production build.
   * @returns {Promise<string>} A promise that resolves with the absolute path.
   */
  getProductionPath(path: string): Promise<string> {
    return this.ensureReady(() => window.__PYLOID__.getProductionPath(path));
  }

  getRpcUrl(): Promise<string> {
    return this.ensureReady(() => window.__PYLOID__.getRpcUrl());
  }
}

/**
 * Singleton instance of the BaseAPI class.
 * Import this instance to use the Pyloid API methods in your application.
 * Example: `import { baseAPI } from './core/baseAPI'; baseAPI.getTitle().then(title => console.log(title));`
 */
export const baseAPI = new BaseAPI();

/**
 * Dispatches a custom 'pyloidReady' event on the window object.
 * This function is intended to be called by the backend injection mechanism
 * IF the event-based approach is used instead of polling.
 * It signals that `window.__PYLOID__` has been successfully injected and is ready.
 * @deprecated This function is not used when the polling mechanism in PyloidReadyManager is active.
 */
export function emitPyloidReadyEvent(): void {
  window.dispatchEvent(new Event('pyloidReady'));
}
