import KnHttp from 'kn-http';
import type { KnHttpClient, KnHttpError, KnHttpHeaders, KnHttpRequest, KnHttpResponse } from 'kn-http';
import { blurActiveElement, executeScripts, focusAutofocus, isNavigableLink, isPageAnchor, matchSelectors, parseHtml, scrollToHash, swapElements, type KnNavSwap } from './dom';
import { CANCELED_ERROR, DOM_ERROR, HTTP_ERROR, KnNavError, NETWORK_ERROR, PARSE_ERROR, TIMEOUT_ERROR, UNKNOWN_ERROR } from './error';
import { createState, currentScroll, readState, type KnNavState } from './history';
import type {
	KnNavAction, KnNavCanceledDetail, KnNavDetail, KnNavErrorDetail, KnNavEventMap, KnNavNavigateOptions, KnNavOptions, KnNavResolvedOptions,
	KnNavResult, KnNavSuccessDetail
} from './types';
import { addQueryParam, getHash, getHeader, removeQueryParam, resolveValue, stripHash } from './utils';

export type * from './types';
export type { KnNavError, KnNavErrorCode, KnNavErrorInit } from './error';

/**
 * Minimum KnHttp version required
 */
const KNHTTP_MIN_VERSION = '4.0.0';

/**
 * Cache bust query parameter
 */
const CACHE_BUST_PARAM = '_kn';

/**
 * Response header forcing a full page load (the value is the URL)
 */
const REDIRECT_HEADER = 'Kn-Redirect';

/**
 * Headers of the navigation requests (can be overridden by the request option)
 */
const REQUEST_HEADERS = {
	'Accept': 'text/html, application/xhtml+xml, */*;q=0.8',
	'X-Requested-With': 'KnNav'
};

/**
 * Options of a navigation with the defaults applied
 */
type KnNavResolvedNavigation = Required<KnNavNavigateOptions>;

/**
 * Navigation in progress
 */
interface KnNavNavigation {
	/** Requested URL (absolute) */
	readonly url: string;
	readonly action: KnNavAction;
	readonly link: HTMLAnchorElement | null;
	readonly options: KnNavResolvedNavigation;
	/** Target history entry of a back / forward navigation (null otherwise) */
	readonly state: KnNavState | null;
	/** Cache bust parameter (name=value) */
	readonly bust: string | null;
	readonly requestUrl: string;
	readonly request: KnHttpRequest<string>;
	readonly resolve: (result: KnNavResult) => void;
	ended: boolean;
}

/**
 * Options (null if KnNav is not initialized)
 */
let config: KnNavResolvedOptions | null = null;

/**
 * Navigation in progress
 */
let current: KnNavNavigation | null = null;

/**
 * Current history entry
 */
let entry: KnNavState | null = null;

/**
 * URL of the displayed page
 */
let pageUrl = '';

/**
 * history.scrollRestoration before KnNav.init
 */
let savedScrollRestoration: ScrollRestoration | null = null;

/**
 * Scroll positions of the history entries (by entry id)
 */
const scrolls = new Map<string, readonly [number, number]>();

/**
 * Built-in default options
 * @returns
 */
function createDefaults(): KnNavResolvedOptions {
	return {
		elements: ['a'],
		selectors: ['head title', '#app'],
		history: true,
		onePageHistory: false,
		scrollRestoration: true,
		scrollToTop: true,
		cacheBust: true,
		renderErrorPages: false,
		client: null,
		request: {}
	};
}

/**
 * Copy the defined values of the known options
 * @param target
 * @param opt
 * @returns
 */
function assignOptions<T extends object>(target: T, opt: object): T {
	const t = target as Record<string, unknown>,
		o = opt as Record<string, unknown>;

	for (const k of Object.keys(t)) {
		if (o[k] !== undefined) t[k] = o[k];
	}

	return target;
}

/**
 * Throw if KnHttp is missing or too old
 * @returns
 */
function checkKnHttp(): void {
	if (typeof KnHttp === 'undefined' || !KnHttp) throw new Error('KnHttp is required');

	const cur = String(KnHttp.VERSION || '0').split('.').map(v => parseInt(v) || 0),
		min = KNHTTP_MIN_VERSION.split('.').map(v => parseInt(v) || 0);

	for (const [i, m] of min.entries()) {
		const c = cur[i] ?? 0;
		if (c > m) return;
		if (c < m) throw new Error('KnHttp >= ' + KNHTTP_MIN_VERSION + ' is required');
	}
}

