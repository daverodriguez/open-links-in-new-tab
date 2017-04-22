var currentDomain;
var lastOpenedTab;
var exclusions;
var globalExclusions;
var personalExclusions;
var exclusionCategories = ['urls', 'text', 'ancestors', 'classes'];

// Load exclusion list
fetch('/data/exclusions.json').then(function(response) {
	response.json().then(function(json) {
		exclusions = globalExclusions = json;
		reloadPersonalExclusions();
	});
});

// Load personal exclusions and merge them with the global set
var reloadPersonalExclusions = function() {
	chrome.storage.sync.get(function(settings) {
		exclusions = globalExclusions;
		personalExclusions = settings.exclusions || {};

		// The object we receive will be an array of domains, each with one or more categories of exclusions inside
		for (let nextDomain in personalExclusions) {
			let nextDomainExclusions = personalExclusions[nextDomain];

			// If our global exclusions object doesn't have a key for a domain, add it
			if (!exclusions.hasOwnProperty(nextDomain)) {
				exclusions[nextDomain] = {};
			}

			// Now loop the global exclusion categories (urls, text, ancestors, etc...)
			for (let nextCategory of exclusionCategories) {

				// If the current personal exclusion domain has an entry for this category...
				if (nextDomainExclusions.hasOwnProperty(nextCategory)) {

					// If the global exclusions object doesn't have a key for this domain and category, add it
					if (!exclusions[nextDomain].hasOwnProperty(nextCategory)) {
						exclusions[nextDomain][nextCategory] = [];
					}

					// Converting to a set removes duplicates
					let nextSet = new Set( exclusions[nextDomain][nextCategory].concat( nextDomainExclusions[nextCategory] ) );

					// Use the spread operator to convert Set back to an array
					exclusions[nextDomain][nextCategory] = [...nextSet ];
				}
			}
		}

		//console.log(exclusions);
	});
}

var getExclusions = function(domain = null) {
	var exc = exclusions.all;

	if (domain && exclusions.hasOwnProperty(domain)) {
		var domainExclusions = exclusions[domain];

		for (var nextCategory of exclusionCategories) {
			if (domainExclusions.hasOwnProperty(nextCategory)) {
				// Converting to a set removes duplicates
				let nextSet = new Set( exc[nextCategory].concat( domainExclusions[nextCategory] ) );

				// Use the spread operator to convert Set back to an array
				exc[nextCategory] = [...nextSet ];
			}
		}
	}

	return exc;
};

var setIcon = function(domainEnabled) {
	if (domainEnabled) {
		chrome.browserAction.setIcon({
			path: {
				16: 'img/icon-enabled.png',
				32: 'img/icon-enabled-32.png',
				64: 'img/icon-enabled-64.png'
			}
		});
	} else {
		chrome.browserAction.setIcon({
			path: {
				16: 'img/icon-disabled.png',
				32: 'img/icon-disabled-32.png',
				64: 'img/icon-disabled-64.png'
			}
		});
	}
};

var updateIcon = function(tab) {
	currentUrl = new URL(tab.url);
	currentDomain = currentUrl.host;

	chrome.storage.sync.get(function(settings) {
		var enabledDomains = settings.enabledDomains || [];
		var domainExists = enabledDomains.indexOf(currentDomain) > -1;
		setIcon(domainExists);
	});
};

chrome.tabs.onActivated.addListener(function(tab) {
	lastOpenedTab = null;

	chrome.tabs.get(tab.tabId, function(tab) {
		updateIcon(tab);
	});
});

chrome.tabs.onUpdated.addListener(function(id, change, tab) {
	updateIcon(tab);
});

chrome.tabs.onRemoved.addListener(function(tab) {
	lastOpenedTab = null;
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.message && request.message === 'openTab' && request.url) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			var activeTabIndex = 0;

			if (tabs.length) {
				activeTabIndex = tabs[0].index;
			}

			var tabOptions = {
				url: request.url,
				active: false
			};

			if (lastOpenedTab) {
				tabOptions.index = lastOpenedTab.index + 1;
			} else {
				tabOptions.index = activeTabIndex + 1;
			}

			chrome.tabs.create(tabOptions, function(tab) {
				lastOpenedTab = tab;
			});
		});
	} else if (request.message && request.message === 'getExclusions') {
		sendResponse( getExclusions(request.domain || null) );
	} else if (request.message && request.message === 'updateExclusions') {
		reloadPersonalExclusions();
		chrome.tabs.query({active: true, currentWindow: true}, function(tab) {
			chrome.tabs.reload(tab.tabId);
		});
	}
});

// Add context menu items
chrome.contextMenus.create({
	type: chrome.contextMenus.ItemType.NORMAL,
	title: 'Open in this tab',
	contexts: [chrome.contextMenus.ContextType.LINK],
	documentUrlPatterns: ['http://*/*', 'https://*/*'],
	onclick: function(context) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			var tab = tabs[0];
			chrome.tabs.update(tab.id, {url: context.linkUrl} );
		});
	}
});

chrome.contextMenus.create({
	type: chrome.contextMenus.ItemType.NORMAL,
	title: 'Exclude this link',
	documentUrlPatterns: ['http://*/*', 'https://*/*'],
	contexts: [chrome.contextMenus.ContextType.LINK],
	onclick: function(context) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			var tab = tabs[0];
			chrome.tabs.sendMessage(tab.id, {message:'excludeLastLink'});
		});

	}
});