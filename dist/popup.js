document.addEventListener('DOMContentLoaded', function() {
	var currentDomain;

	var setIcon = function(domainEnabled) {
		if (domainEnabled) {
			document.querySelector('#enabled').setAttribute('checked', true);
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

	chrome.tabs.query({active: true}, function(tabs) {
		var tab = tabs[0];

		currentUrl = new URL(tab.url);
		currentDomain = currentUrl.host;
		document.querySelector('#domain').innerHTML = currentDomain;

		chrome.storage.sync.get(function(settings) {
			var enabledDomains = settings.enabledDomains || [];
			var domainExists = enabledDomains.indexOf(currentDomain) > -1;
			setIcon(domainExists);
		});
	});

	document.querySelector('#enabled').addEventListener('change', function() {
		var checked = this.checked;

		chrome.storage.sync.get(function(settings) {

			var enabledDomains = settings.enabledDomains || [];
			var domainExists = enabledDomains.indexOf(currentDomain) > -1;

			// If checkbox is unchecked and this domain exists in storage, remove it
			if (!checked && domainExists) {
				enabledDomains.splice( enabledDomains.indexOf(currentDomain) );
			// If the checkbox is checked and the domain *doesn't* exist, add it
			} else if (checked && !domainExists) {
				enabledDomains.push(currentDomain);
			}

			chrome.storage.sync.set({
				enabledDomains: enabledDomains
			});

			setIcon(checked);

			chrome.tabs.query({active: true}, function(tab) {
				chrome.tabs.reload(tab.tabId);
			});
		});

	});
});