import { baseAPI } from './baseAPI';

/**
 * Internal State Management
 *
 * The module uses internal state to manage the server URL and window ID lifecycle:
 * - serverUrl: Cached server URL once initialized
 * - serverUrlPromise: Promise for ongoing server URL initialization
 * - windowId: Cached window ID once initialized
 * - windowIdPromise: Promise for ongoing window ID initialization
 *
 * This approach ensures that both the server URL and window ID are fetched only once
 * and then reused across all subsequent HTTP requests, improving performance and consistency.
 */
let serverUrl: string | null = null;
let serverUrlPromise: Promise<string> | null = null;
let windowId: string | null = null;
let windowIdPromise: Promise<string> | null = null;

/**
 * Initialize Server URL
 *
 * Fetches the Pyloid server URL from the baseAPI and caches it for future use.
 * This function is called automatically by the fetch function when needed, but
 * can also be used for explicit initialization if required.
 *
 * The server URL is the base URL for the FastAPI backend server that handles
 * HTTP requests. This URL is combined with user-provided paths to create
 * complete request URLs.
 *
 * @returns Promise that resolves to the server URL string
 * @throws Error if server URL cannot be retrieved from baseAPI
 * @private
 *
 * @internal This function is for internal use by the HTTP client module
 */
async function initializeServerUrl(): Promise<string> {
  try {
    console.log('PyloidFetch: Fetching server URL...');
    const url = await baseAPI.getServerUrl();
    serverUrl = url;
    console.log('PyloidFetch: Server URL initialized:', url);
    return url;
  } catch (error) {
    console.error('PyloidFetch: Failed to initialize server URL', error);
    throw new Error(`Failed to get server URL: ${error}`);
  }
}

/**
 * Initialize Window ID
 *
 * Fetches the Pyloid window ID from the baseAPI and caches it for future use.
 * This function is called automatically by the fetch function when needed, but
 * can also be used for explicit initialization if required.
 *
 * The window ID is a unique identifier for the current Pyloid window instance,
 * which is used for request routing and identification on the server side.
 *
 * @returns Promise that resolves to the window ID string
 * @throws Error if window ID cannot be retrieved from baseAPI
 * @private
 *
 * @internal This function is for internal use by the HTTP client module
 */
async function initializeWindowId(): Promise<string> {
  try {
    console.log('PyloidFetch: Fetching window ID...');
    const id = await baseAPI.getWindowId();
    windowId = id;
    console.log('PyloidFetch: Window ID initialized');
    return id;
  } catch (error) {
    console.error('PyloidFetch: Failed to initialize window ID', error);
    throw new Error(`Failed to get window ID: ${error}`);
  }
}

/**
 * Build Complete URL
 *
 * Combines the server URL with a user-provided path to create a complete request URL.
 * Handles various URL formats and ensures proper path joining.
 *
 * URL Construction Rules:
 * - If path starts with '/', it's treated as an absolute path from server root
 * - If path doesn't start with '/', it's treated as a relative path
 * - Server URL trailing slash and path leading slash are handled correctly
 * - Full URLs (http://, https://) are returned as-is
 *
 * @param serverUrl - The base server URL
 * @param path - The path to append to the server URL
 * @returns Complete URL string
 * @private
 *
 * @internal This function is for internal use by the HTTP client module
 */