/**
 * Throw if KnNav is not initialized
 * @returns
 */
function getConfig(): KnNavResolvedOptions {
	if (!config) throw new Error('KnNav is not initialized, call KnNav.init() first');
	return config;
}

/**
 * Resolve an URL of the page origin (null for another origin or protocol)
 * @param url
 * @returns
 */
function resolveUrl(url: string | URL): URL | null {
	try {
		const u = new URL(url, window.location.href);
		return u.protocol == 'http:' || u.protocol == 'https:' ? u : null;
	} catch {
		return null;
	}
}

/**
 * Full page load (http and https URLs only)
 * @param url
 * @param replace Replace the current history entry (one page history)
 * @returns
 */
function loadPage(url: string, replace: boolean): void {
	const u = resolveUrl(url);
	if (!u) return;

	if (replace) window.location.replace(u.href);
	else window.location.assign(u.href);
}

/**
 * Check if a navigation replaces the current history entry (history enabled with onePageHistory or replace)
 * @param opt
 * @returns
 */
function replacesEntry(opt: KnNavResolvedNavigation): boolean {
	return opt.history && opt.replace;
}

/**
 * Options of a navigation (init options overridden by the navigate options)
 * @param opt
 * @returns
 */
function resolveNavigation(opt: KnNavNavigateOptions): KnNavResolvedNavigation {
	const c = getConfig();

	return assignOptions<KnNavResolvedNavigation>({
		selectors: c.selectors,
		history: c.history,
		scrollToTop: c.scrollToTop,
		cacheBust: c.cacheBust,
		renderErrorPages: c.renderErrorPages,
		client: c.client,
		request: c.request,
		replace: c.onePageHistory
	}, opt);
}

/**
 * Dispatch a KnNav event on document
 * @param type
 * @param detail
 * @returns
 */
