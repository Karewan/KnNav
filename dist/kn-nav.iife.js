/**
 * KnNav v1.0.0 (2026-09-24T13:29:01.160Z)
 * Copyright (c) 2022 - 2026 Florent VIALATTE
 * Released under the MIT license
 */
var KnNav = (function(kn_http) {
	//#region \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: ((k) => from[k]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	//#endregion
	kn_http = __toESM(kn_http, 1);
	//#region src/utils.ts
	/**
	* Resolve a value or a function returning the value
	* @param value
	* @returns
	*/
	function resolveValue(value) {
		return typeof value === "function" ? value() : value;
	}
	/**
	* Get a response header (case insensitive)
	* @param headers
	* @param name
	* @returns
	*/
	function getHeader(headers, name) {
		name = name.toLowerCase();
		for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() == name) return v;
		return null;
	}
	/**
	* URL without the hash
	* @param url
	* @returns
	*/
	function stripHash(url) {
		const i = url.indexOf("#");
		return i >= 0 ? url.slice(0, i) : url;
	}
	/**
	* Hash of an URL ('' if none)
	* @param url
	* @returns
	*/
	function getHash(url) {
		const i = url.indexOf("#");
		return i >= 0 ? url.slice(i) : "";
	}
	/**
	* Add a query parameter (name=value) at the end of the query string, the existing parameters are kept as is
	* @param url
	* @param param
	* @returns
	*/
	function addQueryParam(url, param) {
		const base = stripHash(url);
		return base + (!base.includes("?") ? "?" : base.endsWith("?") || base.endsWith("&") ? "" : "&") + param + getHash(url);
	}
	/**
	* Remove a query parameter (name=value) from the query string, the other parameters are kept as is
	* @param url
	* @param param
	* @returns
	*/
	function removeQueryParam(url, param) {
		const base = stripHash(url), i = base.indexOf("?");
		if (i < 0) return url;
		const query = base.slice(i + 1).split("&").filter((p) => p !== param).join("&");
		return base.slice(0, i) + (query ? "?" + query : "") + getHash(url);
	}
	//#endregion
	//#region src/dom.ts
	/**
	* Parse an HTML page (the scripts are not executed)
	* @param html
	* @returns
	*/
	function parseHtml(html) {
		return new DOMParser().parseFromString(html, "text/html");
	}
	/**
	* Match the elements of the current page and of the new page (same number of elements for each selector)
	* @param doc New page
	* @param selectors
	* @returns
	*/
	function matchSelectors(doc, selectors) {
		const swaps = [];
		for (const selector of selectors) {
			const next = doc.querySelectorAll(selector), current = document.querySelectorAll(selector);
			if (next.length !== current.length) return {
				ok: false,
				message: `DOM doesn't look the same on the new page: '${selector}' - new ${next.length}, old ${current.length}`
			};
			for (let i = 0; i < next.length; i++) {
				const n = next[i], c = current[i];
				if (n && c) swaps.push({
					current: c,
					next: n
				});
			}
		}
		if (!swaps.length) return {
			ok: false,
			message: `No element to replace: '${selectors.join(", ")}'`
		};
		return {
			ok: true,
			swaps
		};
	}
	/**
	* Replace the elements of the current page (the scripts of the new elements are not executed)
	* @param swaps
	* @returns New elements
	*/
	function swapElements(swaps) {
		return swaps.map(({ current, next }) => {
			const el = document.adoptNode(next);
			current.replaceWith(el);
			return el;
		});
	}
	/**
	* Execute the scripts of the new elements, in the order of the page
	* @param elements
	* @returns
	*/
	function executeScripts(elements) {
		for (const el of elements) {
			const scripts = el.localName == "script" ? [el] : Array.from(el.querySelectorAll("script"));
			for (const script of scripts) if (script instanceof HTMLScriptElement) runScript(script);
		}
	}
	/**
	* Execute a script: the script (inert once parsed) is replaced by a copy
	* @param old
	* @returns
	*/
	function runScript(old) {
		if (!old.isConnected) return;
		const code = old.text;
		if (code.includes("document.write")) {
			console.warn("KnNav: script skipped (document.write)", old);
			return;
		}
		const script = document.createElement("script");
		for (const { name, value } of Array.from(old.attributes)) try {
			script.setAttribute(name, value);
		} catch {}
		if (old.nonce) script.nonce = old.nonce;
		if (script.src && !script.hasAttribute("async")) script.async = false;
		script.text = code;
		old.replaceWith(script);
	}
	/**
	* Remove the focus of the focused element
	* @returns
	*/
	function blurActiveElement() {
		const el = document.activeElement;
		if (el instanceof HTMLElement) el.blur();
	}
	/**
	* Focus the last element with the autofocus attribute of the new elements
	* @param elements
	* @returns
	*/
	function focusAutofocus(elements) {
		let target = null;
		for (const el of elements) {
			const found = el.matches("[autofocus]") ? [el] : Array.from(el.querySelectorAll("[autofocus]"));
			for (const f of found) if (f instanceof HTMLElement) target = f;
		}
		if (target && document.activeElement !== target) target.focus({ preventScroll: true });
	}
	/**
	* Scroll to the element of an anchor (#id or name)
	* @param hash
	* @returns False if the element is not found
	*/
	function scrollToHash(hash) {
		if (hash.length < 2) return false;
		let id = hash.slice(1);
		try {
			id = decodeURIComponent(id);
		} catch {}
		const target = document.getElementById(id) ?? document.getElementsByName(id)[0];
		if (!target) return false;
		target.scrollIntoView();
		return true;
	}
	/**
	* Check if a link opens its URL in the current page
	* - href attribute, no download attribute, no other target than _self
	* - no data-kn-nav="false" attribute on the link or its parents
	* @param link
	* @returns
	*/
	function isSelfLink(link) {
		if (!link.hasAttribute("href") || link.hasAttribute("download") || link.closest("[data-kn-nav=\"false\"]")) return false;
		const target = link.target.trim().toLowerCase();
		return !target || target == "_self";
	}
	/**
	* Check if a link is an anchor of the current page (#section)
	* @param link
	* @returns
	*/
	function isPageAnchor(link) {
		return isSelfLink(link) && link.href.includes("#") && stripHash(link.href) === stripHash(window.location.href);
	}
	/**
	* Check if a link can be loaded by KnNav
	* - href attribute, no download attribute, no other target than _self
	* - no data-kn-nav="false" attribute on the link or its parents
	* - same origin, not an anchor of the current page
	* @param link
	* @returns
	*/
	function isNavigableLink(link) {
		if (!isSelfLink(link)) return false;
		let url;
		try {
			url = new URL(link.href);
		} catch {
			return false;
		}
		if (url.origin !== window.location.origin) return false;
		if (link.href.includes("#") && stripHash(url.href) === stripHash(window.location.href)) return false;
		return true;
	}
	//#endregion
	//#region src/error.ts
	/**
	* Navigation canceled (new navigation, KnNav.abort(), abort signal)
	*/
	var CANCELED_ERROR = "canceled";
	/**
	* Network error (server unreachable, no internet...)
	*/
	var NETWORK_ERROR = "network";
	/**
	* Request timeout
	*/
	var TIMEOUT_ERROR = "timeout";
	/**
	* Invalid HTTP status (not 2xx by default), the error page has not been rendered
	*/
	var HTTP_ERROR = "http";
	/**
	* Invalid response (KnHttp parse error)
	*/
	var PARSE_ERROR = "parse";
	/**
	* Unknown error (exception thrown in a KnHttp hook, during the rendering...)
	*/
	var UNKNOWN_ERROR = "unknown";
	/**
	* Navigation error
	*/
	var KnNavError = class extends Error {
		name = "KnNavError";
		/** Error code (KnNav.CANCELED_ERROR, NETWORK_ERROR, TIMEOUT_ERROR, HTTP_ERROR, PARSE_ERROR, UNKNOWN_ERROR or DOM_ERROR) */
		code;
		/** Requested URL */
		url;
		/** HTTP status (0 if no response) */
		status;
		/** Response body (HTML of the page as text, null if no response) */
		data;
		/** Response headers (lower case names) */
		headers;
		/**
		* Class constructor
		* @param code
		* @param message
		* @param url
		* @param init
		*/
		constructor(code, message, url, init = {}) {
			super(message, init.cause !== void 0 ? { cause: init.cause } : void 0);
			this.code = code;
			this.url = url;
			this.status = init.status ?? 0;
			this.data = init.data ?? null;
			this.headers = init.headers ?? {};
		}
	};
	//#endregion
	//#region src/history.ts
	var idCounter = 0;
	/**
	* Create a history state
	* @param url
	* @param index
	* @returns
	*/
	function createState(url, index) {
		return {
			knNav: 1,
			id: Date.now().toString(36) + "-" + (idCounter++).toString(36) + "-" + Math.random().toString(36).slice(2, 8),
			index,
			url,
			scroll: [0, 0]
		};
	}
	/**
	* Check if a value is a scroll position
	* @param value
	* @returns
	*/
	function isScroll(value) {
		return Array.isArray(value) && value.length == 2 && typeof value[0] == "number" && typeof value[1] == "number";
	}
	/**
	* Read a history state (null if the state has not been created by KnNav)
	* @param state
	* @returns
	*/
	function readState(state) {
		if (typeof state !== "object" || state === null) return null;
		const s = state;
		if (s["knNav"] === 1 && typeof s["id"] == "string" && typeof s["index"] == "number" && typeof s["url"] == "string") return {
			knNav: 1,
			id: s["id"],
			index: s["index"],
			url: s["url"],
			scroll: isScroll(s["scroll"]) ? s["scroll"] : [0, 0]
		};
		if (typeof s["url"] == "string" && typeof s["uid"] == "string") return {
			knNav: 1,
			id: s["uid"],
			index: -1,
			url: s["url"],
			scroll: isScroll(s["scrollPos"]) ? s["scrollPos"] : [0, 0]
		};
		return null;
	}
	/**
	* Current scroll position
	* @returns
	*/
	function currentScroll() {
		return [window.scrollX, window.scrollY];
	}
	//#endregion
	//#region src/kn-nav.ts
	/**
	* Minimum KnHttp version required
	*/
	var KNHTTP_MIN_VERSION = "4.0.0";
	/**
	* Response header forcing a full page load (the value is the URL)
	*/
	var REDIRECT_HEADER = "Kn-Redirect";
	/**
	* Headers of the navigation requests (can be overridden by the request option)
	*/
	var REQUEST_HEADERS = {
		"Accept": "text/html, application/xhtml+xml, */*;q=0.8",
		"X-Requested-With": "KnNav"
	};
	/**
	* Options (null if KnNav is not initialized)
	*/
	var config = null;
	/**
	* Navigation in progress
	*/
	var current = null;
	/**
	* Current history entry
	*/
	var entry = null;
	/**
	* URL of the displayed page
	*/
	var pageUrl = "";
	/**
	* history.scrollRestoration before KnNav.init
	*/
	var savedScrollRestoration = null;
	/**
	* Scroll positions of the history entries (by entry id)
	*/
	var scrolls = /* @__PURE__ */ new Map();
	/**
	* Built-in default options
	* @returns
	*/
	function createDefaults() {
		return {
			elements: ["a"],
			selectors: ["head title", "#app"],
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
	function assignOptions(target, opt) {
		const t = target, o = opt;
		for (const k of Object.keys(t)) if (o[k] !== void 0) t[k] = o[k];
		return target;
	}
	/**
	* Throw if KnHttp is missing or too old
	* @returns
	*/
	function checkKnHttp() {
		if (typeof kn_http.default === "undefined" || !kn_http.default) throw new Error("KnHttp is required");
		const cur = String(kn_http.default.VERSION || "0").split(".").map((v) => parseInt(v) || 0), min = KNHTTP_MIN_VERSION.split(".").map((v) => parseInt(v) || 0);
		for (const [i, m] of min.entries()) {
			const c = cur[i] ?? 0;
			if (c > m) return;
			if (c < m) throw new Error("KnHttp >= 4.0.0 is required");
		}
	}
	/**
	* Throw if KnNav is not initialized
	* @returns
	*/
	function getConfig() {
		if (!config) throw new Error("KnNav is not initialized, call KnNav.init() first");
		return config;
	}
	/**
	* Resolve an URL of the page origin (null for another origin or protocol)
	* @param url
	* @returns
	*/
	function resolveUrl(url) {
		try {
			const u = new URL(url, window.location.href);
			return u.protocol == "http:" || u.protocol == "https:" ? u : null;
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
	function loadPage(url, replace) {
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
	function replacesEntry(opt) {
		return opt.history && opt.replace;
	}
	/**
	* Options of a navigation (init options overridden by the navigate options)
	* @param opt
	* @returns
	*/
	function resolveNavigation(opt) {
		const c = getConfig();
		return assignOptions({
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
	function dispatch(type, detail) {
		document.dispatchEvent(new CustomEvent(type, {
			detail,
			bubbles: true
		}));
	}
	/**
	* Detail of the events of a navigation
	* @param nav
	* @returns
	*/
	function detail(nav) {
		return {
			url: nav.url,
			action: nav.action,
			link: nav.link,
			request: nav.request
		};
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
	function start(url, opt, action, link, state) {
		cancel();
		const bust = opt.cacheBust ? "_kn=" + Date.now() : null, requestUrl = bust ? addQueryParam(stripHash(url), bust) : stripHash(url), client = opt.client ?? kn_http.default, req = resolveValue(opt.request);
		return new Promise((resolve) => {
			const request = client.get(requestUrl, {
				...req,
				headers: {
					...REQUEST_HEADERS,
					...req.headers
				},
				responseType: "text"
			});
			const nav = {
				url,
				action,
				link,
				options: opt,
				state,
				bust,
				requestUrl,
				request,
				resolve,
				ended: false
			};
			current = nav;
			dispatch("kn_nav:send", detail(nav));
			request.then((res) => onResponse(nav, res), (err) => onRequestError(nav, client, err));
		});
	}
	/**
	* End a navigation (no more navigation in progress)
	* @param nav
	* @returns
	*/
	function end(nav) {
		nav.ended = true;
		if (current === nav) current = null;
	}
	/**
	* Dispatch the complete event and resolve the navigation
	* @param nav
	* @param result
	* @returns
	*/
	function complete(nav, result) {
		dispatch("kn_nav:complete", result);
		nav.resolve(result);
	}
	/**
	* Cancel the navigation in progress
	* @returns
	*/
	function cancel() {
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
	function canceledResult(nav) {
		return {
			...detail(nav),
			status: 0,
			headers: {},
			success: false,
			canceled: true,
			error: null
		};
	}
	/**
	* End a navigation with an error
	* @param nav
	* @param error
	* @returns
	*/
	function fail(nav, error) {
		end(nav);
		const result = {
			...detail(nav),
			status: error.status,
			headers: error.headers,
			success: false,
			canceled: false,
			error
		};
		dispatch("kn_nav:error", result);
		complete(nav, result);
	}
	/**
	* Full page load if the response has a Kn-Redirect header
	* @param nav
	* @param headers
	* @returns True if the page is redirected
	*/
	function serverRedirect(nav, headers) {
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
	function onResponse(nav, res) {
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
	function onRequestError(nav, client, err) {
		if (nav.ended) return;
		if (!client.isKnHttpError(err)) {
			fail(nav, new KnNavError(UNKNOWN_ERROR, "Unknown error", nav.url, { cause: err }));
			return;
		}
		if (err.code == "canceled") {
			end(nav);
			complete(nav, canceledResult(nav));
			return;
		}
		if (err.code == "http") {
			if (serverRedirect(nav, err.headers)) return;
			if (nav.options.renderErrorPages && typeof err.data == "string" && render(nav, err.data, err.status, err.headers, err)) return;
		}
		fail(nav, new KnNavError(err.code, err.message, nav.url, {
			status: err.status,
			data: err.data,
			headers: err.headers,
			cause: err
		}));
	}
	/**
	* URL of the loaded page: URL after the redirections, without the cache bust parameter, with the requested anchor
	* @param nav
	* @returns
	*/
	function responseUrl(nav) {
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
	function render(nav, html, status, headers, httpError) {
		let swaps;
		try {
			const match = matchSelectors(parseHtml(html), nav.options.selectors);
			if (!match.ok) {
				if (httpError) return false;
				fail(nav, new KnNavError("dom", match.message, nav.url, {
					status,
					data: html,
					headers
				}));
				return true;
			}
			swaps = match.swaps;
		} catch (e) {
			if (httpError) return false;
			fail(nav, new KnNavError(UNKNOWN_ERROR, "Unknown error", nav.url, {
				status,
				data: html,
				headers,
				cause: e
			}));
			return true;
		}
		const url = responseUrl(nav);
		if (!resolveUrl(url) || new URL(url).origin !== window.location.origin) {
			end(nav);
			loadPage(url, replacesEntry(nav.options));
			return true;
		}
		end(nav);
		let elements;
		try {
			updateHistory(nav, url);
			pageUrl = window.location.href;
			blurActiveElement();
			elements = swapElements(swaps);
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("scroll"));
			focusAutofocus(elements);
		} catch (e) {
			fail(nav, new KnNavError(UNKNOWN_ERROR, "Unknown error", nav.url, {
				status,
				data: html,
				headers,
				cause: e
			}));
			return true;
		}
		const result = {
			...detail(nav),
			status,
			headers,
			success: true,
			canceled: false,
			error: null
		};
		dispatch("kn_nav:success", result);
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
	function saveScroll() {
		const state = readState(window.history.state);
		if (!state) return;
		const scroll = currentScroll();
		scrolls.set(state.id, scroll);
		try {
			window.history.replaceState({
				...state,
				scroll
			}, "");
		} catch {}
	}
	/**
	* Restore the scroll position of a history entry (back / forward)
	* @param state
	* @param url
	* @returns
	*/
	function restoreScroll(state, url) {
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
	function updateHistory(nav, url) {
		if (nav.state) {
			if (url !== window.location.href && entry?.id === nav.state.id) {
				entry = {
					...nav.state,
					url
				};
				window.history.replaceState(entry, "", url);
			}
			return;
		}
		if (!nav.options.history) return;
		const replace = nav.options.replace || url === window.location.href, index = entry?.index ?? 0;
		if (!replace) saveScroll();
		entry = createState(url, replace ? index : index + 1);
		if (replace) window.history.replaceState(entry, "", url);
		else window.history.pushState(entry, "", url);
	}
	/**
	* Click on a link
	* @param e
	* @returns
	*/
	function onClick(e) {
		const c = config;
		if (!c || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return;
		if (c.history && c.onePageHistory) {
			const anchor = e.target.closest("a");
			if (anchor instanceof HTMLAnchorElement && isPageAnchor(anchor)) {
				e.preventDefault();
				window.location.replace(anchor.href);
				return;
			}
		}
		if (!c.elements.length) return;
		const link = e.target.closest(c.elements.join(", "));
		if (!(link instanceof HTMLAnchorElement) || !isNavigableLink(link)) return;
		e.preventDefault();
		start(link.href, resolveNavigation({}), "link", link, null);
	}
	/**
	* Back / forward
	* @param e
	* @returns
	*/
	function onPopState(e) {
		if (!config) return;
		const known = readState(e.state);
		if (!known && e.state != null) return;
		if (entry && !current?.state) scrolls.set(entry.id, currentScroll());
		const previous = entry, url = window.location.href;
		let state = known;
		if (!state && config.history) {
			state = createState(url, (previous?.index ?? 0) + 1);
			window.history.replaceState(state, "");
		}
		entry = state;
		if (stripHash(url) === stripHash(pageUrl)) {
			cancel();
			pageUrl = url;
			if (known) restoreScroll(known, url);
			return;
		}
		if (!state) return;
		const back = !!previous && state.index < previous.index;
		start(url, resolveNavigation({}), back ? "back" : "forward", null, state);
	}
	/**
	* Init KnNav (a second call replaces the options)
	* @param opt
	* @returns
	*/
	function init(opt = {}) {
		checkKnHttp();
		const c = assignOptions(createDefaults(), opt);
		if (c.elements.length) {
			for (const el of Array.from(document.querySelectorAll(c.elements.join(", ")))) if (el.localName != "a") throw new TypeError(`KnNav can only be applied on <a> elements, <${el.localName}> found`);
		}
		for (const selector of c.selectors) document.querySelector(selector);
		destroy();
		config = c;
		pageUrl = window.location.href;
		entry = readState(window.history.state);
		if (!entry && c.history && window.history.state == null) {
			entry = createState(pageUrl, 0);
			window.history.replaceState(entry, "");
		}
		if (c.history && c.scrollRestoration && "scrollRestoration" in window.history) {
			savedScrollRestoration = window.history.scrollRestoration;
			window.history.scrollRestoration = "manual";
		}
		window.addEventListener("click", onClick);
		window.addEventListener("popstate", onPopState);
	}
	/**
	* Navigate to an URL (another origin is loaded without KnNav)
	* @param url
	* @param opt Options of the navigation (init options by default)
	* @returns Result of the navigation (never rejected)
	*/
	function navigate(url, opt = {}) {
		const nav = resolveNavigation(opt), target = resolveUrl(url);
		if (!target) throw new TypeError("KnNav: invalid URL " + String(url));
		if (target.origin !== window.location.origin) {
			loadPage(target.href, replacesEntry(nav));
			return new Promise(() => {});
		}
		return start(target.href, nav, "navigate", null, null);
	}
	/**
	* Cancel the navigation in progress (kn_nav:complete is dispatched with canceled = true)
	* @returns
	*/
	function abort() {
		cancel();
	}
	/**
	* Reload the page (full page load)
	* @returns
	*/
	function reload() {
		window.location.reload();
	}
	/**
	* Stop KnNav: cancel the navigation in progress and remove the listeners
	* @returns
	*/
	function destroy() {
		if (!config) return;
		cancel();
		window.removeEventListener("click", onClick);
		window.removeEventListener("popstate", onPopState);
		if (savedScrollRestoration) {
			window.history.scrollRestoration = savedScrollRestoration;
			savedScrollRestoration = null;
		}
		config = null;
		entry = null;
		pageUrl = "";
		scrolls.clear();
	}
	/**
	* Check if a value is a KnNav error
	* @param err
	* @returns
	*/
	function isKnNavError(err) {
		return err instanceof KnNavError;
	}
	//#endregion
	return {
		/** LIB VERSION */
		VERSION: "1.0.0",
		/** MINIMUM KNHTTP VERSION REQUIRED */
		KNHTTP_MIN_VERSION,
		/**
		* ERRORS CODES
		*/
		CANCELED_ERROR,
		NETWORK_ERROR,
		TIMEOUT_ERROR,
		HTTP_ERROR,
		PARSE_ERROR,
		UNKNOWN_ERROR,
		DOM_ERROR: "dom",
		/**
		* Options (null if KnNav is not initialized), can be updated
		*/
		get options() {
			return config;
		},
		/**
		* True if a navigation is in progress
		*/
		get loading() {
			return current !== null;
		},
		init,
		navigate,
		abort,
		reload,
		destroy,
		isKnNavError
	};
})(KnHttp);
