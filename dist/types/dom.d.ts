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
export type KnNavMatch = {
    ok: true;
    swaps: KnNavSwap[];
} | {
    ok: false;
    message: string;
};
/**
 * Parse an HTML page (the scripts are not executed)
 * @param html
 * @returns
 */
export declare function parseHtml(html: string): Document;
/**
 * Match the elements of the current page and of the new page (same number of elements for each selector)
 * @param doc New page
 * @param selectors
 * @returns
 */
export declare function matchSelectors(doc: Document, selectors: readonly string[]): KnNavMatch;
/**
 * Replace the elements of the current page (the scripts of the new elements are not executed)
 * @param swaps
 * @returns New elements
 */
export declare function swapElements(swaps: readonly KnNavSwap[]): Element[];
/**
 * Execute the scripts of the new elements, in the order of the page
 * @param elements
 * @returns
 */
export declare function executeScripts(elements: readonly Element[]): void;
/**
 * Remove the focus of the focused element
 * @returns
 */
export declare function blurActiveElement(): void;
/**
 * Focus the last element with the autofocus attribute of the new elements
 * @param elements
 * @returns
 */
export declare function focusAutofocus(elements: readonly Element[]): void;
/**
 * Scroll to the element of an anchor (#id or name)
 * @param hash
 * @returns False if the element is not found
 */
export declare function scrollToHash(hash: string): boolean;
/**
 * Check if a link is an anchor of the current page (#section)
 * @param link
 * @returns
 */
export declare function isPageAnchor(link: HTMLAnchorElement): boolean;
/**
 * Check if a link can be loaded by KnNav
 * - href attribute, no download attribute, no other target than _self
 * - no data-kn-nav="false" attribute on the link or its parents
 * - same origin, not an anchor of the current page
 * @param link
 * @returns
 */
export declare function isNavigableLink(link: HTMLAnchorElement): boolean;
