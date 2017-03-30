var excludedUrls = [/^#/, /^\/$/, /^mailto:/, /page\/[0-9]+$/i, /facebook\.com/i, /twitter\.com/i, /rss[2\/]?/i,
					/javascript:/i, /page=/i];
var excludedText = [/^next/i, /^[^a-zA-Z\d]?prev(ious)?/i, /older/i, /newer/i, /next page$/i, /^next$/i,
					/sign in/i, /log in/i, /sign up/i, /^[0-9]+$/, /^<$/, /^>$/, /^more/i, /load more/i,
					/see more/i, /view more/i
];
var excludedAncestors = ['.topbar', '#header', '[role=banner]', 'nav', '[role=navigation]', '.facebook',
	'.twitter', '.pinterest'
];
var excludedClasses = [/toggle/i, /signup/i, /register/i, /dropdown/i, /facebook/i, /twitter/i, /pinterest/i,
						/next/i, /prev(ious)?/i, /enlarge/i, /zoom/i, /social/i, /comment-count/i, /icon/i,
						/play-button/i, /fa-[a-zA-Z]/i, /icon-[a-zA-Z]/i, /pager/i
];

var allLinks = document.querySelectorAll('a:not([data-olint])');

var processLinks = function(links) {
	for (var nextLink of links) {
		var excluded = false;
		var softExcluded = false;   // "Soft-excluded" links already have a target attribute. Don't wire up a
									// click handler, but still add the icon
		var linkText = nextLink.text.trim();

		nextLink.setAttribute('data-olint', '');

		if (!excluded && linkText === '') {
			nextLink.setAttribute('data-olint-empty', '');
		}

		if (!excluded && nextLink.target) {
			//excluded = true;
			softExcluded = true;
			nextLink.setAttribute('data-olint-soft-excluded', 'target');
		}

		/*if (nextLink.getAttribute('rel') && nextLink.getAttribute('rel') === 'nofollow') {
			excluded = true;
			if (debug && debug.indexOf('rel') > -1) {
				nextLink.setAttribute('data-olint-excluded', 'rel');
				nextLink.setAttribute('data-olint-match', 'nofollow');
			}
		}*/

		// Check and exclude all matching URL patterns
		if (!excluded) {
			if (nextLink.host === location.host && nextLink.pathname === '/') {
				excluded = true;
				nextLink.setAttribute('data-olint-excluded', 'url');
				nextLink.setAttribute('data-olint-match', 'site-root');
			}

			for (var nextUrlPattern of excludedUrls) {
				if ( nextUrlPattern.test( nextLink.getAttribute('href') ) ) {
					excluded = true;
					nextLink.setAttribute('data-olint-excluded', 'url');
					nextLink.setAttribute('data-olint-match', nextUrlPattern);
				}
			}
		}

		// Check and exclude all matching link text patterns
		if (!excluded) {
			for (var nextPattern of excludedText) {
				if (nextPattern.test(linkText)) {
					excluded = true;
					nextLink.setAttribute('data-olint-excluded', 'linkText');
					nextLink.setAttribute('data-olint-match', nextPattern);
				}
			}
		}

		// Check and exclude all matching link classes
		if (!excluded) {
			for (var nextClass of excludedClasses) {
				if (nextClass.test(nextLink.className)) {
					excluded = true;
					nextLink.setAttribute('data-olint-excluded', 'class');
					nextLink.setAttribute('data-olint-match', nextClass);
				}
			}
		}

		// Check and exclude based on ancestors: this might be things like main navigation links or links
		// in the site header
		if (!excluded) {
			for (var nextAncestor of excludedAncestors) {
				if (nextLink.closest(nextAncestor)) {
					excluded = true;
					nextLink.setAttribute('data-olint-excluded', 'ancestor');
					nextLink.setAttribute('data-olint-match', nextAncestor);
				}
			}
		}

		// Check and exclude based on link target size
		if (!excluded) {
			var dims = nextLink.getBoundingClientRect();
			var size = dims.width * dims.height;
			if (size < 16) {
				excluded = true;
				nextLink.setAttribute('data-olint-excluded', 'dimensions');
			}
		}

		// Add the OLINT marker element
		if (!excluded) {
			// Create an OLINT marker element (green "open in new tab" icon)
			var olintMarker = document.createElement('i');
			olintMarker.className = 'olint-marker';

			// Find the longest text node inside this link
			var longestNode = null;
			var getTextNodes = document.createTreeWalker(nextLink, NodeFilter.SHOW_TEXT);
			while (getTextNodes.nextNode()) {
				var nextNode = getTextNodes.currentNode;
				if (!longestNode || nextNode.length > longestNode.length) {
					longestNode = nextNode;
				}
			}

			// If there's still no longest node, maybe this is an image
			var isImageNode = false;

			if (!longestNode) {
				var getImageNodes = document.createTreeWalker(nextLink, NodeFilter.SHOW_ELEMENT);
				while (getImageNodes.nextNode()) {
					var nextNode = getImageNodes.currentNode;
					if (nextNode.nodeName.toLowerCase() === 'img') {
						longestNode = nextNode;
						isImageNode = true;
					}
				}
			}

			// Add OLINT marker directly after the longest text node, or if none was found, append it as the last
			// child of the link
			if (longestNode) {
				longestNode.parentNode.insertBefore(olintMarker, longestNode.nextSibling);

				if (isImageNode) {
					nextLink.setAttribute('data-olint-type', 'image');
					var displayType = nextLink.style.display;
					if (displayType == null || displayType === '' || displayType === 'inline') {
						//nextLink.style.display = 'inline-block';
					}
				}
			} else {
				nextLink.appendChild(olintMarker);
			}
		}

		// If we haven't excluded it yet, add the click handler so it opens in a new tab
		if (!excluded) {
			// Add click handler
			nextLink.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
				var link = e.target.closest('[data-olint]');

				chrome.runtime.sendMessage( { message:'openTab', url: link.href } );
			});
		}
	}
};

var init = function() {
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
}

if (document.fonts.size && document.fonts.size > 0) {
	document.fonts.ready.then(function() {
		init();
	})
} else {
	init();
}