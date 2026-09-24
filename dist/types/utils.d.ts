import type { KnHttpHeaders } from 'kn-http';
import type { KnNavValue } from './types';
/**
 * Resolve a value or a function returning the value
 * @param value
 * @returns
 */
export declare function resolveValue<T>(value: KnNavValue<T>): T;
/**
 * Get a response header (case insensitive)
 * @param headers
 * @param name
 * @returns
 */
export declare function getHeader(headers: KnHttpHeaders, name: string): string | null;
/**
 * URL without the hash
 * @param url
 * @returns
 */
export declare function stripHash(url: string): string;
/**
 * Hash of an URL ('' if none)
 * @param url
 * @returns
 */
export declare function getHash(url: string): string;
/**
 * Add a query parameter (name=value) at the end of the query string, the existing parameters are kept as is
 * @param url
 * @param param
 * @returns
 */
export declare function addQueryParam(url: string, param: string): string;
/**
 * Remove a query parameter (name=value) from the query string, the other parameters are kept as is
 * @param url
 * @param param
 * @returns
 */
export declare function removeQueryParam(url: string, param: string): string;
