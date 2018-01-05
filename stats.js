/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

function log(message) { console.log("[LBNG] " + message); }
function warn(message) { console.warn("[LBNG] " + message); }

function getElement(id) { return document.getElementById(id); }

// Refresh table of statistics
//
function statsRefresh() {
	//log("statsRefresh");

	browser.storage.local.get(onGot);

	function onGot(options) {
		if (browser.runtime.lastError) {
			warn("Cannot get options: " + error);
			return;
		}

		// Get current time in seconds
		let now = Math.floor(Date.now() / 1000);

		for (let set = 1; set <= NUM_SETS; set++) {
			let setName = options[`setName${set}`];
			let timedata = options[`timedata${set}`];
			let limitMins = options[`limitMins${set}`];
			let limitPeriod = options[`limitPeriod${set}`];
			let periodStart = getTimePeriodStart(now, limitPeriod);

			if (setName) {
				getElement(`blockSetName${set}`).innerText = setName;
			}

			if (Array.isArray(timedata) && timedata.length == 5) {
				let fs = getFormattedStats(timedata);
				getElement(`startTime${set}`).innerText = fs.startTime;
				getElement(`totalTime${set}`).innerText = fs.totalTime;
				getElement(`perWeekTime${set}`).innerText = fs.perWeekTime;
				getElement(`perDayTime${set}`).innerText = fs.perDayTime;

				if (limitMins && limitPeriod) {
					// Calculate total seconds left in this time period
					let secsLeft = (timedata[2] == periodStart)
							? Math.max(0, (limitMins * 60) - timedata[3])
							: (limitMins * 60);
					let timeLeft = formatTime(secsLeft);
					getElement(`timeLeft${set}`).innerText = timeLeft;
				}
			}
		}

		$("#form").show();
	}
}

// Return formatted times based on time data
//
function getFormattedStats(timedata) {
	let days = 1
			+ Math.floor(Date.now() / 86400000)
			- Math.floor(timedata[0] / 86400);
	let weeks = Math.floor((days + 6) / 7);
	return {
		startTime: new Date(timedata[0] * 1000).toLocaleString(),
		totalTime: formatTime(timedata[1]),
		perWeekTime: formatTime(timedata[1] / weeks),
		perDayTime: formatTime(timedata[1] / days)
	};
}

// Handle button click
//
function handleClick(e) {
	let id = e.target.id;

	if (id == "restartAll") {
		// Request restart time data for all sets
		let message = { type: "restart", set: 0 };
		browser.runtime.sendMessage(message, statsRefresh);
	} else if (/restart\d+/.test(id)) {
		// Request restart time data for specific set
		let message = { type: "restart", set: +id.substr(7) };
		browser.runtime.sendMessage(message, statsRefresh);
	}
}

/*** STARTUP CODE BEGINS HERE ***/

// Use HTML for first row to create other rows
let rowHTML = $("#statsRow1").html();
for (let set = 2; set <= NUM_SETS; set++) {
	let nextRowHTML = rowHTML
			.replace(/Block Set 1/g, `Block Set ${set}`)
			.replace(/id="(\w+)1"/g, `id="$1${set}"`);
	$("#statsTable").append(`<tr id="statsRow${set}">${nextRowHTML}</tr>`);
}

$(":button").click(handleClick);

window.addEventListener("DOMContentLoaded", statsRefresh);
window.addEventListener("focus", statsRefresh);
