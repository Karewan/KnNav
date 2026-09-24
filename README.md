# KnNav

Ajax navigation library (pjax like) for **vanilla JS and legacy projects** that do not use a modern framework like Vue or React, based on [KnHttpJs](https://github.com/Karewan/KnHttpJs), written in TypeScript.

The server renders full HTML pages, KnNav loads them with Ajax and only replaces some elements of the page (title, content...): no full page reload, the layout, the scripts and their state are kept.

* Links and `KnNav.navigate()` loaded with Ajax, links added later handled automatically
* Browser history: URL, back / forward, scroll restoration, anchors, redirections
* Typed events (`kn_nav:send`, `kn_nav:success`, `kn_nav:error`, `kn_nav:complete`) with the HTTP status, the headers and a structured error
* Error codes: HTTP, network, timeout, DOM (the new page has another layout), cancel
* Error pages of the server (404, 500...) rendered when they contain the replaced elements
* All the KnHttpJs options: instances, hooks, retries, timeout, `AbortSignal`, auth token...
* Scripts of the new content executed (inline, external, modules)
* ES module and browser script (IIFE) builds, no side effect before `KnNav.init()`

## Table of contents

* [Requirements](#requirements)
* [Installation](#installation)
* [Quick start](#quick-start)
* [Usage](#usage)
* [API](#api)
* [Server side](#server-side)
* [TypeScript](#typescript)
* [Samples](#samples)
* [Upgrading from v0.5](#upgrading-from-v05)
* [Browser support](#browser-support)
* [Build](#build)
* [Changelog](#changelog)
* [License](#license)

## Requirements

* [KnHttpJs](https://github.com/Karewan/KnHttpJs) **>= 4.0.0** (peer dependency)

## Installation

### With a package manager (ES module)

```shell
pnpm add kn-http @karewan/kn-nav
```

```shell
npm install kn-http @karewan/kn-nav
```

KnNav is published on npm as `@karewan/kn-nav`. The TypeScript declarations are included in the packages, nothing else to install.

### Browser script (IIFE)

Load KnHttpJs **first**, then KnNav, from the `dist` folders, from `node_modules/kn-http/dist/` and `node_modules/@karewan/kn-nav/dist/` or from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/kn-http@4/dist/kn-http.iife.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@karewan/kn-nav@1/dist/kn-nav.iife.min.js"></script>
```

The script defines the global `KnNav` object.

### Dist files

| File | Format | Usage |
| --- | --- | --- |
| `dist/kn-nav.js` | ES module | `import KnNav from '@karewan/kn-nav'` (Vite, webpack, Rollup...), imports `kn-http` |
| `dist/kn-nav.iife.js` | Browser script | `<script>`, uses the global `KnHttp`, defines the global `KnNav` |
| `dist/kn-nav.iife.min.js` | Browser script (minified) | `<script>`, uses the global `KnHttp`, defines the global `KnNav` |
| `dist/types/` | TypeScript declarations | Used automatically by TypeScript and the editors |

## Quick start

All the pages of the site have the same layout, the server always returns full pages:

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<title>Customers</title>
</head>
<body>
	<div id="loader"></div>
	<nav id="side_nav">
		<a href="/customers">Customers</a>
		<a href="/invoices">Invoices</a>
	</nav>
	<!-- Replaced at each navigation -->
	<main id="app">...</main>

	<script src="kn-http.iife.min.js"></script>
	<script src="kn-nav.iife.min.js"></script>
	<script src="app.js"></script>
</body>
</html>
```

### JavaScript (browser script, IIFE)

```javascript
// app.js
KnNav.init({
	elements: ['#side_nav a', '#app a'],   // Links loaded by KnNav
	selectors: ['head title', '#app'],     // Elements replaced by each navigation
	renderErrorPages: true                 // Render the 404 / 500 pages of the site
});

const loader = document.getElementById('loader');

document.addEventListener('kn_nav:send', () => loader.hidden = false);
document.addEventListener('kn_nav:complete', () => loader.hidden = true);

document.addEventListener('kn_nav:success', e => {
	checkAppVersion(e.detail.headers['appv']);
	initWidgets(document.getElementById('app'));
});

document.addEventListener('kn_nav:error', e => {
	const err = e.detail.error;

	if (err.code == KnNav.DOM_ERROR) window.location.href = e.detail.url; // Other layout: full page load
	else if (err.code == KnNav.NETWORK_ERROR) toast('Please check your internet connection');
	else toast(err.message); // "HTTP error 500", "Request timeout"...
});
```

### TypeScript (npm)

```typescript
import KnHttp from 'kn-http';
import KnNav from '@karewan/kn-nav';

KnNav.init({
	selectors: ['head title', '#app'],
	renderErrorPages: true,
	// KnHttp instance of the requests: timeout, retries, hooks...
	client: KnHttp.create({ timeout: 30_000, retry: 1 })
});

// The events are typed: e.detail is a KnNavSuccessDetail
document.addEventListener('kn_nav:success', e => {
	console.log(e.detail.status, e.detail.headers['appv']);
});

// The result is never rejected
async function openInvoice(id: number): Promise<void> {
	const result = await KnNav.navigate(`/invoices/${id}`);

	if (result.success) focusInvoice();
	else if (!result.canceled) console.error(result.error.code, result.error.status);
}
```

See the samples [here](#samples).

## Usage

### How it works

1. A click on a link matching `elements` (or `KnNav.navigate(url)`) starts the navigation: `kn_nav:send`
2. The page is loaded with KnHttp (GET request with the `X-Requested-With: KnNav` header)
3. The new page must contain the same number of elements for each selector of `selectors`, otherwise the navigation fails with a `DOM_ERROR` and the page is not modified
4. The history is updated (URL of the page after the redirections), the elements are replaced: `kn_nav:success`
5. The scripts of the new elements are executed, the page is scrolled (anchor, top of the page or restored position)
6. `kn_nav:complete`, always dispatched last

A new navigation cancels the navigation in progress.

### Events

The events are `CustomEvent` objects dispatched on `document` (they bubble to `window`), the data is in `e.detail`:

| Event | When | `e.detail` |
| --- | --- | --- |
| `kn_nav:send` | Navigation start | `url`, `action`, `link`, `request` |
| `kn_nav:success` | Page rendered, before the execution of its scripts | + `status`, `headers`, `success: true` |
| `kn_nav:error` | Navigation failed (not dispatched on cancel) | + `status`, `headers`, `error` |
| `kn_nav:complete` | End of the navigation, always last (success, error or cancel) | [Result](#result) |

* Each `kn_nav:send` is followed by exactly one `kn_nav:complete`: a loader can be shown on `send` and hidden on `complete`
* A navigation canceled by a new navigation, `KnNav.abort()` or an abort signal only dispatches `kn_nav:complete` (with `e.detail.canceled`)
* A `Kn-Redirect` response header loads its URL without KnNav, no other event is dispatched

### Errors

`e.detail.error` (event `kn_nav:error`) is a `KnNavError`, it extends the native `Error`:

| Property | Type | Description |
| --- | --- | --- |
| `err.code` | `string` | Error code, see below |
| `err.status` | `number` | HTTP status (0 if there is no response) |
| `err.data` | `unknown` | Response body (HTML page as text), `null` if there is no response |
| `err.headers` | `object` | Response headers (lower case names) |
| `err.url` | `string` | Requested URL |
| `err.message` | `string` | "HTTP error 404", "Network error", "Request timeout", "DOM doesn't look the same on the new page: '#app' - new 0, old 1"... |
| `err.cause` | `unknown` | Original error (KnHttp error, exception...) |

| Constant | Value | Description |
| --- | --- | --- |
| `KnNav.HTTP_ERROR` | `'http'` | Invalid HTTP status (not 2xx), the error page has not been rendered |
| `KnNav.NETWORK_ERROR` | `'network'` | Network error (server unreachable, no internet...) |
| `KnNav.TIMEOUT_ERROR` | `'timeout'` | Timeout |
| `KnNav.DOM_ERROR` | `'dom'` | The new page does not contain the same elements as the current page (another layout, not an HTML page...) |
| `KnNav.UNKNOWN_ERROR` | `'unknown'` | Other error (exception thrown in a KnHttp hook...) |
| `KnNav.CANCELED_ERROR`, `KnNav.PARSE_ERROR` | `'canceled'`, `'parse'` | KnHttp codes, not dispatched by `kn_nav:error` (a cancel is a result with `canceled`) |

The values are the same as the KnHttp error codes (`KnNav.HTTP_ERROR == KnHttp.HTTP_ERROR`).

A page with another layout (login page, print page...) can be loaded without KnNav:

```javascript
document.addEventListener('kn_nav:error', e => {
	// window.location.replace(e.detail.url) with onePageHistory (no new history entry)
	if (e.detail.error.code == KnNav.DOM_ERROR) window.location.href = e.detail.url;
});
```

### Error pages

By default, an HTTP error (404, 500...) dispatches `kn_nav:error` and the page is not modified. With `renderErrorPages: true`, an error response containing the selectors (error page with the layout of the site) is rendered like a success: the URL and the history are updated and `kn_nav:success` is dispatched with the HTTP status of the error (`e.detail.status`). The error responses without the selectors (plain text, JSON, other layout...) still dispatch `kn_nav:error` with an `HTTP_ERROR`.

```javascript
KnNav.init({ renderErrorPages: true });

document.addEventListener('kn_nav:success', e => {
	if (e.detail.status == 404) analytics.track('page_not_found', location.pathname);
});
```

### Links

With event delegation, the links added to the page after the init (Ajax content, templates...) are handled without any call. A link is loaded by KnNav if it matches `elements` and:

* it has an `href` attribute, no `download` attribute and no `target` attribute other than `_self`
* it has no `data-kn-nav="false"` attribute, on itself or on a parent element
* it is on the same origin as the page, and it is not an anchor of the current page (`#section`, scrolled by the browser)
* the click is a left click without modifier key (Ctrl, Cmd, Shift, Alt: new tab or window)
* the click has not been prevented by another listener (`e.preventDefault()`)

```html
<!-- Loaded without KnNav -->
<a href="/export.csv" download>Export</a>
<a href="/print/invoice/42" target="_blank">Print</a>
<a href="/logout" data-kn-nav="false">Logout</a>
<div data-kn-nav="false">
	<a href="/legacy-page">Legacy page</a>
</div>
```

### Scripts

After `kn_nav:success`, the scripts of the new elements are executed in the order of the page, as with a full page load:

* Inline scripts, external scripts (`src`, the order is kept), modules (`type="module"`), with their attributes (`nonce`, `data-*`...)
* `document.currentScript` works, the scripts stay in the page
* The data blocks (`type="application/json"`, `type="text/template"`...) are not executed
* The scripts containing `document.write` are skipped (it would replace the page)
* A module with a `src` is only executed once per page load (browser behavior)

The scripts outside of the replaced elements (layout) are not executed again.

### History and scroll

Three history modes, set with the init options:

| Mode | Options | URL of the page | History |
| --- | --- | --- | --- |
| Full history (default) | `history: true` | Updated | One entry per navigation (`history.pushState`), back / forward load the previous pages with KnNav |
| One page | `history: true` + `onePageHistory: true` | Updated | Always one entry, the last page: each navigation replaces the current entry (`history.replaceState`), no previous / next page (e.g. installed PWA) |
| Disabled | `history: false` (`onePageHistory` ignored) | Not modified | Never modified by KnNav (no `pushState`, no `replaceState`) |

In the one page mode, the anchors of the page (`<a href="#section">`, all the links, not only `elements`) and the `Kn-Redirect` header also replace the current entry (`location.replace()`: scroll, `:target` and `hashchange` kept). The full page loads done by the application still add an entry: use `window.location.replace(url)` instead of `window.location.href = url`.

```javascript
KnNav.init({
	history: true,            // false: the URL and the history are never modified
	onePageHistory: false,    // true: history.replaceState only
	scrollRestoration: true,  // Restore the scroll position on back / forward (history enabled)
	scrollToTop: true         // Scroll to the top of the page after a new navigation
});

// The mode can be set for one navigation
KnNav.navigate('/customers?page=2', { replace: true });   // Replace the current entry (history enabled)
KnNav.navigate('/customers/42/card', { history: false }); // URL and history not modified
```

* The URL of the page is the URL after the redirections (302...), with the anchor of the requested URL
* A new navigation scrolls to the element of the anchor (`/page#section`, CSS `scroll-margin-top` supported), otherwise to the top of the page (`scrollToTop`)
* A navigation to the current URL replaces the history entry (as the browser does)
* The back / forward between the anchors of the same page do not reload the page
* The history entries added by other scripts with `history.pushState(state)` are not handled by KnNav

### Requests (KnHttp)

The requests are sent with KnHttp: the defaults, the hooks and the retries of the KnHttp instance apply. The `client` option sets the KnHttp instance, the `request` option gives the KnHttp request options (static or evaluated at each navigation):

```javascript
const pagesClient = KnHttp.create({
	timeout: 30_000,
	retry: { limit: 2, statusCodes: [502, 503, 504] },
	hooks: {
		beforeError: async err => {
			if (err.status == 401) window.location.href = '/login';
		}
	}
});

KnNav.init({
	client: pagesClient,
	request: () => ({ headers: { 'X-Tab-Id': tabId } })
});

// Options of one navigation
const controller = new AbortController();
KnNav.navigate('/reports/yearly', { request: { timeout: 0, signal: controller.signal } });
```

* Default timeout: the KnHttp default (270 s), `0` = no timeout
* The errors are dispatched with `kn_nav:error`: the `onUnhandledError` callback of the KnHttp instance is not called
* The `params` and `upload` KnHttp options are not available (the URL is the URL of the page)
* The `X-Requested-With: KnNav` and `Accept` headers can be overridden in `request.headers`

## API

### KnNav object

The global `KnNav` object (browser script) or the default export (ES module):

```javascript
KnNav.init(options);                // Init KnNav (a second call replaces the options)
KnNav.navigate(url, options);       // Navigate to an URL, returns a Promise<result> (never rejected)
KnNav.abort();                      // Cancel the navigation in progress
KnNav.reload();                     // Full page reload (window.location.reload())
KnNav.destroy();                    // Cancel the navigation in progress and remove the listeners
KnNav.isKnNavError(err);            // True if err is a KnNavError

KnNav.options;                      // Options with the default values (null before init), can be updated
KnNav.loading;                      // True if a navigation is in progress
KnNav.VERSION;                      // Lib version
KnNav.KNHTTP_MIN_VERSION;           // Minimum KnHttpJs version required
KnNav.HTTP_ERROR;                   // Error codes, see Errors
```

* `KnNav.init()` throws an `Error` if KnHttpJs is missing or too old, a `TypeError` if `elements` matches an element other than `<a>`, a `SyntaxError` if a selector is invalid (the previous init is kept)
* `KnNav.navigate()` throws an `Error` if KnNav is not initialized, a `TypeError` if the URL is not an `http` or `https` URL. An URL of another origin is loaded without KnNav
* The methods can be called without the object (`const { navigate } = KnNav`)

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `elements` | `string[]` | `['a']` | Links loaded by KnNav (CSS selectors of `<a>` elements) |
| `selectors` | `string[]` | `['head title', '#app']` | Elements replaced by each navigation, the new page must contain the same number of elements for each selector |
| `history` | `boolean` | `true` | Update the URL and the history (`false`: never modified), see [History and scroll](#history-and-scroll) |
| `onePageHistory` | `boolean` | `false` | With `history: true`, the history only has one entry, the last page (`history.replaceState` only), see [History and scroll](#history-and-scroll) |
| `scrollRestoration` | `boolean` | `true` | Restore the scroll position on back / forward (history enabled) |
| `scrollToTop` | `boolean` | `true` | Scroll to the top of the page after a new navigation (the anchor of the URL has priority) |
| `cacheBust` | `boolean` | `true` | Add a `_kn=<time in ms>` query parameter to the request URL (not to the URL of the page) to bypass the browser cache |
| `renderErrorPages` | `boolean` | `false` | Render the HTTP error responses containing the selectors, see [Error pages](#error-pages) |
| `client` | KnHttp instance or `null` | `null` | KnHttp instance used for the requests (`null` = `KnHttp`) |
| `request` | `object` or `() => object` | `{}` | KnHttp request options: `timeout`, `headers`, `retry`, `signal`, `authToken`, `withCredentials`... |

### Navigate options

`KnNav.navigate(url, options)` accepts `selectors`, `history`, `scrollToTop`, `cacheBust`, `renderErrorPages`, `client`, `request` (the init options by default) and:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `replace` | `boolean` | `onePageHistory` | Replace the current history entry instead of adding a new one |

### Result

`e.detail` of the events and result of `KnNav.navigate()`:

| Property | Type | Description |
| --- | --- | --- |
| `url` | `string` | Requested URL (absolute) |
| `action` | `string` | `'link'` (click), `'navigate'` (`KnNav.navigate()`), `'back'` or `'forward'` (history) |
| `link` | `HTMLAnchorElement` or `null` | Clicked link |
| `request` | `KnHttpRequest` | KnHttp request (`request.xhr` is the `XMLHttpRequest`) |
| `success` | `boolean` | True if the page has been rendered |
| `canceled` | `boolean` | True if the navigation has been canceled |
| `status` | `number` | HTTP status (0 if there is no response) |
| `headers` | `object` | Response headers (lower case names) |
| `error` | `KnNavError` or `null` | Error (`null` on success and on cancel) |

`kn_nav:send` only has `url`, `action`, `link` and `request`.

## Server side

KnNav requests are GET requests with these headers:

| Header | Value |
| --- | --- |
| `X-Requested-With` | `KnNav` |
| `Accept` | `text/html, application/xhtml+xml, */*;q=0.8` |

The URL has a `_kn=<time in ms>` query parameter when `cacheBust` is enabled (default).

The response must be an HTML page containing the selectors (the full page, or only the layout elements for the KnNav requests), with a 2xx status. See [Error pages](#error-pages) for the error status.

The `Kn-Redirect` response header loads its URL without KnNav (with any status), e.g. to leave the Ajax navigation when the session has expired:

```php
<?php
if (!isLoggedIn()) {
	if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'KnNav') header('Kn-Redirect: /login');
	else header('Location: /login');
	exit;
}
```

If the server returns partial pages for the KnNav requests, add a `Vary: X-Requested-With` header so the browser cache does not mix the full and the partial pages.

## TypeScript

### Typed events

Importing `@karewan/kn-nav` types the events of `document.addEventListener` and `window.addEventListener`:

```typescript
document.addEventListener('kn_nav:error', e => {
	const { error } = e.detail;   // KnNavError
	if (error.code == KnNav.HTTP_ERROR) console.log(error.status, error.data);
});
```

### Typed results

The result is a discriminated union:

```typescript
const result = await KnNav.navigate('/customers');

if (result.success) console.log(result.status);        // KnNavSuccessDetail
else if (result.canceled) console.log('Canceled');     // KnNavCanceledDetail
else console.log(result.error.code);                   // KnNavErrorDetail: error is a KnNavError
```

The options are checked at compile time:

```typescript
KnNav.init({ timeout: 30_000 });                          // Error: unknown option (v0.5), use request: { timeout }
KnNav.init({ selectors: '#app' });                        // Error: selectors is a string[]
KnNav.navigate('/page', { onePageHistory: true });        // Error: unknown option, use replace
KnNav.navigate('/page', { request: { params: {} } });     // Error: params is not available
```

### Exported types

```typescript
import type { KnNavOptions, KnNavResult, KnNavError } from '@karewan/kn-nav';
```

| Type | Description |
| --- | --- |
| `KnNavOptions` | Options of `KnNav.init()` |
| `KnNavResolvedOptions` | Options with the default values (`KnNav.options`) |
| `KnNavNavigationOptions` | Options of a navigation (common to `init` and `navigate`) |
| `KnNavNavigateOptions` | Options of `KnNav.navigate()` |
| `KnNavRequestOptions` | Type of the `request` option |
| `KnNavValue<T>` | Value or function returning the value |
| `KnNavAction` | `'link' \| 'navigate' \| 'back' \| 'forward'` |
| `KnNavDetail` | Detail of `kn_nav:send` |
| `KnNavSuccessDetail`, `KnNavErrorDetail`, `KnNavCanceledDetail` | Details of `kn_nav:success`, `kn_nav:error` and of a canceled navigation |
| `KnNavResult` | Detail of `kn_nav:complete` and result of `KnNav.navigate()` |
| `KnNavEventMap` | Events and their type |
| `KnNavError`, `KnNavErrorCode`, `KnNavErrorInit` | Error, error codes and error details |
| `KnHttpClient`, `KnHttpRequest<T>`, `KnHttpResponse<T>`, `KnHttpError`, `KnHttpHeaders`, `KnHttpBaseOptions` | Re-exported from `kn-http` |

## Samples

The samples are a mock server-rendered site (Vite dev server) with all the cases: navigation, slow page, scripts, anchors and scroll restoration, redirections, `Kn-Redirect`, 404 page with the layout, 500 error, network error, timeout, other layout, ignored links, API buttons. The loader, the event log and the toasts are outside of the replaced elements.

| Sample | Description |
| --- | --- |
| [samples/app.js](samples/app.js) | Browser script (IIFE, dist): http://localhost:5173/iife/ |
| [samples/app.ts](samples/app.ts) | ES module + TypeScript (sources), KnHttp instance with hooks and retry: http://localhost:5173/esm/ |
| [samples/vite.config.ts](samples/vite.config.ts) | Mock server: pages, layout, error cases |

```shell
pnpm install
pnpm build
pnpm samples
```

## Upgrading from v0.5

| v0.5 | v1 |
| --- | --- |
| `dist/kn_nav.js`, `dist/kn_nav.min.js` | `dist/kn-nav.iife.js`, `dist/kn-nav.iife.min.js`, load `kn-http.iife.min.js` (KnHttpJs >= 4.0.0) first |
| `timeout` option (0 = 270 s) | `request: { timeout }` (KnHttp default: 270 s, 0 = no timeout) |
| `KnNav.refresh()` | Removed: the links added to the page are handled automatically (remove the calls) |
| `KnNav.navigate(url, { onePageHistory: true })` | `KnNav.navigate(url, { replace: true })` |
| `e.request` (XMLHttpRequest) | `e.detail.request.xhr` |
| `e.request.getResponseHeader('appv')` | `e.detail.headers['appv']` (lower case names) |
| `e.request.status` | `e.detail.status` |
| `e.trigger_element` | `e.detail.link` |
| `e.backward`, `e.forward` | `e.detail.action == 'back'`, `e.detail.action == 'forward'` |
| `e.url` | `e.detail.url` |
| `e.history`, `e.selectors`... (options copied on the event) | `KnNav.options` |
| `kn_nav:complete` dispatched before `kn_nav:success` / `kn_nav:error` and before the scripts of the page | `kn_nav:complete` dispatched last (after the scripts of the page) |
| Nothing dispatched for a navigation canceled by a new one | `kn_nav:complete` with `e.detail.canceled` |
| `kn_nav:error` without details | `e.detail.error`: `code` (`KnNav.HTTP_ERROR`, `NETWORK_ERROR`, `TIMEOUT_ERROR`, `DOM_ERROR`...), `status`, `data`, `headers`, `message` |
| Success: HTTP status 200 only | All the 2xx HTTP status, error pages with `renderErrorPages` |
| Scroll position kept after a new navigation | Top of the page (`scrollToTop: false` for the v0.5 behavior) |
| Cache bust parameter `t=<time>` (visible in the URL) | `_kn=<time>`, request URL only |
| `data-kn-nav-state` attribute on the links | Removed |
| String errors thrown | `Error` objects |

Example of migration of the event listeners:

```javascript
// v0.5
document.addEventListener('kn_nav:success', e => {
	checkAppVersion(e.request.getResponseHeader('appv'));
});

document.addEventListener('kn_nav:error', e => {
	toast('HTTP ERROR ' + e.request.status);
});

// v1
document.addEventListener('kn_nav:success', e => {
	checkAppVersion(e.detail.headers['appv']);
});

document.addEventListener('kn_nav:error', e => {
	toast(e.detail.error.message); // "HTTP error 404", "Network error", "Request timeout"...
});
```

Other changes:

* The requests are sent with KnHttp: its defaults (headers, auth token...) and hooks apply, the `Accept: text/html...` header is sent
* The links with a `target` (other than `_self`) or `download` attribute, and the clicks prevented by another listener, are no longer loaded by KnNav
* All the scripts of the new elements are executed in place, modules included (they were moved to `<head>`, only `text/javascript`)
* The scripts of the new elements are still executed after `kn_nav:success`, the scripts outside of the replaced elements are still not executed
* `KnNav.init()` without options works (it threw), a second call no longer duplicates the listeners
* The minimum browser versions are higher, see [Browser support](#browser-support)

See the [changelog](CHANGELOG.md) for all the changes.

## Browser support

* Chrome / Edge 85+
* Firefox 79+
* Safari 14.1+

## Build

The sources are in [src](src) (TypeScript 6, strict mode), bundled with Vite 8 (library mode), the declarations are generated with `tsc`.

```shell
# Install the dev dependencies
pnpm install

# Type check the sources, the Vite configs and the TypeScript sample
pnpm typecheck

# Type check, build the bundles and the declarations into dist
pnpm build

# Rebuild the bundles on each change
pnpm dev

# Samples dev server (mock site)
pnpm samples
```

## Changelog

See the changelog [here](CHANGELOG.md)

## License

See the license [here](LICENSE.txt)

```
The MIT License (MIT)

Copyright (c) 2022-2026 Florent VIALATTE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
