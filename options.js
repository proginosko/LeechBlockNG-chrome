/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browser = chrome;

const DEFAULT_OPTIONS_FILE = "LeechBlockOptions.txt";
const DEFAULT_JSON_FILE = "LeechBlockOptions.json";

const SUB_OPTIONS = {
  applyFilter: ["filterName", "filterMute"],
  allowOverride: ["allowOverLock"],
};

function log(message) {
  console.log("[LBNG] " + message);
}
function warn(message) {
  console.warn("[LBNG] " + message);
}

function getElement(id) {
  return document.getElementById(id);
}

function isTrue(str) {
  return /^true$/i.test(str);
}

function escape(str) {
  return str.replace(/\n/g, "\\n");
}
function unescape(str) {
  return str.replace(/\\n/g, "\n");
}

var gIsAndroid = false;
var gAccessConfirmed = false;
var gAccessHashCode;
var gFormHTML;
var gNumSets, gNumSetsMin;
var gSetDisabled;
var gSetOrdering, gSetReordered;
var gTabIndex = 0;
var gNewOpen = true;
var gSimplified = false;
var gClockTimeOpts;

// Initialize form (with specified number of block sets)
//
function initForm(numSets) {
  //log("initForm: " + numSets);

  // Reset form to original HTML
  $("#form").html(gFormHTML);

  gNumSets = +numSets;
  gNumSetsMin = 1;

  // All sets enabled and in order at initialization
  gSetDisabled = [];
  gSetOrdering = [];
  for (let set = 1; set <= gNumSets; set++) {
    gSetDisabled[set] = false;
    gSetOrdering[set] = set;
  }
  gSetReordered = false;

  // Set maximum number of block sets
  $("#maxSets").text(MAX_SETS);

  // Set version text
  $("#version").text(browser.runtime.getManifest().version);

  // Use HTML for first block set to create other block sets
  let tabHTML = $("#tabBlockSet1").html();
  let setHTML = $("#blockSet1").html();
  for (let set = 2; set <= gNumSets; set++) {
    let nextTabHTML = tabHTML
      .replace(/(Block Set) 1/g, `$1 ${set}`)
      .replace(/(id|href)="(#?\w+)1"/g, `$1="$2${set}"`);
    let nextSetHTML = setHTML.replace(/(id|for)="(\w+)1"/g, `$1="$2${set}"`);
    $("#tabGeneral").before(`<li id="tabBlockSet${set}">${nextTabHTML}</li>`);
    $("#paneGeneral").before(`<div id="blockSet${set}">${nextSetHTML}</div>`);
  }

  // Set up JQuery UI widgets
  $("#tabs").tabs({ activate: onActivate });
  for (let set = 1; set <= gNumSets; set++) {
    $(`#moveSetL${set}`).click(function (e) {
      swapSets(set, set - 1);
      $("#tabs").tabs("option", "active", set - 2);
    });
    $(`#moveSetR${set}`).click(function (e) {
      swapSets(set, set + 1);
      $("#tabs").tabs("option", "active", set);
    });
    $(`#simpOpts${set}`).click(function (e) {
      showSimplifiedOptions(true);
    });
    $(`#fullOpts${set}`).click(function (e) {
      showSimplifiedOptions(false);
    });
    $(`#setName${set}`).change(function (e) {
      updateBlockSetName(set, $(`#setName${set}`).val());
    });
    for (let name in SUB_OPTIONS) {
      $(`#${name}${set}`).change(function (e) {
        updateSubOptions(set);
      });
    }
    $(`#allDay${set}`).click(function (e) {
      $(`#times${set}`).val(ALL_DAY_TIMES);
    });
    $(`#blockURL${set}`).change(function (e) {
      updatePasswordPageOptions(set);
    });
    $(`#defaultPage${set}`).click(function (e) {
      $(`#blockURL${set}`).val(DEFAULT_BLOCK_URL);
      updatePasswordPageOptions(set);
    });
    $(`#delayingPage${set}`).click(function (e) {
      $(`#blockURL${set}`).val(DELAYED_BLOCK_URL);
      updatePasswordPageOptions(set);
    });
    $(`#passwordPage${set}`).click(function (e) {
      $(`#blockURL${set}`).val(PASSWORD_BLOCK_URL);
      updatePasswordPageOptions(set);
    });
    $(`#blankPage${set}`).click(function (e) {
      $(`#blockURL${set}`).val("about:blank");
      updatePasswordPageOptions(set);
    });
    $(`#resetOpts${set}`).click(function (e) {
      resetSetOptions(set);
      $("#alertResetOptions").dialog("open");
    });
    $(`#showAdvOpts${set}`).click(function (e) {
      $(`#showAdvOpts${set}`).css("display", "none");
      $(`#advOpts${set}`).css("display", "block");
    });
    $(`#clearRegExpBlock${set}`).click(function (e) {
      $(`#regexpBlock${set}`).val("");
    });
    $(`#genRegExpBlock${set}`).click(function (e) {
      let sites = $(`#sites${set}`).val();
      let matchSubdomains = getElement("matchSubdomains").checked;
      $(`#regexpBlock${set}`).val(getRegExpSites(sites, matchSubdomains).block);
    });
    $(`#clearRegExpAllow${set}`).click(function (e) {
      $(`#regexpAllow${set}`).val("");
    });
    $(`#genRegExpAllow${set}`).click(function (e) {
      let sites = $(`#sites${set}`).val();
      let matchSubdomains = getElement("matchSubdomains").checked;
      $(`#regexpAllow${set}`).val(getRegExpSites(sites, matchSubdomains).allow);
    });
    $(`#cancelLockdown${set}`).click(function (e) {
      browser.runtime.sendMessage({ type: "lockdown", set: set });
      this.disabled = true;
      $("#alertLockdownCancel").dialog("open");
    });
    $(`#advOpts${set}`).css("display", "none");
  }
  $("#simpOptsGen").click(function (e) {
    showSimplifiedOptions(true);
  });
  $("#fullOptsGen").click(function (e) {
    showSimplifiedOptions(false);
  });
  $("#accessPasswordShow").change(accessPasswordShow);
  $("#theme").change(function (e) {
    setTheme($("#theme").val());
  });
  $("#clockOffset").click(showClockOffsetTime);
  $("#clockOffset").keyup(showClockOffsetTime);
  $("#clockOffsetTime").click(showClockOffsetTime);
  $("#exportOptions").click(exportOptions);
  $("#importOptions").click(importOptions);
  $("#exportOptionsJSON").click(exportOptionsJSON);
  $("#exportOptionsSync").click(exportOptionsSync);
  $("#importOptionsSync").click(importOptionsSync);
  $("#openDiagnostics").click(openDiagnostics);
  $("#saveOptions").button();
  $("#saveOptions").click({ closeOptions: false }, saveOptions);
  $("#saveOptionsClose").button();
  $("#saveOptionsClose").click({ closeOptions: true }, saveOptions);

  if (gIsAndroid) {
    // Hide sync options (sync storage not supported on Android yet)
    getElement("syncOpts1").style.display = "none";
    getElement("syncOpts2").style.display = "none";
  }

  // Set active tab
  if (gTabIndex < 0) {
    // -ve index = other tab (General, About)
    let index = Math.max(0, gTabIndex + gNumSets + 2);
    $("#tabs").tabs("option", "active", index);
  } else {
    // +ve index = block set tab
    let index = Math.min(gTabIndex, gNumSets - 1);
    $("#tabs").tabs("option", "active", index);
  }

  function onActivate(event, ui) {
    let index = ui.newTab.index();
    gTabIndex = index < gNumSets ? index : index - gNumSets - 2;
  }
}

