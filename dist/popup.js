document.addEventListener('DOMContentLoaded', function() {
	var manifest = chrome.runtime.getManifest();
	document.querySelector('#version').innerHTML = 'version ' + manifest.version;

	var currentDomain;

	var setIcon = function(domainEnabled) {
		if (domainEnabled) {
			document.querySelector('#enabled').setAttribute('checked', true);
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

	var setStateLabel = function(checked) {
		document.querySelector('#state').innerHTML = checked ? 'Enabled' : 'Enable';
	};

	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		var tab = tabs[0];

		currentUrl = new URL(tab.url);
		currentDomain = currentUrl.host;
		document.querySelector('#domain').innerHTML = currentDomain;

		chrome.storage.sync.get(function(settings) {
			var enabledDomains = settings.enabledDomains || [];
			var domainExists = enabledDomains.indexOf(currentDomain) > -1;
			setIcon(domainExists);
			setStateLabel(domainExists);
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
			setStateLabel(checked);

			chrome.tabs.query({active: true, currentWindow: true}, function(tab) {
				chrome.tabs.reload(tab.tabId);
			});
		});

	});
});