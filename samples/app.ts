// KnNav ES module + TypeScript sample (the events and the results are typed)
import KnHttp from 'kn-http';
import KnNav, { type KnNavNavigateOptions } from '@karewan/kn-nav';

// KnHttp instance of the navigation requests: timeout, retries, hooks...
const client = KnHttp.create({
	timeout: 30_000,
	retry: { limit: 1, statusCodes: [502, 503, 504] },
	hooks: {
		afterResponse: (res, ctx) => console.log('KnHttp', ctx.method, ctx.url, res.status)
	}
});

KnNav.init({
	selectors: ['head title', '#nav', '#app'],
	renderErrorPages: true,
	client: client
});

/**
 * Get an element of the layout
 * @param selector
 * @returns
 */
function getElement<T extends Element>(selector: string): T {
	const el = document.querySelector<T>(selector);
	if (!el) throw new Error('Element not found: ' + selector);
	return el;
}

const loader = getElement<HTMLElement>('#loader'),
	logList = getElement<HTMLOListElement>('#log ol'),
	toasts = getElement<HTMLElement>('#toasts');

/**
 * Event log
 * @param text
 * @param type
 */
function log(text: string, type = ''): void {
	const li = document.createElement('li');
	li.textContent = `${new Date().toLocaleTimeString()} ${text}`;
	li.className = type;
	logList.prepend(li);
}

/**
 * Toast
 * @param text
 */
function toast(text: string): void {
	const div = document.createElement('div');
	div.className = 'toast';
	div.textContent = text;
	toasts.appendChild(div);
	setTimeout(() => div.remove(), 4000);
}

document.addEventListener('kn_nav:send', e => {
	loader.classList.add('active');
	log(`send ${e.detail.action} ${new URL(e.detail.url).pathname}`);
});

document.addEventListener('kn_nav:success', e => {
	log(`success ${e.detail.status}, appv ${e.detail.headers['appv'] ?? '?'}`, 'success');
});

document.addEventListener('kn_nav:error', e => {
	const { error } = e.detail;
	log(`error ${error.code} ${error.status}: ${error.message}`, 'error');

	switch (error.code) {
		case KnNav.DOM_ERROR:
			window.location.href = e.detail.url;
			break;

		case KnNav.HTTP_ERROR:
			toast(`HTTP error ${error.status}`);
			break;

		case KnNav.NETWORK_ERROR:
			toast('Please check your internet connection');
			break;

		case KnNav.TIMEOUT_ERROR:
			toast('The server is taking too long to respond');
			break;

		default:
			toast(error.message);
	}
});

document.addEventListener('kn_nav:complete', e => {
	loader.classList.remove('active');
	if (e.detail.canceled) log(`canceled ${new URL(e.detail.url).pathname}`, 'canceled');
});

/**
 * Navigate and log the result (the promise is never rejected)
 * @param url
 * @param options
 */
async function go(url: string, options?: KnNavNavigateOptions): Promise<void> {
	const result = await KnNav.navigate(url, options);

	if (result.success) log(`navigate() resolved: ${result.status}`);
	else if (result.canceled) log('navigate() resolved: canceled');
	else log(`navigate() resolved: ${result.error.code}`);
}

document.addEventListener('click', e => {
	const button = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-action]') : null;
	if (!button) return;

	switch (button.dataset['action']) {
		case 'navigate':
			void go('/esm/slow');
			break;

		case 'replace':
			void go('/esm/long', { replace: true });
			break;

		case 'timeout':
			void go('/esm/very-slow', { request: { timeout: 2000 } });
			break;

		case 'abort':
			KnNav.abort();
			break;
	}
});

log(`KnHttp ${KnHttp.VERSION}, KnNav ${KnNav.VERSION} initialized`);
