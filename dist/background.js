document.addEventListener('DOMContentLoaded', function() {
	var currentDomain;
	var lastOpenedTab;

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

	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		var tab = tabs[0];
		updateIcon(tab);
	});

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
		}
	});

	// Add context menu items
	chrome.contextMenus.create({
		type: chrome.contextMenus.ItemType.NORMAL,
		title: 'Open in this tab',
		contexts: [chrome.contextMenus.ContextType.LINK],
		onclick: function(context) {
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
				var tab = tabs[0];
				chrome.tabs.update(tab.id, {url: context.linkUrl} );
			});
		}
	});
});