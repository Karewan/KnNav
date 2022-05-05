'use strict';
const KnNav = function() {
	const VERSION = '0.3.0',
	GV = {
		uuid_counter: 0,
		attr_state: 'data-kn-nav-state',
		state: {
			num_pending_switches: 0,
			href: null,
			options: null
		}
	};

	/**
	 * Init KnNav
	 */
	function init(opt) {
		console.log('KnNav.init()', opt);

		if(!opt) opt = {};
		if(!opt.elements) opt.elements = ["a"];
		if(!opt.selectors) opt.selectors = ["title", "#app"];
		opt.history = (typeof opt.history === "undefined") ? true : opt.history;
		if(!opt.one_page_history) opt.one_page_history = false;
		opt.scroll_restoration = typeof opt.scroll_restoration !== "undefined" ? opt.scroll_restoration : true;
		opt.cache_bust = typeof opt.cache_bust === "undefined" ? true : opt.cache_bust;
		if(!opt.timeout) opt.timeout = 0;

		if(opt.scroll_restoration && "scrollRestoration" in history) history.scrollRestoration = "manual";

		GV.max_uid = GV.last_uid = newUid();
		GV.opt = opt;

		parseDOM(document);

		on(window, "popstate", st => {
			if(st.state) {
				let opt = clone(GV.opt);
				opt.url = st.state.url;
				opt.title = st.state.title;
				opt.history = false;
				opt.scroll_pos = st.state.scrollPos;

				if(st.state.uid < GV.last_uid) opt.backward = true;
				else opt.forward = true;

				GV.last_uid = st.state.uid;

				navigate(st.state.url, opt);
			}
		});
	}

	/**
	 * Generate a new Uid
	 */
	function newUid() {
		console.log('KnNav.newUid()');
		return "kn_nav_" + new Date().getTime() + "_" + GV.uuid_counter++;
	}

	/**
	 * Clone obj
	 */
	function clone(obj) {
		console.log('KnNav.clone()', obj);

		if(null === obj || "object" !== typeof obj) return obj;

		let copy = obj.constructor();
		for(let attr in obj) {
			if(obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
		}

		return copy;
	}

	/**
	 * For each elements
	 */
	function forEachEls(els, fn, context) {
		console.log('KnNav.forEachEls()', els, fn, context);

		if(els instanceof HTMLCollection || els instanceof NodeList || els instanceof Array) {
			return Array.prototype.forEach.call(els, fn, context);
		}

		return fn.call(context, els);
	}

	/**
	 * On
	 */
	function on(els, events, listener, use_capture) {
		console.log('KnNav.on()', els, events, listener, use_capture);

		events = (typeof events === "string") ? events.split(" ") : events;
		events.forEach(e => forEachEls(els, el => el.addEventListener(e, listener, use_capture)));
	}

	/**
	 * outerHTML
	 */
	function outerHTML(old_el, new_el) {
		console.log('KnNav.outerHTML()', old_el, new_el);

		old_el.outerHTML = new_el.outerHTML;
		onSwitch();
	}

	/**
	 * evalScript
	 */
	function evalScript(el) {
		console.log('KnNav.evalScript()', el);

		let code = el.text || el.textContent || el.innerHTML || "",
		src = el.src || "",
		parent = el.parentNode || document.querySelector("head") || document.documentElement,
		script = document.createElement("script");

		if(code.match("document.write")) {
			console.log("Script contains document.write. Can’t be executed correctly. Code skipped ",el);
			return false;
		}

		script.type = "text/javascript";
		script.id = el.id;

		if(src !== "") {
			script.src = src;
			script.async = false;
		}

		if(code !== "") script.appendChild(document.createTextNode(code));

		parent.appendChild(script);
		if((parent instanceof HTMLHeadElement || parent instanceof HTMLBodyElement) && parent.contains(script)) parent.removeChild(script);

		return true;
	}

	/**
	 * executeScripts
	 */
	function executeScripts(el) {
		console.log('KnNav.executeScripts()', el);

		if(el.tagName.toLowerCase() === "script") evalScript(el);
		forEachEls(el.querySelectorAll("script"), script => {
			if(!script.type || script.type.toLowerCase() === "text/javascript") {
				if(script.parentNode) script.parentNode.removeChild(script);
				evalScript(script);
			}
		});
	}

	/**
	 * trigger
	 */
	function trigger(els, events, opts) {
		console.log('KnNav.trigger()', els, events, opts);

		events = (typeof events === "string") ? events.split(" ") : events;
		events.forEach(function(e) {
			let event;
			event = document.createEvent("HTMLEvents");
			event.initEvent(e, true, true);
			event.eventName = e;
			if(opts) Object.keys(opts).forEach(key => event[key] = opts[key]);
			forEachEls(els, el => el.dispatchEvent(event));
		});
	}

	/**
	 * contains
	 */
	function contains(doc, selectors, el) {
		console.log('KnNav.contains()', doc, selectors, el);

		for(let i = 0; i < selectors.length; i++) {
			let selected_els = doc.querySelectorAll(selectors[i]);
			for(let j = 0; j < selected_els.length; j++) {
				if(selected_els[j].contains(el)) return true;
			}
		}

		return false;
	}

	/**
	 * extend
	 */
	function extend(target) {
		console.log('KnNav.extend()', target);

		if(target == null) return null;

		let to = Object(target)
		for(let i = 1; i < arguments.length; i++) {
			let source = arguments[i];
			if(source != null) for(let key in source) {
				if(Object.prototype.hasOwnProperty.call(source, key)) to[key] = source[key];
			}
		}

		return to;
	}

	/**
	 * parseDOM
	 */
	function parseDOM(el) {
		console.log('KnNav.parseDOM()', el);

		forEachEls(el.querySelectorAll(GV.opt.elements), el => {
			if(el.tagName.toLowerCase() == 'a') {
				if(!el.hasAttribute(GV.attr_state)) attachLink(el);
			} else {
				throw "KnNav can only be applied on <a>";
			}
		}, this);
	}

	/**
	 * refresh
	 */
	function refresh(el) {
		console.log('KnNav.refresh()', el);
		parseDOM(el || document);
	}

	/**
	 * reload
	 */
	function reload() {
		console.log('KnNav.reload()');
		window.location.reload();
	}

	/**
	 * linkAction
	 */
	function linkAction(el, event) {
		console.log('KnNav.linkAction()', el, event);

		if(event.defaultPrevented || event.returnValue === false) return;

		let options = clone(GV.opt);

		let attrValue = checkIfShouldAbortLinkAction(el, event);
		if(attrValue) {
			el.setAttribute(GV.attr_state, attrValue);
			return;
		}

		event.preventDefault();

		el.setAttribute(GV.attr_state, "load");

		options.trigger_element = el;
		navigate(el.href, options);
	}

	/**
	 * checkIfShouldAbortLinkAction
	 */
	function checkIfShouldAbortLinkAction(el, event) {
		console.log('KnNav.checkIfShouldAbortLinkAction()', el, event);

		if(event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return "modifier";
		if(el.protocol !== window.location.protocol || el.host !== window.location.host) return "external";
		if(el.hash && el.href.replace(el.hash, "") === window.location.href.replace(location.hash, "")) return "anchor";
		if(el.href === window.location.href.split("#")[0] + "#") return "anchor-empty";
	}

	/**
	 * attachLink
	 */
	function attachLink(el) {
		console.log('KnNav.attachLink()', el);

		let that = this;
		el.setAttribute(GV.attr_state, "");
		on(el, "click", event => linkAction.call(that, el, event));
	}

	/**
	 * switchSelectors
	 */
	function switchSelectors(selectors, from_el, to_el, options) {
		console.log('KnNav.switchSelectors()', selectors, from_el, to_el, options);

		let switches_queue = [];

		selectors.forEach(function(selector) {
			let new_els = from_el.querySelectorAll(selector),
			old_els = to_el.querySelectorAll(selector);

			console.log("KnNav switch", selector, new_els, old_els);

			if (new_els.length !== old_els.length) {
				throw "DOM doesn’t look the same on new loaded page: ’" +
				selector +
				"’ - new " +
				new_els.length +
				", old " +
				old_els.length;
			}

			forEachEls(
				new_els,
				function(new_el, i) {
					switches_queue.push(outerHTML.bind(this, old_els[i], new_el, options));
				},
				this
			);
		}, this);

		GV.state.num_pending_switches = switches_queue.length;

		switches_queue.forEach(queued_switch => queued_switch());
	}

	/**
	 * onSwitch
	 */
	function onSwitch() {
		console.log('KnNav.onSwitch()');

		trigger(window, "resize scroll");
		GV.state.num_pending_switches--;
		if(GV.state.num_pending_switches === 0) afterAllSwitches();
	}

	/**
	 * loadContent
	 */
	function loadContent(html, options) {
		console.log('KnNav.loadContent()', html, options);

		if(typeof html !== "string") {
			trigger(document, "kn_nav:complete kn_nav:error", options);
			return;
		}

		let tmp_el = document.implementation.createHTMLDocument("kn_nav");
		tmp_el.documentElement.innerHTML = html;

		// Clear out any focused controls before inserting new page contents.
		if(document.activeElement) {
			try {
				document.activeElement.blur();
			} catch (e) {
			}
		}

		switchSelectors(GV.opt.selectors, tmp_el, document, options);
	}

	/**
	 * abortRequest
	 */
	function abortRequest(request) {
		console.log('KnNav.abortRequest()', request);

		if(request && request.readyState < 4) {
			request.onreadystatechange = () => {};
			request.abort();
		}
	}

	/**
	 * doRequest
	 */
	function doRequest(location, options, callback) {
		console.log('KnNav.doRequest()', location, options, callback);

		const request = new XMLHttpRequest();

		request.onreadystatechange = () => {
			if(request.readyState === 4) {
				if(request.status === 200) callback(request.responseText, request, location, options);
				else if(request.status !== 0) callback(null, request, location, options);
			}
		};

		request.onerror = e => callback(null, request, location, options);

		request.ontimeout = () => callback(null, request, location, options);

		if(options.cache_bust) {
			const url = new URL(location);
			url.searchParams.set('t', Date.now());
			location = url.toString();
		}

		request.open('GET', location, true);
		request.timeout = options.timeout || 270000;
		request.setRequestHeader('X-Requested-With', 'KnNav');
		request.send(null);
		return request;
	}

	/**
	 * handleResponse
	 */
	function handleResponse(response_text, request, href, options) {
		console.log('KnNav.handleResponse()', response_text, request, href, options);

		options = clone(options || GV.opt);
		options.request = request;

		if(response_text === false) {
			trigger(document, "kn_nav:complete kn_nav:error", options);
			return;
		}

		let current_state = window.history.state || {};
		window.history.replaceState(
			{
				url: current_state.url || window.location.href,
				title: current_state.title || document.title,
				uid: current_state.uid || newUid(),
				scrollPos: [
					document.documentElement.scrollLeft || document.body.scrollLeft,
					document.documentElement.scrollTop || document.body.scrollTop
				]
			},
			document.title,
			window.location.href
		);


		let old_href = href;
		if(request.responseURL) {
			if(href !== request.responseURL) href = request.responseURL;
		}

		let a = document.createElement("a");
		a.href = old_href;
		let old_hash = a.hash;
		a.href = href;
		if(old_hash && !a.hash) {
			a.hash = old_hash;
			href = a.href;
		}

		GV.state.href = href;
		GV.state.options = options;

		try {
			loadContent(response_text, options);
		} catch (e) {
			trigger(document, "kn_nav:complete kn_nav:error", options);
			console.log("KnNav switch fail: ", e);
			throw e;
		}
	}

	/**
	 * navigate
	 */
	function navigate(href, options) {
		console.log('KnNav.navigate()', href, options);
		options = typeof options === "object" ? extend({}, GV.opt, options) : clone(GV.opt);
		abortRequest(GV.request);
		trigger(document, "kn_nav:send", options);
		GV.request = doRequest(href, options, handleResponse);
	}

	/**
	 * afterAllSwitches
	 */
	function afterAllSwitches() {
		console.log('KnNav.afterAllSwitches()');

		let state = GV.state,
		autofocus_el = Array.prototype.slice.call(document.querySelectorAll("[autofocus]")).pop();
		if(autofocus_el && document.activeElement !== autofocus_el) autofocus_el.focus();

		if(state.options.history) {
			if(!window.history.state) {
				GV.last_uid = GV.max_uid = newUid();
				window.history.replaceState(
					{
						url: window.location.href,
						title: document.title,
						uid: GV.max_uid,
						scrollPos: [0, 0]
					},
					document.title
				);
			}

			GV.last_uid = GV.max_uid = newUid();

			if(state.options.one_page_history) {
				window.history.replaceState(
					{
						url: state.href,
						title: state.options.title,
						uid: GV.max_uid,
						scrollPos: [0, 0]
					},
					state.options.title,
					state.href
				);
			} else {
				window.history.pushState(
					{
						url: state.href,
						title: state.options.title,
						uid: GV.max_uid,
						scrollPos: [0, 0]
					},
					state.options.title,
					state.href
				);
			}
		}

		trigger(document, "kn_nav:complete kn_nav:success", state.options);

		GV.opt.selectors.forEach(selector => forEachEls(document.querySelectorAll(selector), el => executeScripts(el)));

		GV.opt.selectors.forEach(selector => forEachEls(document.querySelectorAll(selector), el => parseDOM(el), this));

		if(state.options.history) {
			let a = document.createElement("a");
			a.href = GV.state.href;

			if(a.hash) {
				let name = a.hash.slice(1);
				name = decodeURIComponent(name);

				let curtop = 0,
				target = document.getElementById(name) || document.getElementsByName(name)[0];

				if(target && target.offsetParent) do {
					curtop += target.offsetTop;
					target = target.offsetParent;
				} while (target);

				window.scrollTo(0, curtop);
			}
		} else if(state.options.scroll_restoration && state.options.scroll_pos) {
			window.scrollTo(state.options.scroll_pos[0], state.options.scroll_pos[1]);
		}

		GV.state = {
			num_pending_switches: 0,
			href: null,
			options: null
		};
	}

	/*************************************************
	 * PUBLIC METHODS
	 ************************************************/

	return {
		VERSION,
		init,
		navigate,
		reload,
		refresh
	}
}();