// Swap two sets
//
function swapSets(set1, set2) {
  // Keep track of reordering
  let order1 = gSetOrdering[set1];
  let order2 = gSetOrdering[set2];
  gSetOrdering[set1] = order2;
  gSetOrdering[set2] = order1;
  gSetReordered = true;

  // Swap set options and update form
  swapSetOptions(set1, set2);
  updateMoveSetButtons();
  updateBlockSetName(set1, $(`#setName${set1}`).val());
  updateBlockSetName(set2, $(`#setName${set2}`).val());
  $(`#showAdvOpts${set1}`).css("display", "initial");
  $(`#showAdvOpts${set2}`).css("display", "initial");
  $(`#advOpts${set1}`).css("display", "none");
  $(`#advOpts${set2}`).css("display", "none");
}

// Show simplified or full options
//
function showSimplifiedOptions(simplify) {
  if (simplify) {
    // Show simplified options
    $(".simplifiable").css("display", "none");
    $("fieldset[id^='advOpts'").css("display", "none");
    $("button[id^='simpOpts']").hide();
    $("button[id^='fullOpts']").show();
  } else {
    // Show full options
    $(".simplifiable").css("display", "");
    $("button[id^='simpOpts']").show();
    $("button[id^='fullOpts']").hide();
  }

  gSimplified = simplify;
}

// Update block set name on tab
//
function updateBlockSetName(set, name) {
  getElement(`blockSetName${set}`).innerText = name ? name : `Block Set ${set}`;
}

// Update show/hide password page options
//
function updatePasswordPageOptions(set) {
  let show = $(`#blockURL${set}`).val() == PASSWORD_BLOCK_URL;
  $(`#passwordPageOpts${set}`).css("display", show ? "" : "none");
}

