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

	chrome.tabs.getSelected(null, function(tab) {
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

			setIcon(checked);

			chrome.storage.sync.set({
				enabledDomains: enabledDomains
			});
		});

	});
});