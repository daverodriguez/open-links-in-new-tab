var debug = [
	'host',
	'linkText',
	'class',
	'url',
	'ancestor'
];

var allLinks = document.querySelectorAll('a:not([data-olint])');

var processLinks = function(links) {
	for (var nextLink of links) {
		var excluded = false;
		var excludedUrls = [/^#/, /^\/$/, /^mailto:/, /page\/[0-9]+$/i];
		var excludedText = [/^next/i, /^[^a-zA-Z\d]?previous/i, /older/i, /newer/i, /next page$/i, /^next$/i, /sign in/i, /log in/i];
		var excludedAncestors = ['.topbar', '#header', '[role=banner]', 'nav', '[role=navigation]'];
		var excludedClasses = [/toggle/i];
		var linkText = nextLink.innerHTML;

		nextLink.setAttribute('data-olint', '');

		// Exclude links to a different domain
		/*if (nextLink.host !== location.host) {
			excluded = true;
			if (debug && debug.indexOf('host') > -1) {
				nextLink.setAttribute('data-olint-excluded', 'host');
			}
		}*/

		// Exclude all links with no text, because who knows what they are
		/*if (!excluded && linkText === '') {
			excluded = true;
			if (debug && debug.indexOf('linkText') > -1) {
				nextLink.setAttribute('data-olint-excluded', 'linkText');
				nextLink.setAttribute('data-olint-match', 'empty');
			}
		}*/

		// Check and exclude all matching URL patterns
		if (!excluded) {
			if (nextLink.pathname === '/') {
				excluded = true;
				if (debug && debug.indexOf('url') > -1) {
					nextLink.setAttribute('data-olint-excluded', 'url');
					nextLink.setAttribute('data-olint-match', 'site-root');
				}
			}

			for (var nextUrlPattern of excludedUrls) {
				if ( nextUrlPattern.test( nextLink.getAttribute('href') ) ) {
					excluded = true;
					if (debug && debug.indexOf('url') > -1) {
						nextLink.setAttribute('data-olint-excluded', 'url');
						nextLink.setAttribute('data-olint-match', nextUrlPattern);
					}
				}
			}
		}

		// Check and exclude all matching link text patterns
		if (!excluded) {
			for (var nextPattern of excludedText) {
				if (nextPattern.test(linkText)) {
					excluded = true;
					if (debug && debug.indexOf('linkText') > -1) {
						nextLink.setAttribute('data-olint-excluded', 'linkText');
						nextLink.setAttribute('data-olint-match', nextPattern);
					}
				}
			}
		}

		// Check and exclude all matching link classes
		if (!excluded) {
			for (var nextClass of excludedClasses) {
				if (nextClass.test(nextLink.className)) {
					excluded = true;
					if (debug && debug.indexOf('clas') > -1) {
						nextLink.setAttribute('data-olint-excluded', 'class');
						nextLink.setAttribute('data-olint-match', nextClass);
					}
				}
			}
		}

		// Check and exclude based on ancestors: this might be things like main navigation links or links
		// in the site header
		if (!excluded) {
			for (var nextAncestor of excludedAncestors) {
				if (nextLink.closest(nextAncestor)) {
					excluded = true;
					if (debug && debug.indexOf('ancestor') > -1) {
						nextLink.setAttribute('data-olint-excluded', 'ancestor');
						nextLink.setAttribute('data-olint-match', nextAncestor);
					}
				}
			}
		}

		// If we haven't excluded it yet, add target="_blank" so it opens in a new tab
		if (!excluded) {
			nextLink.addEventListener('click', function(e) {
				e.preventDefault();
				chrome.runtime.sendMessage( { message:'openTab', url: e.target.href } );
			});
		}
	}
}

// Check to see if the plugin is enabled for this domain
chrome.storage.sync.get(function(settings) {
	var enabledDomains = settings.enabledDomains || [];
	var domainExists = enabledDomains.indexOf(location.host) > -1;

	if (domainExists) {
		processLinks(allLinks);

		// Listen for links that are added after the page loads
		var observer = new MutationObserver(function(mutations) {
			for (var mutation of mutations) {
				if (mutation.addedNodes) {
					for (nextNode of mutation.addedNodes) {
						if (nextNode.nodeType === Node.ELEMENT_NODE) {
							var nodeLinks = nextNode.querySelectorAll('a:not([data-olint])');
							if (nodeLinks.length) {
								//console.log('Added links:');
								//console.log(nodeLinks);
								processLinks(nodeLinks);
							}
						}
					}
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}
});