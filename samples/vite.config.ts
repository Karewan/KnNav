import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import pkg from '../package.json' with { type: 'json' };

/**
 * Sample mode: browser script (IIFE, dist) or ES module (TypeScript, sources)
 */
type Mode = 'iife' | 'esm';

/**
 * Page of the mock site
 */
interface Page {
	title: string;
	body: string;
	status?: number;
	delay?: number;
	headers?: Record<string, string>;
	/** Page without the layout of the site */
	raw?: boolean;
}

/**
 * Wait
 * @param ms
 * @returns
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape HTML
 * @param str
 * @returns
 */
function escapeHtml(str: string): string {
	return str.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

/**
 * Pages of the mock site (the links are relative to /iife/ or /esm/)
 * @param mode
 * @param path
 * @returns
 */
function getPage(mode: Mode, path: string): Page | 'redirect' | 'network-error' {
	const base = `/${mode}`;

	switch (path) {
		case '/': return {
			title: 'Home',
			body: `
				<p>KnNav loads the links with Ajax and replaces <code>head title</code>, <code>#nav</code> and <code>#app</code>.
				The loader, the event log and the toasts are outside of these elements: they are kept between the pages.</p>

				<h2>Navigation</h2>
				<ul>
					<li><a href="${base}/long">Long page</a>: scroll restoration on back / forward, anchors</li>
					<li><a href="${base}/long#section-3">Anchor of another page</a></li>
					<li><a href="${base}/slow">Slow page</a> (1.5 s): loader</li>
					<li><a href="${base}/scripts">Page with scripts</a>: inline, external, module, data block, autofocus</li>
					<li><a href="${base}/redirect">HTTP redirection</a> (302): the URL of the final page is displayed</li>
					<li><a href="${base}/kn-redirect">Kn-Redirect header</a>: full page load</li>
				</ul>

				<h2>Errors</h2>
				<ul>
					<li><a href="${base}/not-found">404 page with the layout</a>: rendered (<code>renderErrorPages</code> option)</li>
					<li><a href="${base}/server-error">500 error without the layout</a>: HTTP error, toast</li>
					<li><a href="${base}/other-layout">Other layout</a>: DOM error, full page load</li>
					<li><a href="${base}/network-error">Network error</a>: toast</li>
					<li><button type="button" data-action="timeout">Timeout</button> <code>KnNav.navigate()</code> with a 2 s timeout on a 10 s page</li>
				</ul>

				<h2>Links ignored by KnNav</h2>
				<ul>
					<li><a href="${base}/long" target="_blank">target="_blank"</a></li>
					<li><a href="${base}/long" data-kn-nav="false">data-kn-nav="false"</a>: full page load</li>
					<li><a href="/samples/style.css" download>download attribute</a></li>
					<li><a href="https://github.com/Karewan/KnNav">Other origin</a></li>
				</ul>

				<h2>API</h2>
				<p>
					<button type="button" data-action="navigate">KnNav.navigate('${base}/slow')</button>
					<button type="button" data-action="replace">KnNav.navigate('${base}/long', { replace: true })</button>
					<button type="button" data-action="abort">KnNav.abort()</button>
				</p>
			`
		};

		case '/long': return {
			title: 'Long page',
			body: `
				<p>Scroll, open another page, then go back: the scroll position is restored.</p>
				<p>${[1, 2, 3, 4, 5].map(i => `<a href="#section-${i}">Section ${i}</a>`).join(' · ')}</p>
				${[1, 2, 3, 4, 5].map(i => `
					<section id="section-${i}" class="section">
						<h2>Section ${i}</h2>
						<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam.</p>
						<p><a href="${base}/">Home</a> · <a href="${base}/scripts">Page with scripts</a> · <a href="#top">Top</a></p>
					</section>
				`).join('')}
			`
		};

		case '/slow': return {
			title: 'Slow page',
			delay: 1500,
			body: '<p>This page has been rendered by the server in 1.5 s.</p>'
		};

		case '/very-slow': return {
			title: 'Very slow page',
			delay: 10_000,
			body: '<p>This page has been rendered by the server in 10 s.</p>'
		};

		case '/scripts': return {
			title: 'Page with scripts',
			body: `
				<p>Inline script: <strong id="inline-result">not executed</strong></p>
				<script>document.getElementById('inline-result').textContent = 'executed at ' + new Date().toLocaleTimeString();</script>

				<p>document.currentScript: <strong id="current-script-result">not executed</strong></p>
				<script data-test="ok">document.getElementById('current-script-result').textContent = document.currentScript ? 'data-test=' + document.currentScript.dataset.test : 'null';</script>

				<p>External script: <strong id="external-result">not executed</strong></p>
				<script src="/samples/external.js"></script>

				<p>Module script: <strong id="module-result">not executed</strong></p>
				<script type="module">document.getElementById('module-result').textContent = 'executed';</script>

				<p>Data block (not executed): <strong id="data-result"></strong></p>
				<script type="application/json" id="page-data">{ "id": 42 }</script>
				<script>document.getElementById('data-result').textContent = 'id ' + JSON.parse(document.getElementById('page-data').textContent).id;</script>

				<p><label>Autofocus <input autofocus placeholder="Focused after the navigation"></label></p>
			`
		};

		case '/redirect': return 'redirect';

		case '/redirected': return {
			title: 'Redirected page',
			body: `<p>The server has redirected <code>${base}/redirect</code> to this page: the URL of this page is displayed.</p>`
		};

		case '/kn-redirect': return {
			title: 'Kn-Redirect',
			headers: { 'Kn-Redirect': `${base}/?from=kn-redirect` },
			body: '<p>Never displayed: KnNav loads the URL of the Kn-Redirect header.</p>'
		};

		case '/server-error': return {
			title: 'Server error',
			status: 500,
			raw: true,
			body: 'Internal Server Error'
		};

		case '/other-layout': return {
			title: 'Other layout',
			raw: true,
			body: `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Other layout</title>
	<link rel="stylesheet" href="/samples/style.css">
</head>
<body>
	<div class="other-layout">
		<h1>Other layout</h1>
		<p>This page has no <code>#app</code> element: KnNav dispatches a DOM error, the sample loads the page without KnNav.</p>
		<p><a href="${base}/">Back to the home page</a></p>
	</div>
</body>
</html>`
		};

		case '/network-error': return 'network-error';

		default: return {
			title: 'Page not found',
			status: 404,
			body: `<p>The page <code>${escapeHtml(base + path)}</code> does not exist. This 404 page has the layout of the site: it is rendered by KnNav (<code>renderErrorPages</code> option).</p>`
		};
	}
}

/**
 * Layout of the site
 * @param mode
 * @param path
 * @param page
 * @param knNav True for a KnNav request
 * @param requestUrl
 * @returns
 */
function layout(mode: Mode, path: string, page: Page, knNav: boolean, requestUrl: string): string {
	const base = `/${mode}`,
		nav = [['/', 'Home'], ['/long', 'Long page'], ['/slow', 'Slow page'], ['/scripts', 'Scripts'], ['/not-found', '404']]
			.map(([href, label]) => `<a href="${base}${href}"${href == path ? ' class="active"' : ''}>${label}</a>`)
			.join('\n\t\t\t'),
		other = mode == 'iife' ? 'esm' : 'iife',
		// The dist folder is not watched by the Vite dev server: the query string loads the last build
		scripts = mode == 'iife'
			? `<script src="/node_modules/kn-http/dist/kn-http.iife.min.js"></script>
	<script src="/dist/kn-nav.iife.js?v=${Date.now()}"></script>
	<script src="/samples/app.js"></script>`
			: '<script type="module" src="/samples/app.ts"></script>';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${page.title} - KnNav ${mode.toUpperCase()} sample</title>
	<link rel="stylesheet" href="/samples/style.css">
</head>
<body id="top">
	<div id="loader"></div>
	<header>
		<strong>KnNav ${mode.toUpperCase()}</strong>
		<nav id="nav">
			${nav}
			<a href="/${other}${path}" data-kn-nav="false" class="switch">${other.toUpperCase()} sample</a>
		</nav>
	</header>
	<main id="app">
		<h1>${page.title}</h1>
		<p class="meta">HTTP ${page.status ?? 200} · ${knNav ? 'KnNav request' : 'Full page load'} · ${escapeHtml(requestUrl)} · ${new Date().toLocaleTimeString()}</p>
		${page.body}
	</main>
	<aside id="log"><strong>Events</strong><ol></ol></aside>
	<div id="toasts"></div>
	${scripts}
</body>
</html>`;
}

/**
 * Mock site: /iife/* (browser script sample) and /esm/* (ES module sample)
 * - The pages are rendered by the server with the layout of the site
 * - appv header on all the responses (application version)
 * @returns
 */
function mockSite(): Plugin {
	return {
		name: 'kn-nav-mock-site',
		configureServer(server: ViteDevServer) {
			server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
				const url = new URL(req.url ?? '/', 'http://localhost');

				if (url.pathname == '/') {
					res.writeHead(302, { Location: '/iife/' });
					res.end();
					return;
				}

				const match = /^\/(iife|esm)(\/.*)?$/.exec(url.pathname);
				if (!match) return next();

				const mode = match[1] as Mode,
					path = match[2] ?? '';

				if (!path) {
					res.writeHead(302, { Location: `/${mode}/` });
					res.end();
					return;
				}

				const page = getPage(mode, path);

				if (page == 'redirect') {
					res.writeHead(302, { Location: `/${mode}/redirected` });
					res.end();
					return;
				}

				if (page == 'network-error') {
					req.socket.destroy();
					return;
				}

				if (page.delay) await sleep(page.delay);

				const knNav = req.headers['x-requested-with'] == 'KnNav';
				let html = page.raw ? page.body : layout(mode, path, page, knNav, url.pathname + url.search);

				// The ES module sample is transformed by Vite (TypeScript)
				if (mode == 'esm' && !page.raw) html = await server.transformIndexHtml(url.pathname, html);

				res.writeHead(page.status ?? 200, {
					'Content-Type': page.raw && !page.body.startsWith('<!DOCTYPE') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8',
					'appv': pkg.version,
					...page.headers
				});
				res.end(html);
			});
		}
	};
}

/**
 * Samples dev server (pnpm samples)
 * - http://localhost:5173/iife/ Browser script sample (dist, pnpm build first)
 * - http://localhost:5173/esm/ ES module + TypeScript sample (sources of KnNav)
 */
export default defineConfig({
	plugins: [mockSite()],
	define: {
		__KN_NAV_VERSION__: JSON.stringify(pkg.version)
	},
	resolve: {
		// The ES module sample imports the sources of KnNav
		alias: [
			{ find: /^@karewan\/kn-nav$/, replacement: '/src/kn-nav.ts' }
		]
	},
	server: {
		open: '/iife/'
	}
});
