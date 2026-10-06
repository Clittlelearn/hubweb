// utils/http-fetch.ts
export type HttpBody =
  | FormData
  | string
  | URLSearchParams
  | Record<string, any>
  | null
  | undefined;
export type HttpResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer';

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number; // ms, default 10000
  headers?: HeadersInit;
  credentials?: RequestCredentials; // 'omit' | 'same-origin' | 'include'
  cache?: RequestCache; // e.g. 'no-store'
  mode?: RequestMode; // e.g. 'cors'
  responseType?: HttpResponseType; // default 'json'
}

export class HttpError extends Error {
  status: number;
  statusText: string;
  url: string;
  bodySnippet?: string;
  constructor(
    message: string,
    opts: {
      status: number;
      statusText: string;
      url: string;
      bodySnippet?: string;
    },
  ) {
    super(message);
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.url = opts.url;
    this.bodySnippet = opts.bodySnippet;
  }
}

function buildBodyAndHeaders(body: HttpBody, initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders || {});
  if (body instanceof FormData) {
    return {
      payload: body,
      headers,
    };
  }
  if (typeof body === 'string' || body instanceof URLSearchParams) {
    if (!headers.has('Content-Type')) {
      headers.set(
        'Content-Type',
        body instanceof URLSearchParams
          ? 'application/x-www-form-urlencoded;charset=UTF-8'
          : 'text/plain;charset=UTF-8',
      );
    }
    return {
      payload: body,
      headers,
    };
  }
  if (body && typeof body === 'object') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json;charset=UTF-8');
    }
    return {
      payload: JSON.stringify(body),
      headers,
    };
  }
  return {
    payload: undefined,
    headers,
  };
}

async function parseResponse(res: Response, responseType: HttpResponseType) {
  switch (responseType) {
    case 'blob':
      return await res.blob();
    case 'arrayBuffer':
      return await res.arrayBuffer();
    case 'text':
      return await res.text();
    case 'json':
      const _json = await res.json()
      if (!_json) return null
      return _json
    default: {
      const text = await res.text();
      if (!text) return null;
      // eslint-disable-next-line @stylistic/max-statements-per-line
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
}

export class HttpFetch {
  constructor(
    baseURL: string,
    defaultHeaders?: HeadersInit,
    defaults?: Partial<RequestOptions>,
  ) {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
    this.defaults = {
      timeout: 10_000,
      mode: 'cors',
      cache: 'default',
      responseType: 'json',
      ...(defaults ?? {}),
    } as any;
  }

  private baseURL!: string;
  private defaultHeaders?: HeadersInit;
  private defaults: Required<Omit<RequestOptions, 'signal' | 'headers'>> &
    Pick<RequestOptions, 'signal' | 'headers'>;

  setBaseUrl(url: string) {
    this.baseURL = url;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    opts: RequestOptions = {},
    body?: HttpBody,
  ): Promise<T> {
    const url = new URL(path, this.baseURL).toString();

    const controller = new AbortController();
    const { timeout = this.defaults.timeout, signal: outerSignal } = opts;
    const timer = setTimeout(() => controller.abort(), timeout);
    const abortForward = () => controller.abort();
    outerSignal?.addEventListener?.('abort', abortForward);

    // 合并 headers（实例默认 + 调用级）
    const mergedHeaders = new Headers(this.defaultHeaders || {});
    new Headers(this.defaults.headers || {}).forEach((v, k) =>
      mergedHeaders.set(k, v),
    );
    new Headers(opts.headers || {}).forEach((v, k) => mergedHeaders.set(k, v));

    // 生成 payload & 可能的 content-type
    const { payload, headers } = buildBodyAndHeaders(body, mergedHeaders);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : (payload as any),
        signal: controller.signal,
        credentials: opts.credentials ?? this.defaults.credentials,
        cache: opts.cache ?? this.defaults.cache,
        mode: opts.mode ?? this.defaults.mode,
      });

      if (!res.ok) {
        const snippet = (await res.text()).slice(0, 500);
        let message = `HTTP ${res.status} ${res.statusText}`;
        try { message = JSON.parse(snippet)?.message || message; } catch { /* Proxy errors may not be JSON. */ }
        throw new HttpError(message, {
          status: res.status,
          statusText: res.statusText,
          url,
          bodySnippet: snippet,
        });
      }

      const type = opts.responseType ?? this.defaults.responseType;

      return (await parseResponse(res, type)) as T;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Request timeout');
      if (err instanceof HttpError) throw err;
      throw new Error(err?.message || 'Network error');
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener?.('abort', abortForward);
    }
  }

  // ====== Public APIs ======

  httpGet = async <T = any>(
    path: string,
    params: Record<string, any> = {},
    opts?: RequestOptions,
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)));
      else qs.append(k, String(v));
    });
    const fullPath = qs.toString() ? `${path}?${qs.toString()}` : path;

    return this.request<T>('GET', fullPath, opts);
  };

  httpPost = async <T = any>(
    path: string,
    body: HttpBody,
    opts?: RequestOptions,
  ) => {
    return this.request<T>('POST', path, opts, body);
  };

  httpDelete = async <T = any>(
    path: string,
    params: Record<string, any> = {},
    opts?: RequestOptions,
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)));
      else qs.append(k, String(v));
    });
    const fullPath = qs.toString() ? `${path}?${qs.toString()}` : path;

    return this.request<T>('DELETE', fullPath, opts);
  };

  httpDeleteWithBody = async <T = any>(
    path: string,
    body: HttpBody,
    opts?: RequestOptions,
  ) => {
    return this.request<T>('DELETE', path, opts, body);
  };
}
