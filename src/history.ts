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

let idCounter = 0;

/**
 * Create a history state
 * @param url
 * @param index
 * @returns
 */
export function createState(url: string, index: number): KnNavState {
	return {
		knNav: 1,
		id: Date.now().toString(36) + '-' + (idCounter++).toString(36) + '-' + Math.random().toString(36).slice(2, 8),
		index: index,
		url: url,
		scroll: [0, 0]
	};
}

/**
 * Check if a value is a scroll position
 * @param value
 * @returns
 */
function isScroll(value: unknown): value is KnNavScroll {
	return Array.isArray(value) && value.length == 2 && typeof value[0] == 'number' && typeof value[1] == 'number';
}

/**
 * Read a history state (null if the state has not been created by KnNav)
 * @param state
 * @returns
 */
export function readState(state: unknown): KnNavState | null {
	if (typeof state !== 'object' || state === null) return null;

	const s = state as Record<string, unknown>;

	if (s['knNav'] === 1 && typeof s['id'] == 'string' && typeof s['index'] == 'number' && typeof s['url'] == 'string') {
		return {
			knNav: 1,
			id: s['id'],
			index: s['index'],
			url: s['url'],
			scroll: isScroll(s['scroll']) ? s['scroll'] : [0, 0]
		};
	}

	// State of KnNav 0.x ({ url, title, uid, scrollPos }): the entries created before an update stay usable
	if (typeof s['url'] == 'string' && typeof s['uid'] == 'string') {
		return {
			knNav: 1,
			id: s['uid'],
			index: -1,
			url: s['url'],
			scroll: isScroll(s['scrollPos']) ? s['scrollPos'] : [0, 0]
		};
	}

	return null;
}

/**
 * Current scroll position
 * @returns
 */
export function currentScroll(): KnNavScroll {
	return [window.scrollX, window.scrollY];
}
