/**
 * Scroll position [x, y]
 */
export type KnNavScroll = readonly [number, number];
/**
 * State of the history entries created by KnNav
 */
export interface KnNavState {
    /** KnNav state marker (state format version) */
    readonly knNav: 1;
    /** Unique id of the entry */
    readonly id: string;
    /** Position of the entry in the history (back / forward detection) */
    readonly index: number;
    /** URL of the entry */
    readonly url: string;
    /** Scroll position when the page was left */
    readonly scroll: KnNavScroll;
}
/**
 * Create a history state
 * @param url
 * @param index
 * @returns
 */
export declare function createState(url: string, index: number): KnNavState;
/**
 * Read a history state (null if the state has not been created by KnNav)
 * @param state
 * @returns
 */
export declare function readState(state: unknown): KnNavState | null;
/**
 * Current scroll position
 * @returns
 */
export declare function currentScroll(): KnNavScroll;
