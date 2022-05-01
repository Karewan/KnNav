'use strict';
const KnNav = function() {
	const VERSION = '0.1.0',
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
		if(!opt.elements) opt.elements = "a";
		if(!opt.selectors) opt.selectors = ["title", "#app"];
		if(!opt.switches) opt.switches = {};
		if(!opt.switches_options) opt.switches_options = {};
		opt.history = (typeof opt.history === "undefined") ? true : opt.history;
		if(!opt.one_page_history) opt.one_page_history = false;
		opt.analytics = typeof opt.analytics === "function" || opt.analytics === false ? opt.analytics : defaultAnalytics;
		opt.scroll_to = typeof opt.scroll_to === "undefined" ? 0 : opt.scroll_to;
		opt.scroll_restoration = typeof opt.scroll_restoration !== "undefined" ? opt.scroll_restoration : true;
		opt.cache_bust = typeof opt.cache_bust === "undefined" ? true : opt.cache_bust;
		if(!opt.timeout) opt.timeout = 0;
		if(!opt.current_url_full_reload) opt.current_url_full_reload = false;
		if(!opt.switches.head) opt.switches.head = switchElementsAlt;
		if(!opt.switches.body) opt.switches.body = switchElementsAlt;

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

				loadUrl(st.state.url, opt);
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
	 * switchElementsAlt
	 */
	function switchElementsAlt(old_el, new_el) {
		console.log('KnNav.switchElementsAlt()', old_el, new_el);

		old_el.innerHTML = new_el.innerHTML;

		if(new_el.hasAttributes()) {
			let attrs = new_el.attributes;
			for(let i = 0; i < attrs.length; i++) old_el.attributes.setNamedItem(attrs[i].cloneNode());
		}

		onSwitch();
	}

	/**
	 * defaultAnalytics
	 */
	function defaultAnalytics() {
		console.log('KnNav.defaultAnalytics()');

		if(window._gaq) _gaq.push(["_trackPageview"]);

		if(window.ga) ga("send", "pageview", {
			page: location.pathname,
			title: document.title
		});

		console.log(GV);
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
			switch(el.tagName.toLowerCase()) {
				case "a":
					if(!el.hasAttribute(GV.attr_state)) attachLink(el);
					break;

				case "form":
					if(!el.hasAttribute(GV.attr_state)) {
						let that = this;
						el.setAttribute(GV.attr_state, "");
						on(el, "submit", el => formAction.call(that, el, event));
					}
					break;

				default:
					throw "KnNav can only be applied on <a> or <form> submit";
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

		if(isDefaultPrevented(event)) return;

		let options = clone(GV.opt);

		let attrValue = checkIfShouldAbortLinkAction(el, event);
		if(attrValue) {
			el.setAttribute(GV.attr_state, attrValue);
			return;
		}

		event.preventDefault();

		if(GV.opt.current_url_full_reload && el.href === window.location.href.split("#")[0]) {
			el.setAttribute(GV.attr_state, "reload");
			reload();
			return;
		}

		el.setAttribute(GV.attr_state, "load");

		options.trigger_element = el;
		loadUrl(el.href, options);
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
	 * isDefaultPrevented
	 */
	function isDefaultPrevented(event) {
		console.log('KnNav.isDefaultPrevented()', event);
		return event.defaultPrevented || event.returnValue === false;
	}

	/**
	 * attachLink
	 */
	function attachLink(el) {
		console.log('KnNav.attachLink()', el);

		let that = this;
		el.setAttribute(GV.attr_state, "");
		on(el, "click", event => linkAction.call(that, el, event));
		on(el, "keyup", event => {
			if(event.keyCode === 13) linkAction.call(that, el, event);
		});
	}

	/**
	 * formAction
	 */
	function formAction(el, event) {
		console.log('KnNav.formAction()', el, event);

		if(isDefaultPrevented(event)) return;

		let options = clone(GV.opt);
		options.request_options = {
			requestUrl: el.getAttribute("action") || window.location.href,
			requestMethod: el.getAttribute("method") || "GET"
		};

		let virtlink_element = document.createElement("a");
		virtlink_element.setAttribute("href", options.request_options.requestUrl);

		let attr_value = checkIfShouldAbortFormAction(virtlink_element, options);
		if(attr_value) {
			el.setAttribute(GV.attr_state, attr_value);
			return;
		}

		event.preventDefault();

		if(el.enctype === "multipart/form-data") options.request_options.formData = new FormData(el);
		else options.request_options.requestParams = parseFormElements(el);

		el.setAttribute(GV.attr_state, "submit");

		options.trigger_element = el;
		loadUrl(virtlink_element.href, options);
	}

	/**
	 * checkIfShouldAbortFormAction
	 */
	function checkIfShouldAbortFormAction(virtlinkelement, options) {
		console.log('KnNav.checkIfShouldAbortFormAction()', virtlinkelement, options);

		if(virtlinkelement.protocol !== window.location.protocol
			|| virtlinkelement.host !== window.location.host) {

			return "external";
		}

		if(virtlinkelement.hash
			&& virtlinkelement.href.replace(virtlinkelement.hash, "") === window.location.href.replace(location.hash, "")) {

			return "anchor";
		}

		if(virtlinkelement.href === window.location.href.split("#")[0] + "#") {
			return "anchor-empty";
		}

		if(options.current_url_full_reload
			&& virtlinkelement.href === window.location.href.split("#")[0]) {

			return "reload";
		}
	}

	/**
	 * parseFormElements
	 */
	function parseFormElements(el) {
		console.log('KnNav.parseFormElements()', el);

		let request_params = [],
		form_elements = el.elements;

		for(let i = 0; i < form_elements.length; i++) {
			let element = form_elements[i],
			tag_name = element.tagName.toLowerCase();

			if(!!element.name && element.attributes !== undefined && tag_name !== "button") {
				let type = element.attributes.type;

				if(!type || (type.value !== "checkbox" && type.value !== "radio") || element.checked) {
					let values = [];

					if(tag_name === "select") {
						let opt;
						for(let j = 0; j < element.options.length; j++) {
							opt = element.options[j];
							if(opt.selected && !opt.disabled) values.push(opt.hasAttribute("value") ? opt.value : opt.text);
						}
					} else {
						values.push(element.value);
					}

					for(let k = 0; k < values.length; k++) request_params.push({
						name: encodeURIComponent(element.name),
						value: encodeURIComponent(values[k])
					});
				}
			}
		}

		return request_params;
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
					let old_el = old_els[i];

					console.log("new_el", new_el, "old_el", old_el);

					let callback = GV.opt.switches[selector]
						? GV.opt.switches[selector].bind(
							this,
							old_el,
							new_el,
							options,
							GV.opt.switches_options[selector]
						)
						: outerHTML.bind(this, old_el, new_el, options);

					switches_queue.push(callback);
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

		let tmp_el = document.implementation.createHTMLDocument("kn_nav"),
		html_regex = /<html[^>]+>/gi,
		html_attribs_regex = /\s?[a-z:]+(?:=['"][^'">]+['"])*/gi,
		matches = html.match(html_regex);

		if(matches && matches.length) {
			matches = matches[0].match(html_attribs_regex);
			if(matches.length) {
				matches.shift();
				matches.forEach(function(htmlAttrib) {
					let attr = htmlAttrib.trim().split("=");

					if(attr.length === 1) tmp_el.documentElement.setAttribute(attr[0], true);
					else tmp_el.documentElement.setAttribute(attr[0], attr[1].slice(1, -1));
				});
			}
		}

		tmp_el.documentElement.innerHTML = html;
		console.log("load content", tmp_el.documentElement.attributes, tmp_el.documentElement.innerHTML.length);

		// Clear out any focused controls before inserting new page contents.
		if(document.activeElement && contains(document, GV.opt.selectors, document.activeElement)) {
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
	 * updateQueryString
	 */
	function updateQueryString(uri, key, value) {
		console.log('KnNav.updateQueryString()', uri, key, value);

		let re = new RegExp("([?&])" + key + "=.*?(&|$)", "i"),
		separator = uri.indexOf("?") !== -1 ? "&" : "?";

		if(uri.match(re)) return uri.replace(re, "$1" + key + "=" + value + "$2");
		else return uri + separator + key + "=" + value;
	}

	/**
	 * doRequest
	 */
	function doRequest(location, options, callback) {
		console.log('KnNav.doRequest()', location, options, callback);

		options = options || {};

		let query_string,
		request_options = options.request_options || {},
		request_method = (request_options.requestMethod || "GET").toUpperCase(),
		request_params = request_options.requestParams || null,
		form_data = request_options.formData || null,
		request_payload = null,
		request = new XMLHttpRequest(),
		timeout = options.timeout || 0;

		request.onreadystatechange = () => {
			if(request.readyState === 4) {
				if(request.status === 200) callback(request.responseText, request, location, options);
				else if(request.status !== 0) callback(null, request, location, options);
			}
		};

		request.onerror = e => callback(null, request, location, options)

		request.ontimeout = () => callback(null, request, location, options);

		if(request_params && request_params.length) {
			query_string = request_params.map(param => param.name + "=" + param.value).join("&");

			switch(request_method) {
				case "GET":
					location = location.split("?")[0];
					location += "?" + query_string;
					break;

				case "POST":
					request_payload = query_string;
					break;
			}
		} else if(form_data) {
			request_payload = form_data;
		}

		if(options.cache_bust) location = updateQueryString(location, "t", Date.now());

		request.open(request_method, location, true);
		request.timeout = timeout;
		request.setRequestHeader('X-Requested-With', 'KnNav');

		if(request_payload && request_method === "POST" && !form_data) request.setRequestHeader("Content-Type","application/x-www-form-urlencoded");

		request.send(request_payload);

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
	 * loadUrl
	 */
	function loadUrl(href, options) {
		console.log('KnNav.loadUrl()', href, options);
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

		let autofocus_el = Array.prototype.slice.call(document.querySelectorAll("[autofocus]")).pop();
		if(autofocus_el && document.activeElement !== autofocus_el) autofocus_el.focus();

		GV.opt.selectors.forEach(selector => forEachEls(document.querySelectorAll(selector), el => executeScripts(el)));

		let state = GV.state;

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

		let ctx = this || document;
		GV.opt.selectors.forEach(selector => forEachEls(ctx.querySelectorAll(selector), el => parseDOM(el), ctx))

		trigger(document, "kn_nav:complete kn_nav:success", state.options);

		if(typeof state.options.analytics === "function") state.options.analytics();

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
			} else if(state.options.scroll_to !== false) {
				if(state.options.scroll_to.length > 1) window.scrollTo(state.options.scrollTo[0], state.options.scrollTo[1]);
				else window.scrollTo(0, state.options.scroll_to);
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
		loadUrl,
		reload,
		refresh
	}
}();