function buildUrl(serverUrl: string, path: string): string {
  // If path is already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Remove trailing slash from server URL
  const baseUrl = serverUrl.replace(/\/$/, '');

  // Remove leading slash from path if present
  const cleanPath = path.replace(/^\//, '');

  // Combine URLs
  return `${baseUrl}/${cleanPath}`;
}

/**
 * Ensure Server URL is Initialized
 *
 * Validates that the server URL has been initialized and is ready for use.
 * If the server URL is not yet available, this function will trigger the
 * initialization process and wait for it to complete.
 *
 * @throws Error if server URL initialization fails or times out
 * @private
 *
 * @internal This function is for internal use by the fetch function
 */
async function ensureServerUrlInitialized(): Promise<void> {
  if (!serverUrl) {
    if (!serverUrlPromise) {
      serverUrlPromise = initializeServerUrl();
    }
    await serverUrlPromise;
  }
  if (!serverUrl) {
    throw new Error('Server URL could not be initialized.');
  }
}

/**
 * Ensure Window ID is Initialized
 *
 * Validates that the window ID has been initialized and is ready for use.
 * If the window ID is not yet available, this function will trigger the
 * initialization process and wait for it to complete.
 *
 * This function implements a lazy initialization pattern:
 * 1. Check if window ID is already cached
 * 2. If not cached, check if initialization is in progress
 * 3. If no initialization in progress, start initialization
 * 4. Wait for initialization to complete
 * 5. Validate that initialization was successful
 *
 * @throws Error if window ID initialization fails or times out
 * @private
 *
 * @internal This function is for internal use by the fetch function
 */
async function ensureWindowIdInitialized(): Promise<void> {
  if (!windowId) {
    if (!windowIdPromise) {
      windowIdPromise = initializeWindowId();
    }
    await windowIdPromise;
  }
  if (!windowId) {
    throw new Error('Window ID could not be initialized.');
  }
}

/**
 * Pyloid Enhanced Fetch Function
 *
 * This function provides the exact same interface as the native fetch API, but with automatic
 * window ID injection for Pyloid applications. It ensures that all HTTP requests include
 *
 * Key Features:
 * - Identical API to native fetch (drop-in replacement)
 * - Automatic window ID injection via 'X-Pyloid-Window-Id' header
 * - Automatic server URL resolution and path combination for server framework integration
 * - Asynchronous initialization (waits for Pyloid to be ready)
 *
 * @param url - The URL path or Request object to fetch. For Pyloid applications, this is typically
 *              a relative path like '/api/users' or '/data'. The function automatically combines
 *              this path with the server URL obtained from baseAPI.getServerUrl().
 *              Full URLs (http://, https://) are used as-is without modification.
 *
 * @param options - Optional fetch options object. Supports all standard RequestInit properties:
 *                  - method: HTTP method (GET, POST, PUT, DELETE, etc.)
 *                  - headers: Request headers (will be merged with automatic window ID)
 *                  - body: Request body (string, FormData, Blob, etc.)
 *                  - mode: Request mode (cors, no-cors, same-origin)
 *                  - credentials: Credentials mode (omit, same-origin, include)
 *                  - cache: Cache mode (default, no-store, reload, etc.)
 *                  - redirect: Redirect handling (follow, error, manual)
 *                  - referrer: Referrer policy
 *                  - referrerPolicy: Referrer policy string
 *                  - integrity: Subresource integrity value
 *                  - keepalive: Keep connection alive
 *                  - signal: AbortSignal for request cancellation
 *
 * @returns Promise<Response> - A Promise that resolves to a Response object representing
 *          the response to the request. This is identical to the native fetch Response object
 *          with all standard properties and methods (json(), text(), blob(), etc.)
 *
 * @throws Error - If window ID initialization fails or the request encounters an error.
 *                 The error will be logged to console and re-thrown for handling by the caller.
 *
 * @example
 * // Basic GET request to FastAPI backend
 * try {
 *   const response = await fetch('/api/users');
 *   if (response.ok) {
 *     const users = await response.json();
 *     console.log('Users:', users);
 *   }
 * } catch (error) {
 *   console.error('Request failed:', error);
 * }
 *
 * @example
 * // POST request with JSON body to FastAPI backend
 * const userData = {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * };
 *
 * const response = await fetch('/api/users', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer token123'
 *   },
 *   body: JSON.stringify(userData)
 * });
 *
 * @example
 * // Request with custom headers (merged with window ID)
 * const response = await fetch('/api/data', {
 *   headers: {
 *     'Custom-Header': 'custom-value',
 *     'Another-Header': 'another-value'
 *   }
 * });
 *
 * // Resulting headers will include:
 * // - Custom-Header: custom-value
 * // - Another-Header: another-value
 * // - X-Pyloid-Window-Id: [window-id] (automatically added)
 *
 * @example
 * // File upload with FormData to FastAPI backend
 * const formData = new FormData();
 * formData.append('file', fileInput.files[0]);
 * formData.append('upload_preset', 'my-preset');
 *
 * const response = await fetch('/api/upload', {
 *   method: 'POST',
 *   body: formData
 * });
 *
 * @example
 * // Request with timeout using AbortController
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000); // 5 second timeout
 *
 * try {
 *   const response = await fetch('/api/slow-endpoint', {
 *     signal: controller.signal
 *   });
 * } catch (error) {
 *   if (error.name === 'AbortError') {
 *     console.log('Request timed out');
 *   }
 * }
 *
 * @example
 * // Working with different response types from FastAPI backend
 * const response = await fetch('/api/data');
 *
 * if (response.ok) {
 *   // JSON response
 *   const data = await response.json();
 *
 *   // Text response
 *   const text = await response.text();
 *
 *   // Binary data (Blob)
 *   const blob = await response.blob();
 *
 *   // ArrayBuffer for binary processing
 *   const buffer = await response.arrayBuffer();
 *
 *   // FormData for multipart responses
 *   const formData = await response.formData();
 * }
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/fetch | MDN fetch documentation}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/RequestInit | RequestInit documentation}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Response | Response documentation}
 *
 * @remarks
 * - This function automatically waits for the Pyloid system to initialize before making requests
 * - Both server URL and window ID are fetched once and cached for subsequent requests
 * - Server URL is obtained from baseAPI.getServerUrl() and combined with user-provided paths
 * - Window ID is automatically injected into request headers for server-side routing
 * - If Pyloid is not ready within the timeout period, requests will fail
 * - The original fetch function is available as `originalFetch` if needed
 */
export async function fetch(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  // Ensure both server URL and window ID are initialized
  await Promise.all([ensureServerUrlInitialized(), ensureWindowIdInitialized()]);

  // Convert URL to string for processing
  const urlString = url.toString();

  // Build complete URL by combining server URL with user path
  const completeUrl = buildUrl(serverUrl!, urlString);

  console.log(`PyloidFetch: Making request to ${completeUrl} with window ID: ${windowId}`);

  // Merge window ID into headers
  const enhancedOptions = {
    ...options,
    headers: {
      ...options.headers,
      'X-Pyloid-Window-Id': windowId!,
    },
  };

  try {
    return await globalThis.fetch(completeUrl, enhancedOptions);
  } catch (error) {
    console.error('PyloidFetch: Request failed', error);
    throw error;
  }
}

/**
 * Get Current Server URL
 *
 * Retrieves the current Pyloid server URL that is being used for HTTP requests.
 * This function provides direct access to the cached server URL without making
 * any additional API calls.
 *
 * @returns Current server URL string if initialized, or null if the server URL
 *          has not been initialized yet or initialization failed.
 *
 * @example
 * ```typescript
 * // Check if server URL is available
 * const currentServerUrl = getServerUrl();
 * if (currentServerUrl) {
 *   console.log('Current server URL:', currentServerUrl);
 * } else {
 *   console.log('Server URL not yet initialized');
 * }
 *
 * // Use for debugging or logging
 * if (isServerUrlReady()) {
 *   const url = getServerUrl();
 *   console.log('Making requests to:', url);
 * }
 * ```
 *
 * @see {@link isServerUrlReady} for checking initialization status
 * @see {@link fetch} for the enhanced fetch function that uses this server URL
 */
export function getServerUrl(): string | null {
  return serverUrl;
}

/**
 * Check Server URL Initialization Status
 *
 * Checks whether the Pyloid server URL has been successfully initialized and cached.
 * This function is useful for conditional logic before making HTTP requests or
 * for debugging purposes.
 *
 * @returns true if the server URL is available and ready for use,
 *          false if initialization is still in progress or has failed.
 *
 * @example
 * ```typescript
 * // Wait for server URL to be ready
 * if (!isServerUrlReady()) {
 *   console.log('Waiting for Pyloid server URL initialization...');
 *   // You can poll this function or wait for PyloidReadyManager
 * }
 *
 * // Use with getServerUrl for safe access
 * if (isServerUrlReady()) {
 *   const serverUrl = getServerUrl();
 *   console.log('Ready to make requests to:', serverUrl);
 * } else {
 *   console.log('Server URL not available yet');
 * }
 * ```
 *
 * @see {@link getServerUrl} for retrieving the actual server URL value
 * @see {@link PyloidReadyManager} for more comprehensive initialization status
 */
export function isServerUrlReady(): boolean {
  return serverUrl !== null;
}

/**
 * Get Current Window ID
 *
 * Retrieves the current Pyloid window ID that is being used for HTTP requests.
 * This function provides direct access to the cached window ID without making
 * any additional API calls.
 *
 * @returns Current window ID string if initialized, or null if the window ID
 *          has not been initialized yet or initialization failed.
 *
 * @example
 * ```typescript
 * // Check if window ID is available
 * const currentWindowId = getWindowId();
 * if (currentWindowId) {
 *   console.log('Current window ID:', currentWindowId);
 * } else {
 *   console.log('Window ID not yet initialized');
 * }
 *
 * // Use in conditional logic
 * if (isWindowIdReady()) {
 *   const id = getWindowId();
 *   // Make requests or perform other operations
 * }
 * ```
 *
 * @see {@link isWindowIdReady} for checking initialization status
 * @see {@link fetch} for the enhanced fetch function that uses this window ID
 */
export function getWindowId(): string | null {
  return windowId;
}

/**
 * Check Window ID Initialization Status
 *
 * Checks whether the Pyloid window ID has been successfully initialized and cached.
 * This function is useful for conditional logic before making HTTP requests or
 * for debugging purposes.
 *
 * @returns true if the window ID is available and ready for use,
 *          false if initialization is still in progress or has failed.
 *
 * @example
 * ```typescript
 * // Wait for window ID to be ready
 * if (!isWindowIdReady()) {
 *   console.log('Waiting for Pyloid initialization...');
 *   // You can poll this function or wait for PyloidReadyManager
 * }
 *
 * // Use with getWindowId for safe access
 * if (isWindowIdReady()) {
 *   const windowId = getWindowId();
 *   console.log('Ready to make requests with ID:', windowId);
 * } else {
 *   console.log('Window ID not available yet');
 * }
 * ```
 *
 * @see {@link getWindowId} for retrieving the actual window ID value
 * @see {@link PyloidReadyManager} for more comprehensive initialization status
 */
export function isWindowIdReady(): boolean {
  return windowId !== null;
}

/**
 * Original Fetch Function Reference
 *
 * Provides access to the original, unmodified fetch function from the global scope.
 * This is useful when you need to bypass the Pyloid window ID injection for specific
 * requests or when working with third-party libraries that require the native fetch.
 *
 * Use cases for originalFetch:
 * - Making requests that should not include Pyloid window ID
 * - Compatibility with libraries that expect native fetch behavior
 * - Testing or debugging without window ID interference
 * - Internal Pyloid operations that don't need the enhanced functionality
 *
 * @returns The original fetch function from globalThis.fetch
 *
 *
 * @see {@link fetch} for the enhanced fetch function with window ID injection
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch | Global fetch documentation}
 */
export const originalFetch = globalThis.fetch;
