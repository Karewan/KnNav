import type { KnHttpHeaders } from 'kn-http';
import type { KnNavValue } from './types';

/**
 * Resolve a value or a function returning the value
 * @param value
 * @returns
 */
export function resolveValue<T>(value: KnNavValue<T>): T {
	return typeof value === 'function' ? (value as () => T)() : value;
}

/**
 * Get a response header (case insensitive)
 * @param headers
 * @param name
 * @returns
 */
export function getHeader(headers: KnHttpHeaders, name: string): string | null {
	name = name.toLowerCase();

	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() == name) return v;
	}

	return null;
}

/**
 * URL without the hash
 * @param url
 * @returns
 */
export function stripHash(url: string): string {
	const i = url.indexOf('#');
	return i >= 0 ? url.slice(0, i) : url;
}

/**
 * Hash of an URL ('' if none)
 * @param url
 * @returns
 */
export function getHash(url: string): string {
	const i = url.indexOf('#');
	return i >= 0 ? url.slice(i) : '';
}

/**
 * Add a query parameter (name=value) at the end of the query string, the existing parameters are kept as is
 * @param url
 * @param param
 * @returns
 */
export function addQueryParam(url: string, param: string): string {
	const base = stripHash(url),
		sep = !base.includes('?') ? '?' : (base.endsWith('?') || base.endsWith('&') ? '' : '&');

	return base + sep + param + getHash(url);
}

/**
 * Remove a query parameter (name=value) from the query string, the other parameters are kept as is
 * @param url
 * @param param
 * @returns
 */
export function removeQueryParam(url: string, param: string): string {
	const base = stripHash(url),
		i = base.indexOf('?');

	if (i < 0) return url;

	const query = base.slice(i + 1).split('&').filter(p => p !== param).join('&');

	return base.slice(0, i) + (query ? '?' + query : '') + getHash(url);
}
