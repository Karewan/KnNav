import type { KnHttpErrorCode, KnHttpHeaders } from 'kn-http';

/**
 * Navigation canceled (new navigation, KnNav.abort(), abort signal)
 */
export const CANCELED_ERROR = 'canceled' satisfies KnHttpErrorCode;

/**
 * Network error (server unreachable, no internet...)
 */
export const NETWORK_ERROR = 'network' satisfies KnHttpErrorCode;

/**
 * Request timeout
 */
export const TIMEOUT_ERROR = 'timeout' satisfies KnHttpErrorCode;

/**
 * Invalid HTTP status (not 2xx by default), the error page has not been rendered
 */
export const HTTP_ERROR = 'http' satisfies KnHttpErrorCode;

/**
 * Invalid response (KnHttp parse error)
 */
export const PARSE_ERROR = 'parse' satisfies KnHttpErrorCode;

/**
 * Unknown error (exception thrown in a KnHttp hook, during the rendering...)
 */
export const UNKNOWN_ERROR = 'unknown' satisfies KnHttpErrorCode;

/**
 * The new page does not contain the same elements as the current page (selectors)
 */
export const DOM_ERROR = 'dom';

/**
 * Error codes (KnHttp error codes and DOM error)
 */
export type KnNavErrorCode = KnHttpErrorCode | typeof DOM_ERROR;

/**
 * Error details
 */
export interface KnNavErrorInit {
	/** HTTP status (0 if no response) */
	status?: number;
	/** Response body */
	data?: unknown;
	/** Response headers */
	headers?: KnHttpHeaders;
	/** Original error */
	cause?: unknown;
}

/**
 * Navigation error
 */
export class KnNavError extends Error {
	override readonly name: string = 'KnNavError';

	/** Error code (KnNav.CANCELED_ERROR, NETWORK_ERROR, TIMEOUT_ERROR, HTTP_ERROR, PARSE_ERROR, UNKNOWN_ERROR or DOM_ERROR) */
	readonly code: KnNavErrorCode;

	/** Requested URL */
	readonly url: string;

	/** HTTP status (0 if no response) */
	readonly status: number;

	/** Response body (HTML of the page as text, null if no response) */
	readonly data: unknown;

	/** Response headers (lower case names) */
	readonly headers: KnHttpHeaders;

	/**
	 * Class constructor
	 * @param code
	 * @param message
	 * @param url
	 * @param init
	 */
	constructor(code: KnNavErrorCode, message: string, url: string, init: KnNavErrorInit = {}) {
		super(message, init.cause !== undefined ? { cause: init.cause } : undefined);

		this.code = code;
		this.url = url;
		this.status = init.status ?? 0;
		this.data = init.data ?? null;
		this.headers = init.headers ?? {};
	}
}
