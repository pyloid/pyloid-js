import { baseAPI } from './baseAPI';

/**
 * JSON-RPC Request Type Definition
 */
interface JsonRpcRequest<T = any> {
  jsonrpc: string;
  method: string;
  params: T;
  id: string | null;
}

/**
 * JSON-RPC Response Type Definition
 */
interface JsonRpcResponse<T = any> {
  jsonrpc: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | null;
}

/**
 * RPC Client Class
 */
export class RpcClient {
  private endpoint: string | null = null;
  private endpointPromise: Promise<string> | null = null;
  private windowId: string | null = null;

  /**
   * RPC Client Constructor
   * @param initialEndpoint Optional initial endpoint. If not provided, it will be fetched asynchronously.
   */
  constructor(initialEndpoint?: string) {
    if (initialEndpoint) {
      this.endpoint = initialEndpoint;
      this.endpointPromise = Promise.resolve(initialEndpoint);
    }
    // Don't initialize automatically in SSR environments
    // Initialize will be called lazily when first RPC call is made
  }

  /**
   * Initializes the endpoint by fetching it from baseAPI.
   * @returns {Promise<string>} A promise that resolves with the endpoint URL.
   * @private
   */
  private async initializeEndpoint(): Promise<string> {
    try {
      console.log('RpcClient: Fetching RPC endpoint...');
      const url = await baseAPI.getServerUrl();
      this.endpoint = url;
      this.windowId = await baseAPI.getWindowId();
      console.log('RpcClient: Endpoint initialized');
      return url;
    } catch (error) {
      console.error('RpcClient: Failed to initialize endpoint', error);
      throw new Error(`Failed to get RPC endpoint: ${error}`);
    }
  }

  /**
   * Ensures the endpoint is initialized before proceeding.
   * @private
   */
  private async ensureEndpointInitialized(): Promise<void> {
    if (!this.endpoint) {
      // Lazy initialization for SSR environments
      if (!this.endpointPromise) {
        this.endpointPromise = this.initializeEndpoint();
      }
      await this.endpointPromise;
    }
    if (!this.endpoint) {
      throw new Error('RPC endpoint could not be initialized.');
    }
  }

  /**
   * Call RPC Method
   * @param method Method name to call
   * @param params Optional method parameters
   * @returns Promise with the result
   */
  async call<T = any, R = any>(method: string, params?: T): Promise<R> {
    await this.ensureEndpointInitialized();

    if (params === undefined) {
      params = {} as T;
    }

    const request: JsonRpcRequest<T> = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.windowId,
    };

    const response = await fetch(this.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data: JsonRpcResponse<R> = await response.json();

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message} (Code: ${data.error.code})`);
    }

    return data.result as R;
  }
}

/**
 * Global RPC Client Instance
 * Note: The client initializes its endpoint asynchronously.
 */
export const rpc = new RpcClient();