// Save options to local storage (returns true if success)
//
function saveOptions(event) {
  //log("saveOptions");

  // Check format for text fields in block sets
  for (let set = 1; set <= gNumSets; set++) {
    // Get field values
    let times = $(`#times${set}`).val();
    let limitMins = $(`#limitMins${set}`).val();
    let limitOffset = $(`#limitOffset${set}`).val();
    let delaySecs = $(`#delaySecs${set}`).val();
    let delayAllowMins = $(`#delayAllowMins${set}`).val();
    let reloadSecs = $(`#reloadSecs${set}`).val();
    let waitSecs = $(`#waitSecs${set}`).val();
    let blockURL = $(`#blockURL${set}`).val();

    // Check field values
    if (!checkTimePeriodsFormat(times)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#times${set}`).focus();
      $("#alertBadTimes").dialog("open");
      return false;
    }
    if (!checkPosNumberFormat(limitMins)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#limitMins${set}`).focus();
      $("#alertBadTimeLimit").dialog("open");
      return false;
    }
    if (!checkPosNegIntFormat(limitOffset)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#limitOffset${set}`).focus();
      $("#alertBadTimeLimitOffset").dialog("open");
      return false;
    }
    if (!delaySecs || !checkPosIntFormat(delaySecs)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#delaySecs${set}`).focus();
      $("#alertBadSeconds").dialog("open");
      return false;
    }
    if (!checkPosIntFormat(delayAllowMins)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#delayAllowMins${set}`).focus();
      $("#alertBadMinutes").dialog("open");
      return false;
    }
    if (!checkPosIntFormat(reloadSecs)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#reloadSecs${set}`).focus();
      $("#alertBadSeconds").dialog("open");
      return false;
    }
    if (!checkPosIntFormat(waitSecs)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#waitSecs${set}`).focus();
      $("#alertBadSeconds").dialog("open");
      return false;
    }
    if (!checkBlockURLFormat(blockURL)) {
      $("#tabs").tabs("option", "active", set - 1);
      $(`#blockURL${set}`).focus();
      $("#alertBadBlockURL").dialog("open");
      return false;
    }
  }

  // Check format for text fields in general options
  let numSets = $("#numSets").val();
  if (!numSets || !checkPosIntFormat(numSets)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#numSets").focus();
    $("#alertBadNumSets").dialog("open");
    return false;
  }
  let accessPreventTimes = $("#accessPreventTimes").val();
  if (!checkTimePeriodsFormat(accessPreventTimes)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#accessPreventTimes").focus();
    $("#alertBadTimes").dialog("open");
    return false;
  }
  let overrideMins = $("#overrideMins").val();
  if (!checkPosIntFormat(overrideMins)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#overrideMins").focus();
    $("#alertBadMinutes").dialog("open");
    return false;
  }
  let overrideLimitNum = $("#overrideLimitNum").val();
  if (!checkPosIntFormat(overrideLimitNum)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#overrideLimitNum").focus();
    $("#alertBadOverrideLimitNum").dialog("open");
    return false;
  }
  let warnSecs = $("#warnSecs").val();
  if (!checkPosIntFormat(warnSecs)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#warnSecs").focus();
    $("#alertBadSeconds").dialog("open");
    return false;
  }
  let saveSecs = $("#saveSecs").val();
  if (!saveSecs || !checkPosIntFormat(saveSecs)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#saveSecs").focus();
    $("#alertBadSeconds").dialog("open");
    return false;
  }
  let processTabsSecs = $("#processTabsSecs").val();
  if (!processTabsSecs || !checkPosIntFormat(processTabsSecs)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#processTabsSecs").focus();
    $("#alertBadSeconds").dialog("open");
    return false;
  }
  let clockOffset = $("#clockOffset").val();
  if (!checkPosNegIntFormat(clockOffset)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#clockOffset").focus();
    $("#alertBadClockOffset").dialog("open");
    return false;
  }
  let ignoreJumpSecs = $("#ignoreJumpSecs").val();
  if (!checkPosIntFormat(ignoreJumpSecs)) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#ignoreJumpSecs").focus();
    $("#alertBadSeconds").dialog("open");
    return false;
  }

  // Prevent removal of block sets with disabled options
  if (numSets < gNumSetsMin) {
    $("#numSets").val(gNumSetsMin);
  }

  // Clean time periods for preventing access to options (and disallow 0000-2400)
  accessPreventTimes = cleanTimePeriods(accessPreventTimes);
  $("#accessPreventTimes").val(accessPreventTimes);
  if (accessPreventTimes == ALL_DAY_TIMES) {
    $("#tabs").tabs("option", "active", gNumSets);
    $("#accessPreventTimes").focus();
    $("#alertBadAccessPreventTimes").dialog("open");
    return false;
  }

  let options = { simplified: gSimplified };

  // General options
  for (let name in GENERAL_OPTIONS) {
    let type = GENERAL_OPTIONS[name].type;
    let id = GENERAL_OPTIONS[name].id;
    if (id) {
      if (type == "boolean") {
        options[name] = getElement(id).checked;
      } else if (type == "string") {
        options[name] = getElement(id).value;
      }
    }
  }

  // Per-set options
  let needHistoryPerm = false;
  for (let set = 1; set <= gNumSets; set++) {
    for (let name in PER_SET_OPTIONS) {
      let type = PER_SET_OPTIONS[name].type;
      let id = PER_SET_OPTIONS[name].id;

      // Set option value
      if (name == "sites") {
        let sites = cleanSites(getElement(`${id}${set}`).value);
        options[`${name}${set}`] = sites;

        // Get regular expressions to match sites
        let regexps = getRegExpSites(sites, options["matchSubdomains"]);
        options[`blockRE${set}`] = regexps.block;
        options[`allowRE${set}`] = regexps.allow;
        options[`referRE${set}`] = regexps.refer;
        options[`keywordRE${set}`] = regexps.keyword;
      } else if (name == "times") {
        let times = cleanTimePeriods(getElement(`${id}${set}`).value);
        options[`${name}${set}`] = times;
      } else if (name == "conjMode") {
        options[`${name}${set}`] = getElement(`${id}${set}`).selectedIndex == 1;
      } else if (type == "boolean") {
        options[`${name}${set}`] = getElement(`${id}${set}`).checked;
      } else if (type == "string") {
        options[`${name}${set}`] = getElement(`${id}${set}`).value;
      } else if (type == "array") {
        let val = PER_SET_OPTIONS[name].def.slice();
        for (let i = 0; i < val.length; i++) {
          val[i] = getElement(`${id}${i}${set}`).checked;
        }
        options[`${name}${set}`] = val;
      }
    }

    needHistoryPerm ||= options[`addHistory${set}`];
  }

  if (!browser.history && needHistoryPerm) {
    // Request permission to access browser history
    browser.permissions.request({ permissions: ["history"] });
  }

  let complete = event.data.closeOptions ? closeOptions : retrieveOptions;

  let message = {
    type: "options",
    ordering: gSetReordered ? gSetOrdering : null,
  };

  if (options["sync"]) {
    // Set sync option in local storage and all options in sync storage
    browser.storage.local.set({ sync: true });
    browser.storage.sync.set(options).then(
      function () {
        browser.runtime.sendMessage(message);
        $("#form").hide({ effect: "fade", complete: complete });
      },
      function (error) {
        warn("Cannot set options: " + error);
      }
    );
  } else {
    // Export options to sync storage if selected
    if (options["autoExportSync"] && !gIsAndroid) {
      exportOptionsSync(); // no event passed, so dialogs suppressed
    }

    // Set all options in local storage
    browser.storage.local.set(options).then(
      function () {
        browser.runtime.sendMessage(message);
        $("#form").hide({ effect: "fade", complete: complete });
      },
      function (error) {
        warn("Cannot set options: " + error);
      }
    );
  }

  return true;
}

// Close options tab
//
function closeOptions() {
  // Request tab close
  browser.runtime.sendMessage({ type: "close" });
}

