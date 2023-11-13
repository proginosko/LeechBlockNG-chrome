/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

var gTickerID;
var gTickerSecs = 1; // update every second by default

gTickerID = window.setInterval(onInterval, gTickerSecs * 1000);

browser.runtime.onMessage.addListener(handleMessage);

/*** EVENT HANDLERS BEGIN HERE ***/

function handleMessage(message, sender, sendResponse) {

	switch (message.type) {

		case "ticker":
			// Only restart ticker if interval has changed
			if (message.tickerSecs != gTickerSecs) {
				gTickerSecs = message.tickerSecs;
				window.clearInterval(gTickerID);
				gTickerID = window.setInterval(onInterval, gTickerSecs * 1000);
			}
			break;

	}

}

function onInterval() {
	browser.runtime.sendMessage({ type: "tick" });
}