function dispatch<K extends keyof KnNavEventMap>(type: K, detail: KnNavEventMap[K]['detail']): void {
	document.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

/**
 * Detail of the events of a navigation
 * @param nav
 * @returns
 */
function detail(nav: KnNavNavigation): KnNavDetail {
	return { url: nav.url, action: nav.action, link: nav.link, request: nav.request };
}

/**
 * Start a navigation (the navigation in progress is canceled)
 * @param url Absolute URL
 * @param opt
 * @param action
 * @param link
 * @param state Target history entry of a back / forward navigation
 * @returns
 */
function start(url: string, opt: KnNavResolvedNavigation, action: KnNavAction, link: HTMLAnchorElement | null, state: KnNavState | null): Promise<KnNavResult> {
	//console.log('KnNav.start()', url, action);

	cancel();

	const bust = opt.cacheBust ? CACHE_BUST_PARAM + '=' + Date.now() : null,
		requestUrl = bust ? addQueryParam(stripHash(url), bust) : stripHash(url),
		client: KnHttpClient = opt.client ?? KnHttp,
		req = resolveValue(opt.request);

	return new Promise(resolve => {
		const request = client.get(requestUrl, {
			...req,
			headers: { ...REQUEST_HEADERS, ...req.headers },
			responseType: 'text'
		});

		const nav: KnNavNavigation = { url, action, link, options: opt, state, bust, requestUrl, request, resolve, ended: false };

		current = nav;
		dispatch('kn_nav:send', detail(nav));

		request.then(res => onResponse(nav, res), (err: KnHttpError) => onRequestError(nav, client, err));
	});
}

/**
 * End a navigation (no more navigation in progress)
 * @param nav
 * @returns
 */
function end(nav: KnNavNavigation): void {
	nav.ended = true;
	if (current === nav) current = null;
}

/**
 * Dispatch the complete event and resolve the navigation
 * @param nav
 * @param result
 * @returns
 */
function complete(nav: KnNavNavigation, result: KnNavResult): void {
	dispatch('kn_nav:complete', result);
	nav.resolve(result);
}

/**
 * Cancel the navigation in progress
 * @returns
 */
function cancel(): void {
	const nav = current;
	if (!nav) return;

	end(nav);
	nav.request.abort();
	complete(nav, canceledResult(nav));
}

/**
 * Result of a canceled navigation
 * @param nav
 * @returns
 */
function canceledResult(nav: KnNavNavigation): KnNavCanceledDetail {
	return { ...detail(nav), status: 0, headers: {}, success: false, canceled: true, error: null };
}

/**
 * End a navigation with an error
 * @param nav
 * @param error
 * @returns
 */
function fail(nav: KnNavNavigation, error: KnNavError): void {
	end(nav);

	const result: KnNavErrorDetail = { ...detail(nav), status: error.status, headers: error.headers, success: false, canceled: false, error };

	dispatch('kn_nav:error', result);
	complete(nav, result);
}

/**
 * Full page load if the response has a Kn-Redirect header
 * @param nav
 * @param headers
 * @returns True if the page is redirected
 */
function serverRedirect(nav: KnNavNavigation, headers: KnHttpHeaders): boolean {
	const url = getHeader(headers, REDIRECT_HEADER);
	if (!url || !resolveUrl(url)) return false;

	end(nav);
	loadPage(url, replacesEntry(nav.options));
	return true;
}

/**
 * Success response (2xx)
 * @param nav
 * @param res
 * @returns
 */
function onResponse(nav: KnNavNavigation, res: KnHttpResponse<string>): void {
	if (nav.ended || serverRedirect(nav, res.headers)) return;
	render(nav, res.data, res.status, res.headers, null);
}

/**
 * Error response (HTTP error, network, timeout, cancel...)
 * @param nav
 * @param client
 * @param err
 * @returns
 */
function onRequestError(nav: KnNavNavigation, client: KnHttpClient, err: unknown): void {
	if (nav.ended) return;

	if (!client.isKnHttpError(err)) {
		fail(nav, new KnNavError(UNKNOWN_ERROR, 'Unknown error', nav.url, { cause: err }));
		return;
	}

	// Canceled by the abort signal or the request object
	if (err.code == CANCELED_ERROR) {
		end(nav);
		complete(nav, canceledResult(nav));
		return;
	}

	if (err.code == HTTP_ERROR) {
		if (serverRedirect(nav, err.headers)) return;

		// Error page containing the selectors
		if (nav.options.renderErrorPages && typeof err.data == 'string' && render(nav, err.data, err.status, err.headers, err)) return;
	}

	fail(nav, new KnNavError(err.code, err.message, nav.url, { status: err.status, data: err.data, headers: err.headers, cause: err }));
}

/**
 * URL of the loaded page: URL after the redirections, without the cache bust parameter, with the requested anchor
 * @param nav
 * @returns
 */
function responseUrl(nav: KnNavNavigation): string {
	let url = nav.request.xhr.responseURL || nav.requestUrl;

	if (nav.bust) url = removeQueryParam(url, nav.bust);

	const hash = getHash(nav.url);
	if (hash && !getHash(url)) url = stripHash(url) + hash;

	return url;
}

/**
 * Render the loaded page
 * @param nav
 * @param html
 * @param status
 * @param headers
 * @param httpError HTTP error of an error page (renderErrorPages)
 * @returns False if the error page does not contain the selectors (not rendered)
 */
function render(nav: KnNavNavigation, html: string, status: number, headers: KnHttpHeaders, httpError: KnHttpError | null): boolean {
	//console.log('KnNav.render()', nav.url, status);

	let swaps: KnNavSwap[];

	// Elements to replace (checked before any change of the page)
	try {
		const match = matchSelectors(parseHtml(html), nav.options.selectors);

		if (!match.ok) {
			if (httpError) return false;
			fail(nav, new KnNavError(DOM_ERROR, match.message, nav.url, { status, data: html, headers }));
			return true;
		}

		swaps = match.swaps;
	} catch (e) {
		if (httpError) return false;
		fail(nav, new KnNavError(UNKNOWN_ERROR, 'Unknown error', nav.url, { status, data: html, headers, cause: e }));
		return true;
	}

	const url = responseUrl(nav);

	// Redirected to another origin
	if (!resolveUrl(url) || new URL(url).origin !== window.location.origin) {
		end(nav);
		loadPage(url, replacesEntry(nav.options));
		return true;
	}

	end(nav);

	let elements: Element[];

	try {
		updateHistory(nav, url);
		pageUrl = window.location.href;

		blurActiveElement();
		elements = swapElements(swaps);

		// Layout change (lazy loading, sticky elements...)
		window.dispatchEvent(new Event('resize'));
		window.dispatchEvent(new Event('scroll'));

		focusAutofocus(elements);
	} catch (e) {
		fail(nav, new KnNavError(UNKNOWN_ERROR, 'Unknown error', nav.url, { status, data: html, headers, cause: e }));
		return true;
	}

	const result: KnNavSuccessDetail = { ...detail(nav), status, headers, success: true, canceled: false, error: null };

	dispatch('kn_nav:success', result);

	try {
		executeScripts(elements);

		if (nav.state) restoreScroll(nav.state, url);
		else if (!scrollToHash(getHash(url)) && nav.options.scrollToTop) window.scrollTo(0, 0);
	} finally {
		complete(nav, result);
	}

	return true;
}

/**
 * Save the scroll position of the current history entry
 * @returns
 */
function saveScroll(): void {
	const state = readState(window.history.state);
	if (!state) return;

	const scroll = currentScroll();
	scrolls.set(state.id, scroll);

	try {
		window.history.replaceState({ ...state, scroll }, '');
	} catch {
		// Too many history updates (Safari), the position is kept in memory
	}
}

/**
 * Restore the scroll position of a history entry (back / forward)
 * @param state
 * @param url
 * @returns
 */
function restoreScroll(state: KnNavState, url: string): void {
	if (!config?.scrollRestoration) return;

	const scroll = scrolls.get(state.id) ?? (state.scroll[0] || state.scroll[1] ? state.scroll : null);

	if (scroll) window.scrollTo(scroll[0], scroll[1]);
	else if (!scrollToHash(getHash(url))) window.scrollTo(0, 0);
}

/**
 * Update the history after a navigation
 * @param nav
 * @param url URL of the loaded page
 * @returns
 */
function updateHistory(nav: KnNavNavigation, url: string): void {
	// Back / forward: the entry is already the current one, its URL is updated after a redirection
	if (nav.state) {
		if (url !== window.location.href && entry?.id === nav.state.id) {
			entry = { ...nav.state, url };
			window.history.replaceState(entry, '', url);
		}
		return;
	}

	// History disabled: the URL and the history are not modified
	if (!nav.options.history) return;

	// Same URL: the current entry is replaced (as the browser does)
	const replace = nav.options.replace || url === window.location.href,
		index = entry?.index ?? 0;

	// Scroll position of the page left (restored on back)
	if (!replace) saveScroll();

	entry = createState(url, replace ? index : index + 1);

	if (replace) window.history.replaceState(entry, '', url);
	else window.history.pushState(entry, '', url);
}

/**
 * Click on a link
 * @param e
 * @returns
 */
function onClick(e: MouseEvent): void {
	const c = config;
	if (!c || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return;

	// One page history: the anchors of the page replace the current history entry instead of adding one (scroll, :target and hashchange kept)
	if (c.history && c.onePageHistory) {
		const anchor = e.target.closest('a');

		if (anchor instanceof HTMLAnchorElement && isPageAnchor(anchor)) {
			e.preventDefault();
			window.location.replace(anchor.href);
			return;
		}
	}

	if (!c.elements.length) return;

	const link = e.target.closest(c.elements.join(', '));
	if (!(link instanceof HTMLAnchorElement) || !isNavigableLink(link)) return;

	e.preventDefault();
	void start(link.href, resolveNavigation({}), 'link', link, null);
}

/**
 * Back / forward
 * @param e
 * @returns
 */
function onPopState(e: PopStateEvent): void {
	if (!config) return;

	const known = readState(e.state);

	// Entry of the application (history.pushState called by another script): not handled by KnNav
	if (!known && e.state != null) return;

	// Scroll position of the page left (unknown during a back / forward navigation)
	if (entry && !current?.state) scrolls.set(entry.id, currentScroll());

	const previous = entry,
		url = window.location.href;

	// Entry created by the browser (anchor of the page): KnNav state added (not if the history is disabled)
	let state = known;
	if (!state && config.history) {
		state = createState(url, (previous?.index ?? 0) + 1);
		window.history.replaceState(state, '');
	}

	entry = state;

	// Same page (anchor): no request
	if (stripHash(url) === stripHash(pageUrl)) {
		cancel();
		pageUrl = url;
		if (known) restoreScroll(known, url);
		return;
	}

	// Entry without KnNav state (history disabled): not handled
	if (!state) return;

	const back = !!previous && state.index < previous.index;
	void start(url, resolveNavigation({}), back ? 'back' : 'forward', null, state);
}

/**
 * Init KnNav (a second call replaces the options)
 * @param opt
 * @returns
 */
function init(opt: KnNavOptions = {}): void {
	//console.log('KnNav.init()', opt);

	checkKnHttp();

	const c = assignOptions(createDefaults(), opt);

	// Selectors check (a SyntaxError is thrown if a selector is invalid)
	if (c.elements.length) {
		for (const el of Array.from(document.querySelectorAll(c.elements.join(', ')))) {
			if (el.localName != 'a') throw new TypeError(`KnNav can only be applied on <a> elements, <${el.localName}> found`);
		}
	}

	for (const selector of c.selectors) document.querySelector(selector);

	destroy();

	config = c;
	pageUrl = window.location.href;

	// History entry of the page (the history is not modified if it is disabled)
	entry = readState(window.history.state);
	if (!entry && c.history && window.history.state == null) {
		entry = createState(pageUrl, 0);
		window.history.replaceState(entry, '');
	}

	if (c.history && c.scrollRestoration && 'scrollRestoration' in window.history) {
		savedScrollRestoration = window.history.scrollRestoration;
		window.history.scrollRestoration = 'manual';
	}

	window.addEventListener('click', onClick);
	window.addEventListener('popstate', onPopState);
}

/**
 * Navigate to an URL (another origin is loaded without KnNav)
 * @param url
 * @param opt Options of the navigation (init options by default)
 * @returns Result of the navigation (never rejected)
 */
function navigate(url: string | URL, opt: KnNavNavigateOptions = {}): Promise<KnNavResult> {
	//console.log('KnNav.navigate()', url, opt);

	const nav = resolveNavigation(opt),
		target = resolveUrl(url);

	if (!target) throw new TypeError('KnNav: invalid URL ' + String(url));

	// Other origin: full page load
	if (target.origin !== window.location.origin) {
		loadPage(target.href, replacesEntry(nav));
		return new Promise(() => {});
	}

	return start(target.href, nav, 'navigate', null, null);
}

/**
 * Cancel the navigation in progress (kn_nav:complete is dispatched with canceled = true)
 * @returns
 */
function abort(): void {
	cancel();
}

/**
 * Reload the page (full page load)
 * @returns
 */
function reload(): void {
	window.location.reload();
}

/**
 * Stop KnNav: cancel the navigation in progress and remove the listeners
 * @returns
 */
function destroy(): void {
	if (!config) return;

	cancel();

	window.removeEventListener('click', onClick);
	window.removeEventListener('popstate', onPopState);

	if (savedScrollRestoration) {
		window.history.scrollRestoration = savedScrollRestoration;
		savedScrollRestoration = null;
	}

	config = null;
	entry = null;
	pageUrl = '';
	scrolls.clear();
}

/**
 * Check if a value is a KnNav error
 * @param err
 * @returns
 */
function isKnNavError(err: unknown): err is KnNavError {
	return err instanceof KnNavError;
}

/**
 * KnNav
 */
const KnNav = {
	/** LIB VERSION */
	VERSION: __KN_NAV_VERSION__ as string,

	/** MINIMUM KNHTTP VERSION REQUIRED */
	KNHTTP_MIN_VERSION: KNHTTP_MIN_VERSION as string,

	/**
	 * ERRORS CODES
	 */
	CANCELED_ERROR,
	NETWORK_ERROR,
	TIMEOUT_ERROR,
	HTTP_ERROR,
	PARSE_ERROR,
	UNKNOWN_ERROR,
	DOM_ERROR,

	/**
	 * Options (null if KnNav is not initialized), can be updated
	 */
	get options(): KnNavResolvedOptions | null {
		return config;
	},

	/**
	 * True if a navigation is in progress
	 */
	get loading(): boolean {
		return current !== null;
	},

	init,
	navigate,
	abort,
	reload,
	destroy,
	isKnNavError
} as const;

export default KnNav;