// Retrieve options from local storage
//
function retrieveOptions() {
  return new Promise((resolve, reject) => {
    //log("retrieveOptions");

    browser.storage.local.get("sync").then(onGotSync, onError);

    function onGotSync(options) {
      if (options["sync"]) {
        // Get all options from sync storage
        browser.storage.sync.get().then(onGot, onError);
      } else {
        // Get all options from local storage
        browser.storage.local.get().then(onGot, onError);
      }

      resolve();
    }

    function onGot(options) {
      cleanOptions(options);
      cleanTimeData(options);

      // Initialize form
      initForm(options["numSets"]);

      setTheme(options["theme"]);

      showSimplifiedOptions(options["simplified"]);

      // Get clock time format
      gClockTimeOpts = {};
      let clockTimeFormat = options["clockTimeFormat"];
      if (clockTimeFormat > 0) {
        gClockTimeOpts.hour12 = clockTimeFormat == 1;
      }

      // Get current time in seconds
      let clockOffset = options["clockOffset"];
      let now = Math.floor(Date.now() / 1000) + clockOffset * 60;

      // Get current time/date
      let timedate = new Date(now * 1000);

      // Get number of minutes elapsed since midnight
      let mins = timedate.getHours() * 60 + timedate.getMinutes();

      if (gNewOpen) {
        // Check whether access to options is prevented at this time
        let apt = options["apt"];
        let aptMinPeriods = getMinPeriods(apt);
        for (let mp of aptMinPeriods) {
          if (mins >= mp.start && mins < mp.end) {
            $("#alertAccessPreventTimes").html(apt);
            $("#alertAccessPrevent").dialog("open");
            $("#alertAccessPrevent").on("dialogclose", closeOptions);
            return;
          }
        }
      }

      gNewOpen = false;

      // Check whether a lockdown is currently active
      for (let set = 1; set <= gNumSets; set++) {
        let timedata = options[`timedata${set}`];
        let lockdown = timedata[4] > now;
        getElement(`cancelLockdown${set}`).disabled = !lockdown;
      }

      // Check whether access to options should be prevented
      for (let set = 1; set <= gNumSets; set++) {
        // Do nothing if set is disabled
        if (options[`disable${set}`]) continue;

        // Get options
        let timedata = options[`timedata${set}`];
        let times = options[`times${set}`];
        let minPeriods = getMinPeriods(times);
        let limitMins = options[`limitMins${set}`];
        let limitPeriod = options[`limitPeriod${set}`];
        let limitOffset = options[`limitOffset${set}`];
        let periodStart = getTimePeriodStart(now, limitPeriod, limitOffset);
        let rollover = options[`rollover${set}`];
        let conjMode = options[`conjMode${set}`];
        let days = options[`days${set}`];

        updateRolloverTime(timedata, limitMins, limitPeriod, periodStart);

        // Check day
        let onSelectedDay = days[timedate.getDay()];

        // Check time periods
        let withinTimePeriods = false;
        if (onSelectedDay && times) {
          // Check each time period in turn
          for (let mp of minPeriods) {
            if (mins >= mp.start && mins < mp.end) {
              withinTimePeriods = true;
            }
          }
        }

        // Check time limit
        let secsRollover = rollover ? timedata[5] : 0;
        let afterTimeLimit =
          onSelectedDay &&
          limitMins &&
          limitPeriod &&
          timedata[2] == periodStart &&
          timedata[3] >= secsRollover + limitMins * 60;

        // Check lockdown condition
        let lockdown = timedata[4] > now;

        // Disable options if specified block conditions are fulfilled
        if (
          lockdown ||
          (!conjMode && (withinTimePeriods || afterTimeLimit)) ||
          (conjMode && withinTimePeriods && afterTimeLimit)
        ) {
          if (options[`prevOpts${set}`]) {
            gNumSetsMin = set;
            // Disable options for this set
            disableSetOptions(set, true);
            // Disable import options
            disableImportOptions();
          }
          if (options[`prevGenOpts${set}`]) {
            // Disable general options
            disableGeneralOptions();
          }
        }
      }

      // Per-set options
      for (let set = 1; set <= gNumSets; set++) {
        for (let name in PER_SET_OPTIONS) {
          let type = PER_SET_OPTIONS[name].type;
          let id = PER_SET_OPTIONS[name].id;
          let val = options[`${name}${set}`];

          // Set component value
          if (name == "sites") {
            let element = getElement(`${id}${set}`);
            if (!element) {
              console.error(
                `[LBNG] Missing element: ${id}${set} for option: ${name} (type: ${type})`
              );
              continue;
            }
            element.value = val.replace(/\s+/g, "\n");
          } else if (name == "conjMode") {
            let element = getElement(`${id}${set}`);
            if (!element) {
              console.error(
                `[LBNG] Missing element: ${id}${set} for option: ${name} (type: ${type})`
              );
              continue;
            }
            element.selectedIndex = val ? 1 : 0;
          } else if (type == "boolean") {
            let element = getElement(`${id}${set}`);
            if (!element) {
              console.error(
                `[LBNG] Missing element: ${id}${set} for option: ${name} (type: boolean)`
              );
              continue;
            }
            element.checked = val;
          } else if (type == "string") {
            let element = getElement(`${id}${set}`);
            if (!element) {
              console.error(
                `[LBNG] Missing element: ${id}${set} for option: ${name} (type: string)`
              );
              continue;
            }
            element.value = val;
          } else if (type == "array") {
            for (let i = 0; i < val.length; i++) {
              let element = getElement(`${id}${i}${set}`);
              if (!element) {
                console.error(
                  `[LBNG] Missing element: ${id}${i}${set} for option: ${name} (type: array, index: ${i})`
                );
                continue;
              }
              element.checked = val[i];
            }
          }
        }

        // Apply custom set name to tab (if specified)
        updateBlockSetName(set, options[`setName${set}`]);

        // Update show/hide password page options
        updatePasswordPageOptions(set);

        // Update enabled/disabled state of sub-options
        updateSubOptions(set);

        if (gIsAndroid) {
          disableNonAndroidOptions(set);
        }
      }

      // General options
      for (let name in GENERAL_OPTIONS) {
        let type = GENERAL_OPTIONS[name].type;
        let id = GENERAL_OPTIONS[name].id;
        if (id) {
          if (type == "boolean") {
            getElement(id).checked = options[name];
          } else if (type == "string") {
            getElement(id).value = options[name];
          }
        }
      }

      updateMoveSetButtons();

      confirmAccess(options);
    }

    function onError(error) {
      warn("Cannot get options: " + error);
      $("#alertRetrieveError").dialog("open");
      reject(error);
    }
  });
}

