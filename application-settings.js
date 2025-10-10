/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

// Initialize page
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
}

// Load settings from storage
function loadSettings() {
    browser.storage.local.get([
        "isAiEnabled",
        "apiKey", 
        "aiBlockSet",
        "theme",
        "matchSubdomains",
        "contextMenu",
        "timerVisible",
        "timerSize",
        "timerLocation",
        "timerBadge",
        "overrideMins",
        "overrideAccess",
        "overrideCode",
        "overridePassword"
    ]).then(onGot, onError);

    function onGot(items) {
        // Set AI settings
        document.getElementById("isAiEnabled").checked = items["isAiEnabled"] !== false;
        document.getElementById("apiKey").value = items["apiKey"] || "";
        document.getElementById("aiBlockSet").value = items["aiBlockSet"] || 1;

        // Set general settings
        document.getElementById("theme").value = items["theme"] || "";
        document.getElementById("matchSubdomains").checked = items["matchSubdomains"] || false;
        document.getElementById("contextMenu").checked = items["contextMenu"] || false;

        // Set timer settings
        document.getElementById("timerVisible").checked = items["timerVisible"] || false;
        document.getElementById("timerSize").value = items["timerSize"] || 0;
        document.getElementById("timerLocation").value = items["timerLocation"] || 0;
        document.getElementById("timerBadge").checked = items["timerBadge"] || false;

        // Set override settings
        document.getElementById("overrideMins").value = items["overrideMins"] || "";
        document.getElementById("overrideAccess").value = items["overrideAccess"] || 0;
        document.getElementById("overrideCode").value = items["overrideCode"] || "";
        document.getElementById("overridePassword").value = items["overridePassword"] || "";
    }

    function onError(error) {
        showAlert("alertRetrieveError");
    }
}

// Save settings to storage
function saveSettings() {
    let settings = {
        isAiEnabled: document.getElementById("isAiEnabled").checked,
        apiKey: document.getElementById("apiKey").value,
        aiBlockSet: parseInt(document.getElementById("aiBlockSet").value),
        theme: document.getElementById("theme").value,
        matchSubdomains: document.getElementById("matchSubdomains").checked,
        contextMenu: document.getElementById("contextMenu").checked,
        timerVisible: document.getElementById("timerVisible").checked,
        timerSize: parseInt(document.getElementById("timerSize").value),
        timerLocation: parseInt(document.getElementById("timerLocation").value),
        timerBadge: document.getElementById("timerBadge").checked,
        overrideMins: document.getElementById("overrideMins").value,
        overrideAccess: parseInt(document.getElementById("overrideAccess").value),
        overrideCode: document.getElementById("overrideCode").value,
        overridePassword: document.getElementById("overridePassword").value
    };

    browser.storage.local.set(settings).then(onSaved, onError);

    function onSaved() {
        showAlert("alertSaveSuccess");
        
        // Update theme immediately
        let link = document.getElementById("themeLink");
        if (link) {
            link.href = "/themes/" + (settings.theme ? `${settings.theme}.css` : "default.css");
        }
    }

    function onError(error) {
        showAlert("alertSaveError");
    }
}

// Save settings and close
function saveSettingsAndClose() {
    saveSettings();
    setTimeout(() => {
        window.close();
    }, 1000);
}

// Show alert
function showAlert(alertId) {
    let alert = document.getElementById(alertId);
    if (alert) {
        alert.style.display = "block";
        setTimeout(() => {
            alert.style.display = "none";
        }, 3000);
    }
}

// Event listeners
document.getElementById("saveSettings").addEventListener("click", saveSettings);
document.getElementById("saveSettingsClose").addEventListener("click", saveSettingsAndClose);

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    initializePage();
    loadSettings();
});
