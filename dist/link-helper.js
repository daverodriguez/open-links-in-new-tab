/**
 * Process all the links on the page that haven't already been marked as excluded (or all the links in the most recently
 * observed mutation set
 * @param links
 * @param exclusions
 */
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

		var offsetParent = null;

		if (nextLink.style.display === 'block' || isImageNode) {
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
			var offsetParentStyle = getComputedStyle(offsetParent);
			if (offsetParentStyle.position === 'static') {
				offsetParent.style.position = 'relative';
			}
		}

		// Check to see if the offset parent is hidden
		if (!excluded) {
			if (nextLink.style.display == 'none' || nextLink.style.visibility == 'hidden' || nextLink.style.opacity === 0 ||
				offsetParent.style.display == 'none' || offsetParent.style.visibility == 'hidden' || offsetParent.style.opacity === 0) {
				excluded = true;
				nextLink.setAttribute('data-olint-excluded', 'hidden');
			}
		}

		if (!excluded) {
			if (nextLink.rel.indexOf('noreferrer') >= 0 || nextLink.rel.indexOf('noopener') >= 0) {
				excluded = true;
				nextLink.setAttribute('data-olint-excluded', 'noreferrer');
			}
		}

		// Soft excluded, last check before adding marker
		if (!excluded && nextLink.target) {
			//excluded = true;
			softExcluded = true;
			nextLink.setAttribute('data-olint-soft-excluded', 'target');
		}

		// Exclusion point -------------------------------->

		// Remove any existing OLINT markers
		var olintMarkers = nextLink.querySelectorAll('.olint-marker');
		for (var n of olintMarkers) {
			n.parentNode.removeChild(n);
		}

		// Add the OLINT marker element
		if (!excluded) {
			// Create an OLINT marker element (green "open in new tab" icon)
			var olintMarker = document.createElement('i');
			olintMarker.className = 'olint-marker';

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

/**
 * Get the most recent list of exclusions and process links. After page load, continue to listen for DOM Mutations
 * that result in new links being added.
 */
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

	// Keep track of the last right clicked link
	window.olintLastRightClickedLink = null;

	window.addEventListener('contextmenu', function(e) {
		window.olintLastRightClickedLink = e.target.closest('[data-olint]');
	});
};

/**
 * Kick off link processing on page load
 */
if (document.fonts.size && document.fonts.size > 0) {
	document.fonts.ready.then(function() {
		init();
	})
} else {
	init();
}

var exclusionCategories = ['urls', 'text', 'ancestors', 'classes'];

/**
 * Attempts to find the most useful exclusion for a particular link
 * @param HTMLLinkELement link
 */
var findExclusions = function(link) {
	var linkText = link.text.trim().toLowerCase();
	var exclusionFound = false;

	var exc = {
		domain: location.host
	};

	if (link.id) {
		exc.ancestors = link.id;
	}

	if (!exclusionFound && link.closest('ul')) {
		var ul = link.closest('ul');
		if (ul.id) {
			exc.ancestors = '#' + ul.id;
			exclusionFound = true;
		} else if (ul.className) {
			//exc.ancestors = '.' + ul.classList.join('.');
			//exclusionFound = true;
		}
	}

	if (!exclusionFound && link.className) {
		exc.classes = '#' . link.className;
		exclusionFound = true;
	}

	if (!exclusionFound && linkText !== '') {
		exc.text = linkText
	}

	// Fallback: exclude by URL
	exc.urls = link.getAttribute('href');

	return exc;
};

/**
 * Listen for messages from the extension requesting the last-clicked link to be excluded or included
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request && request.message === 'excludeLastLink' && window.olintLastRightClickedLink) {
		var l = window.olintLastRightClickedLink;
		var exclusion = findExclusions(l);
		//console.log(exclusion);

		chrome.storage.sync.get(function(settings) {
			var personalExclusions = settings.exclusions || {};
			personalExclusions[exclusion.domain] = personalExclusions[exclusion.domain] || {};

			for (var nextCategory of exclusionCategories) {
				if (exclusion.hasOwnProperty(nextCategory)) {
					let n = personalExclusions[exclusion.domain][nextCategory] || [];

					// Converting to a set removes duplicates
					let nextSet = new Set( n.concat( exclusion[nextCategory] ) );

					// Use the spread operator to convert Set back to an array
					personalExclusions[exclusion.domain][nextCategory] = [...nextSet ];
				}
			}

			settings.exclusions = personalExclusions;
			chrome.storage.sync.set(settings, function(response) {
				chrome.runtime.sendMessage( {message: 'updateExclusions'} );
			});
		});


	}
});