// Confirm access to options
//
function confirmAccess(options) {
  if (gAccessConfirmed) {
    // Access already confirmed
    $("#form").show({ effect: "fade" });
    return;
  }

  let oa = options["oa"];
  let password = options["password"];
  let hpp = options["hpp"];

  if (oa == 1 && password) {
    gAccessHashCode = hashCode32(password);
    if (hpp) {
      $("#promptPasswordInput").attr("type", "password");
    } else {
      $("#promptPasswordInput").attr("type", "text");
    }
    $("#promptPasswordInput").val("");
    $("#promptPassword").dialog("open");
    $("#promptPasswordInput").focus();
  } else if (oa > 1) {
    let code = createAccessCode(32);
    if (oa > 2) {
      code += createAccessCode(32);
    }
    if (oa > 3) {
      code += createAccessCode(64);
    }
    gAccessHashCode = hashCode32(code);
    displayAccessCode(code, options["accessCodeImage"]);
    $("#promptAccessCodeInput").val("");
    $("#promptAccessCode").dialog("open");
    $("#promptAccessCodeInput").focus();
  } else {
    gAccessConfirmed = true;
    $("#form").show({ effect: "fade" });
  }
}

// Display access code (as text or image)
//
function displayAccessCode(code, asImage) {
  let codeText = getElement("promptAccessCodeText");
  let codeImage = getElement("promptAccessCodeImage");
  let codeCanvas = getElement("promptAccessCodeCanvas");

  if (asImage) {
    // Display code as image
    codeText.style.display = "none";
    codeImage.style.display = "";
    let ctx = codeCanvas.getContext("2d");
    ctx.font = "normal 14px monospace";
    let width = ctx.measureText(code.substring(0, 64)).width + 8;
    let height = code.length == 128 ? 40 : 24;
    codeCanvas.width = width * devicePixelRatio;
    codeCanvas.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    codeCanvas.style.width = width + "px";
    codeCanvas.style.height = height + "px";
    ctx.font = "normal 14px monospace"; // resizing canvas resets font!
    ctx.fillStyle = "#000";
    if (code.length == 128) {
      ctx.fillText(code.substring(0, 64), 4, 16);
      ctx.fillText(code.substring(64), 4, 32);
    } else {
      ctx.fillText(code, 4, 16);
    }
  } else {
    // Display code as text
    codeText.style.display = "";
    codeImage.style.display = "none";
    if (code.length == 128) {
      codeText.appendChild(document.createTextNode(code.substring(0, 64)));
      codeText.appendChild(document.createElement("br"));
      codeText.appendChild(document.createTextNode(code.substring(64)));
    } else {
      codeText.appendChild(document.createTextNode(code));
    }
  }
}

// Show/hide access password
//
function accessPasswordShow() {
  let input = getElement("accessPassword");
  let checkbox = getElement("accessPasswordShow");
  input.type = checkbox.checked ? "text" : "password";
}

// Show adjusted time based on clock offset
//
function showClockOffsetTime() {
  let clockOffset = $("#clockOffset").val();
  if (!clockOffset || !checkPosNegIntFormat(clockOffset)) {
    $("#clockOffsetTime").css("display", "none");
  } else {
    let timedate = new Date(Date.now() + clockOffset * 60000);
    $("#clockOffsetTime").html(
      timedate.toLocaleString(undefined, gClockTimeOpts)
    );
    $("#clockOffsetTime").css("display", "inline");
  }
}

// Compile options for export
//
function compileExportOptions(passwords) {
  let options = {};

  // Per-set options
  for (let set = 1; set <= gNumSets; set++) {
    for (let name in PER_SET_OPTIONS) {
      let type = PER_SET_OPTIONS[name].type;
      let id = PER_SET_OPTIONS[name].id;

      // Set option value
      if (name == "sites") {
        let sites = cleanSites(getElement(`${id}${set}`).value);
        options[`${name}${set}`] = sites;
      } else if (name == "times") {
        let times = cleanTimePeriods(getElement(`${id}${set}`).value);
        options[`${name}${set}`] = times;
      } else if (name == "conjMode") {
        options[`${name}${set}`] = getElement(`${id}${set}`).selectedIndex == 1;
      } else if (type == "boolean") {
        options[`${name}${set}`] = getElement(`${id}${set}`).checked;
      } else if (type == "string") {
        options[`${name}${set}`] = escape(getElement(`${id}${set}`).value);
      } else if (type == "array") {
        let val = PER_SET_OPTIONS[name].def.slice();
        for (let i = 0; i < val.length; i++) {
          val[i] = getElement(`${id}${i}${set}`).checked;
        }
        options[`${name}${set}`] = val;
      }
    }
  }

  // General options
  for (let name in GENERAL_OPTIONS) {
    if (!passwords && (name == "password" || name == "orp")) continue;
    let type = GENERAL_OPTIONS[name].type;
    let id = GENERAL_OPTIONS[name].id;
    if (id) {
      if (type == "boolean") {
        options[name] = getElement(id).checked;
      } else if (type == "string") {
        options[name] = escape(getElement(id).value);
      }
    }
  }

  return options;
}

