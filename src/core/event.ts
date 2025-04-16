// Interface definition for event listeners
interface EventListeners {
  [eventName: string]: Array<(data: any) => void>;
}

/**
 * Class for managing Pyloid events
 * Listen to events from the Python backend
 */
export class EventAPI {
  private _listeners: EventListeners = {};

  /**
   * Register a listener for a specific event
   * @param eventName Name of the event to subscribe to
   * @param callback Callback function to be called when the event occurs
   */
  listen<T = any>(eventName: string, callback: (data: T) => void): void {
    // Create an array for callbacks if it doesn't exist yet
    if (!this._listeners[eventName]) {
      this._listeners[eventName] = [];
    }

    // Store the callback function
    this._listeners[eventName].push(callback as (data: any) => void);

    // Register a DOM event listener
    const eventHandler = (event: CustomEvent) => {
      let eventData;
      try {
        eventData = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
      } catch (e) {
        eventData = event.detail;
      }
      callback(eventData);
    };

    // Connect the callback function with the event handler
    (callback as any)._eventHandler = eventHandler;

    // Add event listener to the document
    document.addEventListener(eventName, eventHandler as EventListener);
  }

  /**
   * Remove all listeners for a specific event
   * @param eventName Name of the event to unsubscribe from
   */
  unlisten(eventName: string): void {
    // Remove all listeners for the event
    if (this._listeners[eventName]) {
      this._listeners[eventName].forEach((callback) => {
        const eventHandler = (callback as any)._eventHandler;
        if (eventHandler) {
          document.removeEventListener(eventName, eventHandler as EventListener);
        }
      });
      // Remove stored callbacks
      delete this._listeners[eventName];
    }
  }

  /**
   * Remove all event listeners
   */
  clearAllListeners(): void {
    Object.keys(this._listeners).forEach((eventName) => {
      this.unlisten(eventName);
    });
  }
}

// Create a singleton instance of EventAPI
export const event = new EventAPI();
