import { stripHash } from './utils';

/**
 * Element of the current page and its replacement
 */
export interface KnNavSwap {
	readonly current: Element;
	readonly next: Element;
}

/**
 * Result of the selectors matching
 */
export type KnNavMatch = { ok: true; swaps: KnNavSwap[] } | { ok: false; message: string };

/**
 * Parse an HTML page (the scripts are not executed)
 * @param html
 * @returns
 */
export function parseHtml(html: string): Document {
	return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Match the elements of the current page and of the new page (same number of elements for each selector)
 * @param doc New page
 * @param selectors
 * @returns
 */
export function matchSelectors(doc: Document, selectors: readonly string[]): KnNavMatch {
	const swaps: KnNavSwap[] = [];

	for (const selector of selectors) {
		const next = doc.querySelectorAll(selector),
			current = document.querySelectorAll(selector);

		if (next.length !== current.length) {
			return { ok: false, message: `DOM doesn't look the same on the new page: '${selector}' - new ${next.length}, old ${current.length}` };
		}

		for (let i = 0; i < next.length; i++) {
			const n = next[i], c = current[i];
			if (n && c) swaps.push({ current: c, next: n });
		}
	}

	if (!swaps.length) return { ok: false, message: `No element to replace: '${selectors.join(', ')}'` };

	return { ok: true, swaps };
}

/**
 * Replace the elements of the current page (the scripts of the new elements are not executed)
 * @param swaps
 * @returns New elements
 */
export function swapElements(swaps: readonly KnNavSwap[]): Element[] {
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
export function executeScripts(elements: readonly Element[]): void {
	for (const el of elements) {
		const scripts = el.localName == 'script' ? [el] : Array.from(el.querySelectorAll('script'));

		for (const script of scripts) {
			if (script instanceof HTMLScriptElement) runScript(script);
		}
	}
}

/**
 * Execute a script: the script (inert once parsed) is replaced by a copy
 * @param old
 * @returns
 */
function runScript(old: HTMLScriptElement): void {
	if (!old.isConnected) return;

	const code = old.text;

	// document.write would replace the page
	if (code.includes('document.write')) {
		console.warn('KnNav: script skipped (document.write)', old);
		return;
	}

	const script = document.createElement('script');

	for (const { name, value } of Array.from(old.attributes)) {
		try {
			script.setAttribute(name, value);
		} catch {
			// Name accepted by the HTML parser but not by setAttribute (@click...)
		}
	}

	// The nonce attribute is hidden once the script is in the page (CSP)
	if (old.nonce) script.nonce = old.nonce;

	// The external scripts are executed in the order of the page
	if (script.src && !script.hasAttribute('async')) script.async = false;

	script.text = code;
	old.replaceWith(script);
}

/**
 * Remove the focus of the focused element
 * @returns
 */
export function blurActiveElement(): void {
	const el = document.activeElement;
	if (el instanceof HTMLElement) el.blur();
}

/**
 * Focus the last element with the autofocus attribute of the new elements
 * @param elements
 * @returns
 */
export function focusAutofocus(elements: readonly Element[]): void {
	let target: HTMLElement | null = null;

	for (const el of elements) {
		const found = el.matches('[autofocus]') ? [el] : Array.from(el.querySelectorAll('[autofocus]'));
		for (const f of found) if (f instanceof HTMLElement) target = f;
	}

	if (target && document.activeElement !== target) target.focus({ preventScroll: true });
}

/**
 * Scroll to the element of an anchor (#id or name)
 * @param hash
 * @returns False if the element is not found
 */
export function scrollToHash(hash: string): boolean {
	if (hash.length < 2) return false;

	let id = hash.slice(1);

	try {
		id = decodeURIComponent(id);
	} catch {
		// Invalid encoding: raw id
	}

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
function isSelfLink(link: HTMLAnchorElement): boolean {
	if (!link.hasAttribute('href') || link.hasAttribute('download') || link.closest('[data-kn-nav="false"]')) return false;

	const target = link.target.trim().toLowerCase();
	return !target || target == '_self';
}

/**
 * Check if a link is an anchor of the current page (#section)
 * @param link
 * @returns
 */
export function isPageAnchor(link: HTMLAnchorElement): boolean {
	return isSelfLink(link) && link.href.includes('#') && stripHash(link.href) === stripHash(window.location.href);
}

/**
 * Check if a link can be loaded by KnNav
 * - href attribute, no download attribute, no other target than _self
 * - no data-kn-nav="false" attribute on the link or its parents
 * - same origin, not an anchor of the current page
 * @param link
 * @returns
 */
export function isNavigableLink(link: HTMLAnchorElement): boolean {
	if (!isSelfLink(link)) return false;

	let url: URL;

	try {
		url = new URL(link.href);
	} catch {
		return false;
	}

	// Other origin or protocol (mailto:, tel:, javascript:...)
	if (url.origin !== window.location.origin) return false;

	// Anchor of the current page: scrolled by the browser
	if (link.href.includes('#') && stripHash(url.href) === stripHash(window.location.href)) return false;

	return true;
}
