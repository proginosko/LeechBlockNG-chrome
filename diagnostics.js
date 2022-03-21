/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

function log(message) { console.log("[LBNG] " + message); }
function warn(message) { console.warn("[LBNG] " + message); }

var gOptions;

// Initialize form
//
function initForm() {
	//log("initForm");

	// Set up JQuery UI widgets
	$("#testURL").button();
	$("#testURL").click(testURL);
	$("#url").keydown(
		function (event) {
			if (event.which == 13) {
				testURL();
			}
		}
	);

	// Clear text fields
	$("#url").val("");
	$("#results").val("");
}

// Initialize page
//
function initializePage() {
	//log("initializePage");

	browser.storage.local.get("sync", onGotSync);

	function onGotSync(options) {
		if (browser.runtime.lastError) {
			warn("Cannot get options: " + browser.runtime.lastError.message);
			$("#alertRetrieveError").dialog("open");
			return;
		}

		if (options["sync"]) {
			browser.storage.sync.get(onGot);
		} else {
			browser.storage.local.get(onGot);
		}
	}

	function onGot(options) {
		if (browser.runtime.lastError) {
			warn("Cannot get options: " + browser.runtime.lastError.message);
			$("#alertRetrieveError").dialog("open");
			return;
		}

		gOptions = options;

		cleanOptions(gOptions);

		// Initialize form
		initForm();

		setTheme(gOptions["theme"]);

		$("#form").show();
	}
}

// Test URL
//
function testURL() {
	if (!gOptions) return;

	let url = $("#url").val();

	// Check URL format
	if (!getParsedURL(url).page) {
		$("#alertBadTestURL").dialog("open");
		return;
	}

	// Generate results for regexp matches
	let results = "";
	let numSets = gOptions["numSets"];
	for (let set = 1; set <= numSets; set++) {
		// Add header
		let setName = gOptions[`setName${set}`];
		let header = setName
			? `====== Block Set ${set} (${setName})\n`
			: `====== Block Set ${set}\n`;
		results += header;

		// Add result for block
		let blockRE = gOptions[`regexpBlock${set}`] || gOptions[`blockRE${set}`];
		if (blockRE) {
			let res = new RegExp(blockRE, "i").exec(url);
			if (res) {
				results += `BLOCK: ${res[0]}\n`;
			} else {
				results += "BLOCK: -\n";
			}
		}

		// Add result for allow
		let allowRE = gOptions[`regexpAllow${set}`] || gOptions[`allowRE${set}`];
		if (allowRE) {
			let res = new RegExp(allowRE, "i").exec(url);
			if (res) {
				results += `ALLOW: ${res[0]}\n`;
			} else {
				results += "ALLOW: -\n";
			}
		}

		// Add result for refer
		let referRE = gOptions[`referRE${set}`];
		if (referRE) {
			let res = new RegExp(referRE, "i").exec(url);
			if (res) {
				results += `REFER: ${res[0]}\n`;
			} else {
				results += "REFER: -\n";
			}
		}

		results += "\n";
	}

	$("#results").val(results);
	$("#results").effect({ effect: "highlight" });
}

/*** STARTUP CODE BEGINS HERE ***/

// Initialize alert dialogs
$("div[id^='alert']").dialog({
	autoOpen: false,
	modal: true,
	width: 500,
	buttons: {
		OK: function () { $(this).dialog("close"); }
	}
});

document.addEventListener("DOMContentLoaded", initializePage);
