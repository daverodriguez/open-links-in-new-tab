document.addEventListener('DOMContentLoaded', function() {
	var currentDomain;

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

	chrome.tabs.getSelected(null, function(tab) {
		updateIcon(tab);
	});

	chrome.tabs.onActivated.addListener(function(active) {
		chrome.tabs.get(active.tabId, function(tab) {
			updateIcon(tab);
		})
	});
});