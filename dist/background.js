document.addEventListener('DOMContentLoaded', function() {
	var currentDomain;
	var lastOpenedTab;

	var setIcon = function(domainEnabled) {
		if (domainEnabled) {
			chrome.browserAction.setIcon({
				path: {
					16: 'icon-enabled.png'
				}
			});
		} else {
			chrome.browserAction.setIcon({
				path: {
					16: 'icon-disabled.png'
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

	chrome.tabs.query({active: true}, function(tabs) {
		var tab = tabs[0];
		updateIcon(tab);
	});

	chrome.tabs.onActivated.addListener(function(tab) {
		chrome.tabs.get(tab.tabId, function(tab) {
			updateIcon(tab);
		});
	});

	chrome.tabs.onRemoved.addListener(function(tab) {
		lastOpenedTab = null;
	});

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request.message && request.message === 'openTab' && request.url) {

			chrome.tabs.query({active: true}, function(tabs) {

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
});