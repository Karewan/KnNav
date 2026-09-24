KnNav Changelog
==========

v1.0.0 (2026-09-24):
----------------------------
### Breaking changes
* KnHttpJs **>= 4.0.0** is now required (an error is thrown at init if KnHttp is missing or too old): the requests are sent with KnHttp instead of a custom XMLHttpRequest
* **dist/kn_nav.js** and **dist/kn_nav.min.js** replaced by **dist/kn-nav.iife.js** and **dist/kn-nav.iife.min.js** (load **kn-http.iife.min.js** first)
* Events are **CustomEvent** objects: the data is in **e.detail** instead of properties copied on the event
	* **e.request** (XMLHttpRequest) replaced by **e.detail.request** (KnHttp request, **e.detail.request.xhr** for the XMLHttpRequest)
	* **e.detail.status** and **e.detail.headers** (response headers, lower case names) added, e.g. **e.detail.headers['appv']** instead of **e.request.getResponseHeader('appv')**
	* **e.trigger_element** replaced by **e.detail.link**, **e.backward** / **e.forward** replaced by **e.detail.action** (**'link'**, **'navigate'**, **'back'** or **'forward'**)
	* The options are no longer copied on the events (**KnNav.options**)
* **kn_nav:complete** is now dispatched last (after **kn_nav:success** or **kn_nav:error**), it was dispatched first
* **kn_nav:error** gives a structured error in **e.detail.error** (**KnNavError**: code, status, data, headers, message, cause)
* All the 2xx HTTP status are a success (only 200 before)
* **timeout** option replaced by the **request** option given to KnHttp: **request: { timeout }**, 0 now means no timeout (it was 270 s), the default is the KnHttp default timeout (270 s)
* A timeout is now a **TIMEOUT_ERROR**, it was handled as a network error
* **KnNav.refresh()** removed: the links are handled by event delegation, the links added to the page are handled automatically
* **navigate(url, { onePageHistory: true })** replaced by **navigate(url, { replace: true })**, the options of **navigate** are the navigation options only (not **elements**, **onePageHistory**, **scrollRestoration**)
* A new navigation scrolls to the top of the page (**scrollToTop** option, the anchor of the URL has priority), the scroll position was kept
* The cache bust query parameter is **_kn=<time>** instead of **t=<time>**
* Requests headers: **Accept: text/html, application/xhtml+xml, \*/\*;q=0.8** added (the servers return their HTML error pages), **X-Requested-With: KnNav** unchanged
* The links with a **target** attribute (other than **_self**) or a **download** attribute, and the clicks prevented by another listener, are no longer loaded by KnNav
* The **data-kn-nav-state** attribute is no longer added to the links
* All the scripts of the new elements are executed in place (inline, external, **type="module"**), they were only executed if their type was **text/javascript** and were removed from the page
* Errors thrown at init are now **Error** objects (**TypeError** for a non **<a>** element, **SyntaxError** for an invalid selector) instead of strings, the DOM errors are no longer thrown during a navigation (**kn_nav:error** with **KnNav.DOM_ERROR**)
* The **Kn-Redirect** header only accepts **http** and **https** URLs
* Requires Chrome / Edge 85+, Firefox 79+ or Safari 14.1+

