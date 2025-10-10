/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

const SUPPORT_URL = "https://www.proginosko.com/leechblock/support/";

// Initialize page
//
function initializePage() {
	browser.storage.local.get("sync").then(onGotSync);

	function onGotSync(options) {
		if (options["sync"]) {
			browser.storage.sync.get("theme").then(onGot);
		} else {
			browser.storage.local.get("theme").then(onGot);
		}
	}

	function onGot(options) {
		let theme = options["theme"];
		let link = document.getElementById("themeLink");
		if (link) {
			link.href = "/themes/" + (theme ? `${theme}.css` : "default.css");
		}
	}
	
	// Check focus status
	checkFocusStatus();
}

// Check focus status
function checkFocusStatus() {
	const aiActiveLockdownStatus = document.getElementById("aiActiveLockdownStatus");
	const timerCounter = document.getElementById("timer-counter");
	const timerText = document.getElementById("timer-text");
	const timerCountdown = document.getElementById("timer-countdown");
	const aiFocusPlanner = document.getElementById("ai-focus-planner");
	
	if (!aiActiveLockdownStatus) return;
	
	browser.storage.local.get(
		["aiLockdownActive", "aiLockdownEndTime", "aiLockdownGoal"],
		(data) => {
			if (
				data.aiLockdownActive &&
				data.aiLockdownEndTime > Date.now()
			) {
				const timeLeftMs = data.aiLockdownEndTime - Date.now();
				const totalSeconds = Math.floor(timeLeftMs / 1000);
				const minutes = Math.floor(totalSeconds / 60);
				const seconds = totalSeconds % 60;
				
				// Format as MM:SS
				const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
				
				aiActiveLockdownStatus.innerHTML = `<strong>🎯 Active Focus Session:</strong> ${data.aiLockdownGoal}<br><em>About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} remaining.</em>`;
				
				// Show timer counter at top
				if (timerCounter && timerText && timerCountdown) {
					timerText.textContent = `session started.`;
					timerCountdown.textContent = timeString;
					timerCounter.style.display = "flex";
				}
				
				// Hide AI focus planner
				if (aiFocusPlanner) {
					aiFocusPlanner.style.display = "none";
				}
			} else {
				aiActiveLockdownStatus.textContent = "No active focus session.";
				
				// Hide timer counter
				if (timerCounter) {
					timerCounter.style.display = "none";
				}
				
				// Show AI focus planner
				if (aiFocusPlanner) {
					aiFocusPlanner.style.display = "block";
				}
			}
		}
	);
}

// Start AI session
function startAISession() {
	const userPlanInput = document.getElementById("aiUserPlan");
	const durationInput = document.getElementById("aiDuration");
	const durationUnitSelect = document.getElementById("aiDurationUnit");
	const aiPlannerStatus = document.getElementById("aiPlannerStatus");
	const timerCounter = document.getElementById("timer-counter");
	const timerText = document.getElementById("timer-text");
	
	if (!userPlanInput || !durationInput || !durationUnitSelect) {
		console.error("Required inputs not found!");
		return;
	}
	
	const userGoal = userPlanInput.value.trim();
	const durationValue = parseInt(durationInput.value, 10);
	const durationUnit = durationUnitSelect.value;
	
	// Convert to minutes
	let durationMinutes = durationValue;
	if (durationUnit === "hours") {
		durationMinutes = durationValue * 60;
	}

	// Validation
	if (!userGoal) {
		alert("Please enter what you want to focus on (e.g., 'coding my project').");
		userPlanInput.focus();
		return;
	}

	if (!durationValue || durationValue < 1) {
		alert("Please enter a valid duration (at least 1 minute).");
		durationInput.focus();
		return;
	}

	if (durationMinutes > 480) { // Max 8 hours
		alert("Maximum focus session is 8 hours. Please enter a shorter duration.");
		durationInput.focus();
		return;
	}

	if (aiPlannerStatus) {
		aiPlannerStatus.textContent = "Generating your focus plan...";
		aiPlannerStatus.style.display = "block";
	}
	
	const button = document.getElementById("aiSetPlanButton");
	button.disabled = true;

	browser.runtime.sendMessage(
		{ 
			type: "startAiLockdown", 
			goal: userGoal, 
			duration: durationMinutes 
		},
		(response) => {
			if (browser.runtime.lastError) {
				console.error("Runtime error:", browser.runtime.lastError);
				if (aiPlannerStatus) {
					aiPlannerStatus.textContent = `Error: ${browser.runtime.lastError.message}`;
				}
				button.disabled = false;
				return;
			}
			
			if (response && response.success) {
				if (aiPlannerStatus) {
					const formattedDuration = durationUnit === "hours" 
						? `${durationValue} ${durationValue === 1 ? 'hour' : 'hours'}`
						: `${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'}`;
					
					aiPlannerStatus.textContent = `Focus session started for ${formattedDuration}! Get to work!`;
				}
				
				// Show timer counter at top
				if (timerCounter && timerText && timerCountdown) {
					timerText.textContent = `session started.`;
					timerCountdown.textContent = `${durationMinutes.toString().padStart(2, '0')}:00`;
					timerCounter.style.display = "flex";
				}
				
				// Hide AI focus planner
				const aiFocusPlanner = document.getElementById("ai-focus-planner");
				if (aiFocusPlanner) {
					aiFocusPlanner.style.display = "none";
				}
				
				// Start checking status
				checkFocusStatus();
				
				setTimeout(() => window.close(), 2000);
			} else {
				if (aiPlannerStatus) {
					aiPlannerStatus.textContent = `Error: ${
						response ? response.error : "No response from background script"
					}`;
				}
			}
			button.disabled = false;
		}
	);
}

// Set up periodic status checking
setInterval(checkFocusStatus, 10000);

// Open settings page
function openSettings() {
	openExtensionPage("application-settings.html");
}

// Open stats page
function openStats() {
	openExtensionPage("stats.html");
}

// Open extension page (either create new tab or activate existing tab)
function openExtensionPage(url) {
	let fullURL = browser.runtime.getURL(url);

	browser.tabs.query({ url: fullURL }).then(onGot, onError);

	function onGot(tabs) {
		if (tabs.length > 0) {
			browser.tabs.update(tabs[0].id, { active: true });
		} else {
			browser.tabs.create({ url: fullURL });
		}
		window.close();
	}

	function onError(error) {
		browser.tabs.create({ url: fullURL });
		window.close();
	}
}

// Show AI focus planner
function showAIFocusPlanner() {
	const aiFocusPlanner = document.getElementById("ai-focus-planner");
	const timerCounter = document.getElementById("timer-counter");
	
	if (aiFocusPlanner) {
		aiFocusPlanner.style.display = "block";
	}
	if (timerCounter) {
		timerCounter.style.display = "none";
	}
}

// Event listeners
document.querySelector("#settings").addEventListener("click", openSettings);
document.querySelector("#stats").addEventListener("click", openStats);

// AI event listener
document.querySelector("#aiSetPlanButton").addEventListener("click", startAISession);

// Create session button listener
document.querySelector("#create-session-btn").addEventListener("click", showAIFocusPlanner);

document.addEventListener("DOMContentLoaded", initializePage);
