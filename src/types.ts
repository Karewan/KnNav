import type { KnHttpBaseOptions, KnHttpClient, KnHttpHeaders, KnHttpRequest } from 'kn-http';
import type { KnNavError } from './error';

export type { KnHttpBaseOptions, KnHttpClient, KnHttpError, KnHttpHeaders, KnHttpRequest, KnHttpResponse } from 'kn-http';

/**
 * Value or function returning the value (evaluated at each navigation)
 */
export type KnNavValue<T> = T | (() => T);

/**
 * KnHttp options of the navigation requests (timeout, headers, retry, signal...)
 */
export type KnNavRequestOptions = Omit<KnHttpBaseOptions, 'params' | 'upload'>;

/**
 * Options of a navigation (KnNav.init and KnNav.navigate)
 */
export interface KnNavNavigationOptions {
	/** Elements replaced by each navigation (CSS selectors), the new page must contain the same number of elements for each selector */
	selectors?: readonly string[];
	/** Update the URL and the browser history (false: the history is never modified) */
	history?: boolean;
	/** Scroll to the top of the page after a new navigation (the anchor of the URL has priority) */
	scrollToTop?: boolean;
	/** Add a query parameter (_kn=<time in ms>) to the request URL to bypass the browser cache */
	cacheBust?: boolean;
	/** Render the HTTP error responses (404, 500...) containing the selectors, as a success */
	renderErrorPages?: boolean;
	/** KnHttp instance used for the requests (KnHttp.create()), null = default KnHttp instance */
	client?: KnHttpClient | null;
	/** KnHttp options of the requests (timeout, headers, retry, signal...) */
	request?: KnNavValue<KnNavRequestOptions>;
}

/**
 * Options of KnNav.init
 */
export interface KnNavOptions extends KnNavNavigationOptions {
	/** Links handled by KnNav (CSS selectors of <a> elements, the links added later are handled too) */
	elements?: readonly string[];
	/** With history: the history only has one entry, the last page (the navigations, the anchors of the page and Kn-Redirect replace the current entry) */
	onePageHistory?: boolean;
	/** Restore the scroll position on back / forward */
	scrollRestoration?: boolean;
}

/**
 * Options of KnNav.init with the defaults applied (KnNav.options)
 */
export type KnNavResolvedOptions = Required<KnNavOptions>;

/**
 * Options of KnNav.navigate
 */
export interface KnNavNavigateOptions extends KnNavNavigationOptions {
	/** Replace the current history entry instead of adding a new one (default: onePageHistory) */
	replace?: boolean;
}

/**
 * Origin of a navigation
 * - link: click on a link
 * - navigate: KnNav.navigate()
 * - back / forward: browser history
 */
export type KnNavAction = 'link' | 'navigate' | 'back' | 'forward';

/**
 * Navigation (detail of the kn_nav:send event)
 */
export interface KnNavDetail {
	/** Requested URL (absolute) */
	readonly url: string;
	/** Origin of the navigation */
	readonly action: KnNavAction;
	/** Clicked link (null if the action is not link) */
	readonly link: HTMLAnchorElement | null;
	/** KnHttp request (request.xhr: XMLHttpRequest) */
	readonly request: KnHttpRequest<string>;
}

/**
 * Ended navigation (common properties of the results)
 */
export interface KnNavEndDetail extends KnNavDetail {
	/** HTTP status (0 if no response) */
	readonly status: number;
	/** Response headers (lower case names, empty if no response) */
	readonly headers: KnHttpHeaders;
}

/**
 * Rendered page (detail of the kn_nav:success event), status is not 2xx for an error page rendered with renderErrorPages
 */
export interface KnNavSuccessDetail extends KnNavEndDetail {
	readonly success: true;
	readonly canceled: false;
	readonly error: null;
}

/**
 * Failed navigation (detail of the kn_nav:error event)
 */
export interface KnNavErrorDetail extends KnNavEndDetail {
	readonly success: false;
	readonly canceled: false;
	/** Navigation error */
	readonly error: KnNavError;
}

/**
 * Canceled navigation (new navigation, KnNav.abort(), abort signal)
 */
export interface KnNavCanceledDetail extends KnNavEndDetail {
	readonly success: false;
	readonly canceled: true;
	readonly error: null;
}

/**
 * Result of a navigation (detail of the kn_nav:complete event and result of KnNav.navigate())
 */
export type KnNavResult = KnNavSuccessDetail | KnNavErrorDetail | KnNavCanceledDetail;

/**
 * KnNav events (dispatched on document, they bubble to window)
 */
export interface KnNavEventMap {
	/** Navigation start (request sent) */
	'kn_nav:send': CustomEvent<KnNavDetail>;
	/** Page rendered (before the execution of its scripts) */
	'kn_nav:success': CustomEvent<KnNavSuccessDetail>;
	/** Navigation failed (not dispatched on cancel) */
	'kn_nav:error': CustomEvent<KnNavErrorDetail>;
	/** End of the navigation, always dispatched last (success, error or cancel) */
	'kn_nav:complete': CustomEvent<KnNavResult>;
}

/**
 * Typed events: document.addEventListener('kn_nav:success', e => e.detail.status)
 */
declare global {
	interface DocumentEventMap extends KnNavEventMap {}
	interface WindowEventMap extends KnNavEventMap {}
}