// Apply imported options
//
function applyImportOptions(options) {
  // Initialize form
  initForm(options["numSets"]);

  // Per-set options
  for (let set = 1; set <= gNumSets; set++) {
    for (let name in PER_SET_OPTIONS) {
      let type = PER_SET_OPTIONS[name].type;
      let id = PER_SET_OPTIONS[name].id;
      let val = options[`${name}${set}`];

      if (val != undefined) {
        // Set component value
        if (name == "sites") {
          getElement(`${id}${set}`).value = val.replace(/\s+/g, "\n");
        } else if (name == "conjMode") {
          getElement(`${id}${set}`).selectedIndex = val ? 1 : 0;
        } else if (type == "boolean") {
          getElement(`${id}${set}`).checked = val;
        } else if (type == "string") {
          getElement(`${id}${set}`).value = unescape(val);
        } else if (type == "array") {
          for (let i = 0; i < val.length; i++) {
            getElement(`${id}${i}${set}`).checked = val[i];
          }
        }
      }
    }

    // Apply Firefox-specific options
    let val = options[`prevAddons${set}`];
    if (val != undefined) {
      getElement(`prevExts${set}`).checked = val;
    }

    // Apply custom set name to tab (if specified)
    updateBlockSetName(set, options[`setName${set}`]);

    // Update show/hide password page options
    updatePasswordPageOptions(set);

    // Update enabled/disabled state of sub-options
    updateSubOptions(set);

    if (gIsAndroid) {
      disableNonAndroidOptions(set);
    }
  }

  // General options
  for (let name in GENERAL_OPTIONS) {
    let type = GENERAL_OPTIONS[name].type;
    let id = GENERAL_OPTIONS[name].id;
    if (id && options[name] != undefined) {
      if (type == "boolean") {
        getElement(id).checked = options[name];
      } else if (type == "string") {
        getElement(id).value = unescape(options[name]);
      }
    }
  }
}

// Download blob file
//
function downloadBlobFile(blob, filename) {
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.setAttribute("download", filename);
  a.setAttribute("type", blob.type);
  a.dispatchEvent(new MouseEvent("click"));
}

// Export options to text file
//
function exportOptions() {
  let exportPasswords = getElement("exportPasswords").checked;

  let options = compileExportOptions(exportPasswords);

  // Convert options to text lines
  let lines = [];
  for (let option in options) {
    let value = options[option];
    if (/^days\d+$/.test(option)) {
      lines.push(option + "=" + encodeDays(value) + "\n");
    } else {
      lines.push(option + "=" + value + "\n");
    }
  }

  // Create blob and download it
  let blob = new Blob(lines, { type: "text/plain", endings: "native" });
  downloadBlobFile(blob, DEFAULT_OPTIONS_FILE);

  $("#alertExportSuccess").dialog("open");
}

// Import options from text file
//
function importOptions() {
  let file = getElement("importFile").files[0];
  if (!file) {
    $("#alertNoImportFile").dialog("open");
    return;
  }

  // Read and process file
  let reader = new FileReader();
  reader.onload = processImportFile;
  reader.readAsText(file);

  function processImportFile(event) {
    let text = event.target.result;
    if (!text) {
      $("#alertImportError").dialog("open");
      return;
    }

    // Extract options from text
    let regexp = /^(\w+)=(.*)$/;
    let lines = text.split(/[\n\r]+/);
    let options = {};
    let hasOptions = false;
    for (let line of lines) {
      let results = regexp.exec(line);
      if (results) {
        let option = results[1];
        let value = results[2];
        if (/^days\d+$/.test(option)) {
          options[option] = decodeDays(value);
        } else if (/^(true|false)$/.test(value)) {
          options[option] = isTrue(value);
        } else {
          options[option] = value;
        }
        hasOptions = true;
      }
    }

    if (!hasOptions) {
      $("#alertImportError").dialog("open");
      return;
    }

    // Preserve passwords if not imported
    if (options["password"] == undefined) {
      options["password"] = getElement("accessPassword").value;
    }
    if (options["orp"] == undefined) {
      options["orp"] = getElement("overridePassword").value;
    }

    cleanOptions(options);
    applyImportOptions(options);

    $("#tabs").tabs("option", "active", gNumSets);
    $("#alertImportSuccess").dialog("open");
  }
}

// Export options to JSON file
//
function exportOptionsJSON() {
  let exportPasswords = getElement("exportPasswords").checked;

  let options = compileExportOptions(exportPasswords);

  // Convert options to JSON string
  let json = JSON.stringify(options);

  // Create blob and download it
  let blob = new Blob([json], { type: "application/json", endings: "native" });
  downloadBlobFile(blob, DEFAULT_JSON_FILE);

  $("#alertExportSuccess").dialog("open");
}

// Export options to sync storage
//
function exportOptionsSync(event) {
  let options = compileExportOptions(true);

  browser.storage.sync.set(options).then(onSuccess, onError);

  function onSuccess() {
    if (event) {
      $("#alertExportSuccess").dialog("open");
    }
  }

  function onError(error) {
    warn("Cannot export options to sync storage: " + error);
    if (event) {
      $("#alertExportSyncError").dialog("open");
    }
  }
}

// Import options from sync storage
//
function importOptionsSync(event) {
  browser.storage.sync.get().then(onGot, onError);

  function onGot(options) {
    cleanOptions(options);
    applyImportOptions(options);

    if (event) {
      $("#tabs").tabs("option", "active", gNumSets);
      $("#alertImportSuccess").dialog("open");
    }
  }

  function onError(error) {
    warn("Cannot import options from sync storage: " + error);
    if (event) {
      $("#alertImportSyncError").dialog("open");
    }
  }
}

// Open diagnostics page
//
function openDiagnostics() {
  let fullURL = browser.runtime.getURL("diagnostics.html");

  browser.tabs.create({ url: fullURL });
}

