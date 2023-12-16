# KnNav

Javascript ajax navigation library.

### Changelog

See the changelog [here](CHANGELOG.md)

### Usage

* Get the latest version in [dist](dist) folder

* Methods

	```javascript
	// Init
	KnNav.init(opt);

	// Navigate to URL
	// with optional options, same options as the init method
	KnNav.navigate('/masuperpage', opt);

	// Refresh (Parse the DOM again)
	KnNav.refresh();

	// Reload (full reload of the page)
	// Eq=window.location.reload();
	KnNav.reload();
	```

* Properties

	```javascript
	// Return the lib version
	KnNav.VERSION;
	```

* Options

	```javascript
	KnNav.init({
		// Elements which trigger the navigation
		elements: ["#nav_brand", "#side_nav a"],
		// Elements to be replaced after each nav
		selectors: ["head title", "#app"],
		// Update browser history after each nav
		history: true,
		// Only keep the last page in the history
		onePageHistory: true,
		// Restore scroll after each nav
		scrollRestoration: true,
		// Bypass the cache by adding a query parameter
		// ?t=1702734628373 (time in ms) at each nav
		cacheBust: true,
		// Ajax timeout in ms
		timeout: 270_000
	});
	```

### License

See the license [here](LICENSE.txt)

```
The MIT License (MIT)

Copyright (c) 2022 - 2023 Florent VIALATTE

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
