/**
 * Manages the ready state of the Pyloid API.
 * Ensures that API calls are only made after the Pyloid system is fully initialized
 * by polling for the existence of `window.__PYLOID__`.
 */
export class PyloidReadyManager {
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
export const pyloidReadyManager = new PyloidReadyManager();