// Swap options for two block sets
//
function swapSetOptions(set1, set2) {
  // Swap disabled state
  let cl_disabled1 = getElement(`cancelLockdown${set1}`).disabled;
  let cl_disabled2 = getElement(`cancelLockdown${set2}`).disabled;
  let disabled1 = gSetDisabled[set1];
  let disabled2 = gSetDisabled[set2];
  disableSetOptions(set1, disabled2);
  disableSetOptions(set2, disabled1);
  getElement(`cancelLockdown${set1}`).disabled = cl_disabled2;
  getElement(`cancelLockdown${set2}`).disabled = cl_disabled1;

  // Swap all per-set options
  for (let name in PER_SET_OPTIONS) {
    let type = PER_SET_OPTIONS[name].type;
    let id = PER_SET_OPTIONS[name].id;

    // Swap component values and enabled/disabled states
    if (name == "conjMode") {
      let comp1 = getElement(`${id}${set1}`);
      let comp2 = getElement(`${id}${set2}`);
      let index = comp1.selectedIndex;
      comp1.selectedIndex = comp2.selectedIndex;
      comp2.selectedIndex = index;
    } else if (type == "boolean") {
      let comp1 = getElement(`${id}${set1}`);
      let comp2 = getElement(`${id}${set2}`);
      let checked = comp1.checked;
      comp1.checked = comp2.checked;
      comp2.checked = checked;
    } else if (type == "string") {
      let comp1 = getElement(`${id}${set1}`);
      let comp2 = getElement(`${id}${set2}`);
      let value = comp1.value;
      comp1.value = comp2.value;
      comp2.value = value;
    } else if (type == "array") {
      let def = PER_SET_OPTIONS[name].def;
      for (let i = 0; i < def.length; i++) {
        let comp1 = getElement(`${id}${i}${set1}`);
        let comp2 = getElement(`${id}${i}${set2}`);
        let checked = comp1.checked;
        comp1.checked = comp2.checked;
        comp2.checked = checked;
      }
    }
  }
}

// Reset options for block set to defaults
//
function resetSetOptions(set) {
  // Restore default set name to tab
  updateBlockSetName(set, "");

  // Restore per-set options
  for (let name in PER_SET_OPTIONS) {
    let type = PER_SET_OPTIONS[name].type;
    let id = PER_SET_OPTIONS[name].id;
    let val = PER_SET_OPTIONS[name].def;

    // Set component value
    if (name == "conjMode") {
      getElement(`${id}${set}`).selectedIndex = val ? 1 : 0;
    } else if (type == "boolean") {
      getElement(`${id}${set}`).checked = val;
    } else if (type == "string") {
      getElement(`${id}${set}`).value = val;
    } else if (type == "array") {
      for (let i = 0; i < val.length; i++) {
        getElement(`${id}${i}${set}`).checked = val[i];
      }
    }
  }

  // Update enabled/disabled state of sub-options
  updateSubOptions(set);

  // Update show/hide password page options
  updatePasswordPageOptions(set);
}

// Disable (or re-enable) options for block set
//
function disableSetOptions(set, disabled) {
  // Disable per-set options
  for (let name in PER_SET_OPTIONS) {
    let type = PER_SET_OPTIONS[name].type;
    let id = PER_SET_OPTIONS[name].id;
    if (type == "array") {
      let def = PER_SET_OPTIONS[name].def;
      for (let i = 0; i < def.length; i++) {
        getElement(`${id}${i}${set}`).disabled = disabled;
      }
    } else {
      getElement(`${id}${set}`).disabled = disabled;
    }
  }

  // Disable buttons
  let items = [
    "resetOpts",
    "allDay",
    "defaultPage",
    "delayingPage",
    "blankPage",
    "clearRegExpBlock",
    "genRegExpBlock",
    "clearRegExpAllow",
    "genRegExpAllow",
    "cancelLockdown",
  ];
  for (let item of items) {
    getElement(`${item}${set}`).disabled = disabled;
  }

  gSetDisabled[set] = disabled;
}

// Disable general options
//
function disableGeneralOptions() {
  // Disable all general options
  for (let name in GENERAL_OPTIONS) {
    let id = GENERAL_OPTIONS[name].id;
    if (id) {
      getElement(id).disabled = true;
    }
  }

  // Disable other items
  let items = [
    "accessPasswordShow",
    "exportOptions",
    "importOptions",
    "importFile",
    "exportOptionsJSON",
    "exportOptionsSync",
    "importOptionsSync",
  ];
  for (let item of items) {
    getElement(item).disabled = true;
  }
}

// Disable import options
//
function disableImportOptions() {
  // Disable all import options
  let items = ["importOptions", "importFile", "importOptionsSync"];
  for (let item of items) {
    getElement(item).disabled = true;
  }
}

// Update enabled/disabled state of sub-options
//
function updateSubOptions(set) {
  for (let name in SUB_OPTIONS) {
    for (let subname of SUB_OPTIONS[name]) {
      let comp1 = getElement(`${name}${set}`);
      let comp2 = getElement(`${subname}${set}`);
      comp2.disabled = comp1.disabled || !comp1.checked;
    }
  }
}

// Disable options unavailable on Android
//
function disableNonAndroidOptions(set) {
  let addHistory = getElement(`addHistory${set}`);
  addHistory.checked = false;
  addHistory.disabled = true;
}

// Update enabled/disabled state of move set buttons
//
function updateMoveSetButtons() {
  for (let set = 1; set <= gNumSets; set++) {
    // Move-left button
    let msl_disabled = set == 1 || gSetDisabled[set] || gSetDisabled[set - 1];
    getElement(`moveSetL${set}`).disabled = msl_disabled;
    // Move-right button
    let msr_disabled =
      set == gNumSets || gSetDisabled[set] || gSetDisabled[set + 1];
    getElement(`moveSetR${set}`).disabled = msr_disabled;
  }
}

// Initialize access control prompt
//
function initAccessControlPrompt(prompt) {
  // Create functions for buttons
  let dialogButtons = {
    OK: function () {
      let input = $(`#${prompt}Input`);
      if (hashCode32(input.val()) == gAccessHashCode) {
        gAccessConfirmed = true;
        $("#form").show({ effect: "fade" });
        $(`#${prompt}`).dialog("close");
      } else {
        input.val("");
        input.effect({ effect: "highlight", color: "#ff0000" });
        input.focus();
      }
    },
    Cancel: function () {
      $(`#${prompt}`).dialog("close");
    },
  };

  // Initialize prompt dialog
  $(`#${prompt}`).dialog({
    autoOpen: false,
    modal: true,
    width: 600,
    buttons: dialogButtons,
    close: function (event, ui) {
      if (!gAccessConfirmed) closeOptions();
    },
  });

  // Connect ENTER key to OK button
  $(`#${prompt}Input`).keydown(function (event) {
    if (event.which == 13) {
      dialogButtons.OK();
    }
  });
}

