/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

function log(message) { console.log("[LBNG] " + message); }
function warn(message) { console.warn("[LBNG] " + message); }

function getElement(id) { return document.getElementById(id); }

var gStorage = browser.storage.local;

var gFormHTML;
var gNumSets;

// Initialize form (with specified number of block sets)
//
function initForm(numSets) {
	//log("initForm: " + numSets);

	// Reset form to original HTML
	$("#form").html(gFormHTML);

	gNumSets = +numSets;

	// Use HTML for first check box to create other check boxes
	let blockSetHTML = $("#blockSets").html();
	for (let set = 2; set <= gNumSets; set++) {
		let nextSetHTML = blockSetHTML
				.replace(/(Block Set) 1/g, `$1 ${set}`)
				.replace(/(id|for)="(\w+)1"/g, `$1="$2${set}"`);
		$("#blockSets").append(nextSetHTML);
	}

	// Set up JQuery UI widgets
	$("#activate").button();
	$("#activate").click(onActivate);
	$("#cancel").button();
	$("#cancel").click(onCancel);
}

// Refresh page
//
function refreshPage() {
	//log("refreshPage");

	$("#form").hide();

	browser.storage.local.get("sync", onGotSync);

	function onGotSync(options) {
		if (browser.runtime.lastError) {
			warn("Cannot get options: " + browser.runtime.lastError.message);
			$("#alertRetrieveError").dialog("open");
			return;
		}

		gStorage = options["sync"]
				? browser.storage.sync
				: browser.storage.local;

		gStorage.get(onGot);
	}

	function onGot(options) {
		if (browser.runtime.lastError) {
			warn("Cannot get options: " + browser.runtime.lastError.message);
			$("#alertRetrieveError").dialog("open");
			return;
		}

		cleanOptions(options);

		// Initialize form
		initForm(options["numSets"]);

		setTheme(options["theme"]);

		let lockdownHours = options["lockdownHours"];
		if (lockdownHours > 0) {
			getElement("hours").value = lockdownHours;
		}

		let lockdownMins = options["lockdownMins"];
		if (lockdownMins > 0) {
			getElement("mins").value = lockdownMins;
		}

		let lockdownForever = options["lockdownForever"];
		if (lockdownForever) {
			getElement("forever").checked = lockdownForever;
		}

		for (let set = 1; set <= gNumSets; set++) {
			let lockdown = options[`lockdown${set}`];
			if (lockdown) {
				getElement(`blockSet${set}`).checked = lockdown;
			}

			// Append custom set name to check box label (if specified)
			let setName = options[`setName${set}`];
			if (setName) {
				getElement(`blockSetLabel${set}`).innerText += ` (${setName})`;
			}
		}

		$("#form").show();
	}
}

// Handle activate button click
//
function onActivate() {
	//log("onActivate");

	// Get lockdown duration
	let hours = getElement("hours").value;
	let mins = getElement("mins").value;
	let forever = getElement("forever").checked;
	let duration = hours * 3600 + mins * 60;

	if (!forever && (!duration || duration < 0)) {
		$("#alertNoDuration").dialog("open");
		return;
	}

	// Calculate end time for lockdown	
	let endTime = Math.floor(Date.now() / 1000);
	if ( forever ) {
		endTime += 20 * 365 * 24 * 3600;  // 20 years is pretty much forever right? :-)
	}
	else {
		endTime += duration;
	}

	// Request lockdown for each selected set
	let noneSelected = true;
	for (let set = 1; set <= gNumSets; set++) {
		let selected = getElement(`blockSet${set}`).checked;
		if (selected) {
			noneSelected = false;
			let message = {
				type: "lockdown",
				endTime: endTime,
				set: set
			};
			// Request lockdown for this set
			browser.runtime.sendMessage(message);
		}
	}

	if (noneSelected) {
		$("#alertNoSets").dialog("open");
		return;
	}

	// Save options for next time
	let options = {};
	options["lockdownHours"] = hours;
	options["lockdownMins"] = mins;
	options["lockdownForever"] = forever;
	for (let set = 1; set <= gNumSets; set++) {
		options[`lockdown${set}`] = getElement(`blockSet${set}`).checked;
	}
	gStorage.set(options, function () {
		if (browser.runtime.lastError) {
			warn("Cannot set options: " + browser.runtime.lastError.message);
		}
	});

	// Request tab close
	browser.runtime.sendMessage({ type: "close" });
}

// Handle cancel button click
//
function onCancel() {
	//log("onCancel");

	// Request tab close
	browser.runtime.sendMessage({ type: "close" });
}

/*** STARTUP CODE BEGINS HERE ***/

// Save original HTML of form
gFormHTML = $("#form").html();

// Initialize alert dialogs
$("div[id^='alert']").dialog({
	autoOpen: false,
	modal: true,
	width: 500,
	buttons: {
		OK: function () { $(this).dialog("close"); }
	}
});

window.addEventListener("DOMContentLoaded", refreshPage);
window.addEventListener("focus", refreshPage);
