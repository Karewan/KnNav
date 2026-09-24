// KnNav browser script sample: KnHttp and KnNav are global objects

KnNav.init({
	// head title, the navigation (active link) and the content are replaced
	selectors: ['head title', '#nav', '#app'],
	// The 404 page of the site is rendered (it contains the selectors)
	renderErrorPages: true,
	// KnHttp options of the requests
	request: {
		timeout: 30_000
	}
});

const loader = document.getElementById('loader'),
logList = document.querySelector('#log ol'),
toasts = document.getElementById('toasts');

// Event log
function log(text, type) {
	const li = document.createElement('li');
	li.textContent = new Date().toLocaleTimeString() + ' ' + text;
	li.className = type || '';
	logList.prepend(li);
}

// Toast
function toast(text) {
	const div = document.createElement('div');
	div.className = 'toast';
	div.textContent = text;
	toasts.appendChild(div);
	setTimeout(() => div.remove(), 4000);
}

// Navigation start
document.addEventListener('kn_nav:send', e => {
	loader.classList.add('active');
	log('send ' + e.detail.action + ' ' + new URL(e.detail.url).pathname);
});

// Page rendered (the scripts of the page are executed after this event)
document.addEventListener('kn_nav:success', e => {
	log('success ' + e.detail.status + ', appv ' + e.detail.headers['appv'], 'success');
});

// Navigation failed
document.addEventListener('kn_nav:error', e => {
	const err = e.detail.error;
	log('error ' + err.code + ' ' + err.status + ': ' + err.message, 'error');

	switch (err.code) {
		// The page has another layout: loaded without KnNav
		case KnNav.DOM_ERROR:
			window.location.href = e.detail.url;
			break;

		case KnNav.HTTP_ERROR:
			toast('HTTP error ' + err.status);
			break;

		case KnNav.NETWORK_ERROR:
			toast('Please check your internet connection');
			break;

		case KnNav.TIMEOUT_ERROR:
			toast('The server is taking too long to respond');
			break;

		default:
			toast(err.message);
	}
});

// Always dispatched last (success, error or cancel)
document.addEventListener('kn_nav:complete', e => {
	loader.classList.remove('active');
	if (e.detail.canceled) log('canceled ' + new URL(e.detail.url).pathname, 'canceled');
});

// Buttons of the home page (the content is replaced: delegated listener)
document.addEventListener('click', e => {
	const button = e.target.closest('[data-action]');
	if (!button) return;

	switch (button.dataset.action) {
		case 'navigate':
			KnNav.navigate('/iife/slow').then(result => log('navigate() resolved, success: ' + result.success));
			break;

		case 'replace':
			KnNav.navigate('/iife/long', { replace: true });
			break;

		case 'timeout':
			KnNav.navigate('/iife/very-slow', { request: { timeout: 2000 } });
			break;

		case 'abort':
			KnNav.abort();
			break;
	}
});

log('KnHttp ' + KnHttp.VERSION + ', KnNav ' + KnNav.VERSION + ' initialized');
