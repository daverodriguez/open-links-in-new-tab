// Exclusions are now loaded at plugin runtime from exclusions.json
var processLinks = function(links, exclusions) {
	var excludedUrls = exclusions.urls;
	var excludedAncestors = exclusions.ancestors;
	var excludedClasses = exclusions.classes;
	var excludedText = exclusions.text;

	for (var nextLink of links) {
		var excluded = false;
		var isEmpty = false;
		var softExcluded = false;   // "Soft-excluded" links already have a target attribute. Don't wire up a
									// click handler, but still add the icon
		var linkText = nextLink.text.trim().toLowerCase();

		nextLink.setAttribute('data-olint', '');

		if (!excluded && linkText === '') {
			nextLink.setAttribute('data-olint-empty', '');
			isEmpty = true;
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
				nextUrlPattern = new RegExp(nextUrlPattern);
				if ( nextUrlPattern.test(nextLink.getAttribute('href'), 'i') ) {
					excluded = true;
					nextLink.setAttribute('data-olint-excluded', 'url');
					nextLink.setAttribute('data-olint-match', nextUrlPattern);
				}
			}
		}

		// Check and exclude all matching link text patterns
		if (!excluded) {
			for (var nextPattern of excludedText) {
				nextPattern = new RegExp(nextPattern);
				if (nextPattern.test(linkText, 'i')) {
					excluded = true;
					nextLink.setAttribute('data-olint-excluded', 'linkText');
					nextLink.setAttribute('data-olint-match', nextPattern);
				}
			}
		}

		// Check and exclude all matching link classes
		if (!excluded) {
			for (var nextClass of excludedClasses) {
				nextClass = new RegExp(nextClass);
				if (nextClass.test(nextLink.className, 'i')) {
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
				var nextNodeExcluded = false;

				if (nextNode.parentNode.nodeName.toLowerCase() === 'noscript') {
					nextNodeExcluded = true;
				}

				if (!longestNode || nextNode.length > longestNode.length || !nextNodeExcluded) {
					longestNode = nextNode;
				}
			}

			// If there's still no longest node, maybe this is an image
			var isImageNode = false;

			if (!longestNode || longestNode.nodeValue.trim() === '') {
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
				if (longestNode.nextSibling) {
					longestNode.parentNode.insertBefore(olintMarker, longestNode.nextSibling);
				} else {
					longestNode.parentNode.appendChild(olintMarker);
				}

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

		var offsetParent = null;

		if (nextLink.style.display === 'block') {
			offsetParent = nextLink;
		} else {
			var nextNode = nextLink;
			while (!offsetParent) {
				if (nextNode.parentNode) {
					nextNode = nextNode.parentNode;
					if (nextNode === document) {
						// Too far, fall back to the original link
						offsetParent = nextLink;
					} else if (nextNode.style.display === 'block') {
						offsetParent = nextNode;
					}
				} else {
					offsetParent = nextNode;
				}
			}
		}

		if (isImageNode || isEmpty) {
			offsetParent.style.display = 'relative';
		}

		// Check to see if the offset parent is hidden
		if (!excluded) {
			if (nextLink.style.display == 'none' || nextLink.style.visibility == 'hidden' || nextLink.style.opacity === 0 ||
				offsetParent.style.display == 'none' || offsetParent.style.visibility == 'hidden' || offsetParent.style.opacity === 0) {
				excluded = true;
				nextLink.setAttribute('data-olint-excluded', 'hidden');
			}
		}

		// If we haven't excluded it yet, add the click handler so it opens in a new tab
		if (!excluded) {
			// Add click handler
			nextLink.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopImmediatePropagation();
				var link = e.target.closest('[data-olint]');

				chrome.runtime.sendMessage( { message: 'openTab', url: link.href } );
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
			// Get the list of exclusions. Later we might merge in some excluded patterns from the user's
			// synced settings here
			chrome.runtime.sendMessage( { message: 'getExclusions', domain: location.host }, function(exclusions) {
				var allLinks = document.querySelectorAll('a:not([data-olint])');
				processLinks(allLinks, exclusions);
			});

			// Listen for links that are added after the page loads
			var observer = new MutationObserver(function(mutations) {
				for (var mutation of mutations) {
					if (mutation.addedNodes) {
						for (nextNode of mutation.addedNodes) {
							if (nextNode.nodeType === Node.ELEMENT_NODE) {
								let nodeLinks = nextNode.querySelectorAll('a:not([data-olint])');
								if (nodeLinks.length) {
									chrome.runtime.sendMessage( { message: 'getExclusions', domain: location.host }, function(exclusions) {
										processLinks(nodeLinks, exclusions);
									});
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