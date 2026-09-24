import { KnNavError } from './error';
import type { KnNavNavigateOptions, KnNavOptions, KnNavResolvedOptions, KnNavResult } from './types';
export type * from './types';
export type { KnNavError, KnNavErrorCode, KnNavErrorInit } from './error';
/**
 * Init KnNav (a second call replaces the options)
 * @param opt
 * @returns
 */
declare function init(opt?: KnNavOptions): void;
/**
 * Navigate to an URL (another origin is loaded without KnNav)
 * @param url
 * @param opt Options of the navigation (init options by default)
 * @returns Result of the navigation (never rejected)
 */
declare function navigate(url: string | URL, opt?: KnNavNavigateOptions): Promise<KnNavResult>;
/**
 * Cancel the navigation in progress (kn_nav:complete is dispatched with canceled = true)
 * @returns
 */
declare function abort(): void;
/**
 * Reload the page (full page load)
 * @returns
 */
declare function reload(): void;
/**
 * Stop KnNav: cancel the navigation in progress and remove the listeners
 * @returns
 */
declare function destroy(): void;
/**
 * Check if a value is a KnNav error
 * @param err
 * @returns
 */
declare function isKnNavError(err: unknown): err is KnNavError;
/**
 * KnNav
 */
declare const KnNav: {
    /** LIB VERSION */
    readonly VERSION: string;
    /** MINIMUM KNHTTP VERSION REQUIRED */
    readonly KNHTTP_MIN_VERSION: string;
    /**
     * ERRORS CODES
     */
    readonly CANCELED_ERROR: "canceled";
    readonly NETWORK_ERROR: "network";
    readonly TIMEOUT_ERROR: "timeout";
    readonly HTTP_ERROR: "http";
    readonly PARSE_ERROR: "parse";
    readonly UNKNOWN_ERROR: "unknown";
    readonly DOM_ERROR: "dom";
    /**
     * Options (null if KnNav is not initialized), can be updated
     */
    readonly options: KnNavResolvedOptions | null;
    /**
     * True if a navigation is in progress
     */
    readonly loading: boolean;
    readonly init: typeof init;
    readonly navigate: typeof navigate;
    readonly abort: typeof abort;
    readonly reload: typeof reload;
    readonly destroy: typeof destroy;
    readonly isKnNavError: typeof isKnNavError;
};
export default KnNav;