// Handle keydown event
//
function handleKeyDown(event) {
  if (event.ctrlKey && event.which == 83) {
    event.preventDefault();
    if (!event.shiftKey) {
      // Ctrl+S -> Save Options
      $("#saveOptions").click();
    } else {
      // Ctrl+Shift+S -> Save Options & Close
      $("#saveOptionsClose").click();
    }
  }
}

// This function will be called once the DOM is ready.
function initializePage() {
	browser.runtime.getPlatformInfo().then((info) => {
	  gIsAndroid = info.os == "android";
	});
  
	// Save original HTML of the form BEFORE initializing any widgets. This is critical.
	gFormHTML = $("#form").html();
  
	// Initialize jQuery UI alert dialogs
	$("div[id^='alert']").dialog({
	  autoOpen: false,
	  modal: true,
	  width: 600,
	  buttons: {
		OK: function () {
		  $(this).dialog("close");
		},
	  },
	});
  
	// Initialize access control prompt dialogs
	initAccessControlPrompt("promptPassword");
	initAccessControlPrompt("promptAccessCode");
  
	// Load settings and build the dynamic UI
	retrieveOptions()
	  .then(() => {
		console.log("[LBNG] Main options loaded.");
		
		// IMPORTANT: Wait for jQuery UI tabs to finish rendering
		// Then attach AI listeners AFTER everything is stable
		setTimeout(() => {
		  initializeAiFeatures();
		}, 500);
	  })
	  .catch((error) => {
		console.error("[LBNG] Failed to retrieve options:", error);
	  });
  }

  function initializeAiFeatures() {
	console.log("[LBNG AI] initializeAiFeatures() called");
	
	// Use event delegation on the form
	const form = document.getElementById("form");
	if (!form) {
	  console.error("[LBNG AI] Form not found!");
	  return;
	}
  
	console.log("[LBNG AI] Attaching delegated click listener to form...");
  
	// Event delegation: listen on parent, filter for button
	form.addEventListener("click", (event) => {
	  if (event.target.id === "aiSetPlanButton") {
		event.preventDefault();
		console.log("[LBNG AI] ✅✅✅ BUTTON CLICKED VIA DELEGATION! ✅✅✅");
		
		const userPlanInput = document.getElementById("aiUserPlan");
		const durationInput = document.getElementById("aiDuration");
		const durationUnitSelect = document.getElementById("aiDurationUnit");
		const aiPlannerStatus = document.getElementById("aiPlannerStatus");
		
		if (!userPlanInput || !durationInput || !durationUnitSelect) {
		  console.error("[LBNG AI] Required inputs not found!");
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
  
		console.log("[LBNG AI] User input:", { 
		  userGoal, 
		  durationValue, 
		  durationUnit, 
		  durationMinutes 
		});
  
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
		  aiPlannerStatus.textContent = "🤖 Generating your focus plan...";
		  aiPlannerStatus.style.display = "block";
		}
		event.target.disabled = true;
  
		console.log("[LBNG AI] Sending message to background script...");
  
		chrome.runtime.sendMessage(
		  { 
			type: "startAiLockdown", 
			goal: userGoal, 
			duration: durationMinutes 
		  },
		  (response) => {
			console.log("[LBNG AI] Response received:", response);
			
			if (chrome.runtime.lastError) {
			  console.error("[LBNG AI] Runtime error:", chrome.runtime.lastError);
			  if (aiPlannerStatus) {
				aiPlannerStatus.textContent = `❌ Error: ${chrome.runtime.lastError.message}`;
			  }
			  event.target.disabled = false;
			  return;
			}
			
			if (response && response.success) {
			  if (aiPlannerStatus) {
				const formattedDuration = durationUnit === "hours" 
				  ? `${durationValue} ${durationValue === 1 ? 'hour' : 'hours'}`
				  : `${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'}`;
				
				aiPlannerStatus.textContent = `✅ Focus session started for ${formattedDuration}! Get to work!`;
			  }
			  setTimeout(() => window.location.reload(), 2000);
			} else {
			  if (aiPlannerStatus) {
				aiPlannerStatus.textContent = `❌ Error: ${
				  response ? response.error : "No response from background script"
				}`;
			  }
			}
			event.target.disabled = false;
		  }
		);
	  }
	});
  
	console.log("[LBNG AI] ✅ Delegated click listener attached successfully");
  
	// Function to display current lockdown status
	function checkStatus() {
	  const aiActiveLockdownStatus = document.getElementById("aiActiveLockdownStatus");
	  if (!aiActiveLockdownStatus) return;
	  
	  chrome.storage.local.get(
		["aiLockdownActive", "aiLockdownEndTime", "aiLockdownGoal"],
		(data) => {
		  if (
			data.aiLockdownActive &&
			data.aiLockdownEndTime > Date.now()
		  ) {
			const timeLeft = Math.round((data.aiLockdownEndTime - Date.now()) / 60000);
			const hours = Math.floor(timeLeft / 60);
			const minutes = timeLeft % 60;
			
			let timeString;
			if (hours > 0) {
			  timeString = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
			  if (minutes > 0) {
				timeString += ` and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
			  }
			} else {
			  timeString = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
			}
			
			aiActiveLockdownStatus.innerHTML = `<strong>🎯 Active Focus Session:</strong> ${data.aiLockdownGoal}<br><em>About ${timeString} remaining.</em>`;
		  } else {
			aiActiveLockdownStatus.textContent = "No active focus session.";
		  }
		}
	  );
	}
	
	checkStatus();
	setInterval(checkStatus, 10000);
  }

// Add the final event listeners
window.addEventListener("DOMContentLoaded", initializePage);
window.addEventListener("keydown", handleKeyDown);