### New features
* **renderErrorPages** option: the HTTP error responses (404, 500...) containing the selectors are rendered as a success (**kn_nav:success** with **e.detail.status**), the URL and the history are updated
* Error codes: **KnNav.CANCELED_ERROR**, **NETWORK_ERROR**, **TIMEOUT_ERROR**, **HTTP_ERROR**, **PARSE_ERROR**, **UNKNOWN_ERROR** (same values as KnHttp) and **DOM_ERROR** (the new page does not contain the selectors), **KnNav.isKnNavError(err)**
* All the KnHttpJs features for the requests: **client** option (KnHttp instance: defaults, hooks, retry...) and **request** option (timeout, headers, retry, signal, auth token... object or function)
* **KnNav.navigate()** returns a Promise resolved with the result of the navigation (never rejected), accepts an **URL** object, loads the URLs of another origin without KnNav
* **KnNav.abort()**: cancel the navigation in progress
* **KnNav.destroy()**: cancel the navigation in progress and remove the listeners
* **KnNav.loading** and **KnNav.options** properties, **KnNav.KNHTTP_MIN_VERSION**
* Each **kn_nav:send** is followed by exactly one **kn_nav:complete**: a navigation canceled by another one (or by **KnNav.abort()**, an abort signal) dispatches **kn_nav:complete** with **e.detail.canceled**
* **data-kn-nav="false"** attribute: the link (or the links of the element) is loaded without KnNav
* The external scripts keep their order, **document.currentScript**, the **nonce** and the other attributes of the scripts work
* The anchor of a new page is scrolled with **scrollIntoView()** (CSS **scroll-margin-top** supported)
* A navigation to the current URL replaces the history entry (as the browser does)
* The history entries of KnNav 0.x (full page reload after an update) are still handled
* Written in TypeScript with strong typing
	* Typed events: **document.addEventListener('kn_nav:success', e => e.detail.status)**
	* Results typed as a discriminated union (**success**, **canceled**, **error**)
	* Exported types: **KnNavOptions**, **KnNavNavigateOptions**, **KnNavResult**, **KnNavError**, **KnNavEventMap**... and the KnHttpJs types used by the options
* ES module build (**dist/kn-nav.js**) importing **kn-http**, without side effect, with the TypeScript declarations (**dist/types/**)
* Samples: mock server-rendered site with all the cases (errors, redirections, scripts, scroll...), browser script (**/iife/**) and ES module + TypeScript (**/esm/**)

### Bug fixes
* The cache bust parameter is no longer added to the URL of the page (address bar and history) and no longer replaces a **t** parameter of the page
* The **scrollRestoration** option is applied by default (it was only applied when set explicitly), **KnNav.init()** without options no longer throws
* Back / forward: the scroll position of the page left is kept, it no longer overwrites the position of the page displayed
* Back / forward direction (**e.detail.action**) is now reliable (the ids were compared as strings)
* Back / forward between the anchors of the same page no longer reloads the page
* Selectors matching no element no longer leave the navigation pending without event (**DOM_ERROR**)
* A second **KnNav.init()** no longer adds a second listener (double requests on back / forward)
* The history entries added by other scripts (**history.pushState** with a state) no longer trigger a navigation to an undefined URL
* The relative URLs of the new content (images, scripts...) are resolved from the new URL, and the browser history menu shows the right titles: the history is updated before the replacement
* A redirected navigation to another origin is loaded without KnNav
* An **[autofocus]** element outside of the replaced elements is no longer focused at each navigation
* The focus of the **[autofocus]** element no longer scrolls the page
* With **history: false**, the history is no longer modified (the scroll position was saved with **history.replaceState** at each navigation)
* With **onePageHistory**, the history always has one entry (e.g. installed PWA without previous / next page): the anchors of the page and the **Kn-Redirect** header no longer add history entries (**location.replace()**)

### Build
* Migrated from gulp to Vite 8 (library mode) and TypeScript 6 (strict mode)
	* **build**, **typecheck** and **dev** scripts
	* **samples** script: Vite dev server of the samples with a mock server-rendered site
* Rewritten as ES modules
* Published on npm as **@karewan/kn-nav**
* Added **kn-http** as peer dependency, **exports**, **files**, **sideEffects** and **publishConfig** fields to package.json
* Commented out all the console.log

v0.5.2 (2024-02-23):
----------------------------
* Kn-Redirect header to force a redirect

v0.5.1 (2023-12-23):
----------------------------
* Use Object.assign to set default options

v0.5.0 (2023-12-16):
----------------------------
* Breaking changes
	* **one_page_history** option renamed **onePageHistory**
	* **scroll_restoration** option renamed **scrollRestoration**
	* **cache_bust** option renamed **cacheBust**

v0.4.0 (2023-09-21)
----------------------------
* Missing changelog...
