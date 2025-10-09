console.log("[LBNG YouTube] Content script loaded");

let analysisInProgress = false;
let overlayElement = null;
let currentVideoId = null;
let blockPending = false;
let lastExtractedTitle = ""; //
// ... (keep all the overlay functions the same) ...

function showLoadingOverlay(immediate = false) {
  if (overlayElement) return;

  overlayElement = document.createElement("div");
  overlayElement.id = "lbng-youtube-overlay";
  overlayElement.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        ">
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                text-align: center;
                max-width: 450px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            ">
                <div style="font-size: 56px; margin-bottom: 20px; animation: lbng-pulse 1.5s ease-in-out infinite;">🤖</div>
                <h2 style="margin: 0 0 10px 0; color: #333; font-size: 24px;">Analyzing Video Content</h2>
                <p style="color: #666; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;" id="lbng-goal-text">
                    Checking if this video matches your focus goal...
                </p>
                <div style="
                    width: 100%;
                    height: 4px;
                    background: #e0e0e0;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 20px;
                ">
                    <div style="
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                        animation: lbng-progress 1.2s ease-in-out infinite;
                    "></div>
                </div>
                <p style="color: #999; margin: 20px 0 0 0; font-size: 12px;">
                    This usually takes 2-3 seconds
                </p>
            </div>
        </div>
        <style>
            @keyframes lbng-progress {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            @keyframes lbng-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        </style>
    `;

  document.documentElement.appendChild(overlayElement);
  console.log("[LBNG YouTube] Overlay shown");
}

function hideLoadingOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
    console.log("[LBNG YouTube] Overlay hidden");
  }
}

function updateOverlayGoal(goal) {
  const goalText = document.getElementById("lbng-goal-text");
  if (goalText && goal) {
    goalText.innerHTML = `Checking if this video matches your goal:<br><strong>${goal}</strong>`;
  }
}

function getVideoIdFromUrl(url) {
  const urlParams = new URLSearchParams(new URL(url).search);
  return urlParams.get("v");
}

function extractVideoInfo() {
  const videoId = getVideoIdFromUrl(window.location.href);

  if (!videoId) {
    return null;
  }

  let title = "";
  let channelName = "";
  let description = "";

  const titleSelectors = [
    'meta[name="title"]',
    "h1.ytd-watch-metadata yt-formatted-string",
    "h1.title yt-formatted-string",
    "h1 yt-formatted-string",
  ];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      title = element.getAttribute("content") || element.textContent || "";
      if (title) break;
    }
  }

  const channelSelectors = [
    "ytd-channel-name a",
    "ytd-video-owner-renderer ytd-channel-name a",
    "#owner-name a",
    'link[itemprop="name"]',
  ];

  for (const selector of channelSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      channelName =
        element.getAttribute("content") || element.textContent || "";
      if (channelName) break;
    }
  }

  const descElement = document.querySelector('meta[name="description"]');
  if (descElement) {
    description = descElement.getAttribute("content") || "";
  }

  return {
    videoId,
    url: window.location.href,
    title: title.trim(),
    channelName: channelName.trim(),
    description: description.trim().substring(0, 300),
  };
}

// FIXED: Better metadata change detection
async function analyzeCurrentVideo() {
  if (analysisInProgress) {
    console.log("[LBNG YouTube] Analysis already in progress");
    return;
  }

  const videoId = getVideoIdFromUrl(window.location.href);
  if (!videoId) {
    console.log("[LBNG YouTube] No video ID in URL");
    return;
  }

  if (videoId === currentVideoId && !blockPending) {
    console.log("[LBNG YouTube] Same video, skipping re-analysis");
    return;
  }

  currentVideoId = videoId;
  analysisInProgress = true;
  blockPending = false;

  console.log("[LBNG YouTube] Starting analysis for video:", videoId);

  showLoadingOverlay(true);

  // IMPROVED: Wait for metadata to actually change
  let videoInfo = null;
  let attempts = 0;
  const maxAttempts = 6; // Increased from 4 to 6

  while (attempts < maxAttempts) {
    // Longer initial delay for YouTube's SPA to settle
    const delay = attempts === 0 ? 800 : 600;
    await new Promise((resolve) => setTimeout(resolve, delay));

    videoInfo = extractVideoInfo();

    if (videoInfo && videoInfo.title && videoInfo.title.trim().length > 0) {
      // CHECK: Has the title actually changed from the last video?
      if (videoInfo.title !== lastExtractedTitle || attempts === 0) {
        console.log(
          "[LBNG YouTube] ✅ Got NEW video metadata on attempt",
          attempts + 1
        );
        console.log("[LBNG YouTube] Title:", videoInfo.title);
        lastExtractedTitle = videoInfo.title;

        // VERIFY: Wait a bit more and check if title is stable
        if (attempts < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const recheck = extractVideoInfo();
          if (recheck && recheck.title === videoInfo.title) {
            console.log("[LBNG YouTube] ✅ Title verified stable");
            break; // Title is stable, proceed
          } else {
            console.log(
              "[LBNG YouTube] ⚠️ Title changed during verification, waiting..."
            );
            attempts++;
            continue;
          }
        } else {
          break; // After 2 attempts, trust the title
        }
      } else {
        console.log(
          "[LBNG YouTube] ⏳ Title unchanged from previous video, waiting... attempt",
          attempts + 1
        );
        console.log("[LBNG YouTube] Current:", videoInfo.title);
        console.log("[LBNG YouTube] Previous:", lastExtractedTitle);
      }
    } else {
      console.log("[LBNG YouTube] ⏳ No title yet... attempt", attempts + 1);
    }

    attempts++;
  }

  if (!videoInfo || !videoInfo.videoId) {
    console.log(
      "[LBNG YouTube] Could not extract video info, allowing by default"
    );
    hideLoadingOverlay();
    analysisInProgress = false;
    return;
  }

  if (!videoInfo.title || videoInfo.title.trim().length === 0) {
    console.log(
      "[LBNG YouTube] No title available after",
      maxAttempts,
      "attempts, allowing"
    );
    hideLoadingOverlay();
    analysisInProgress = false;
    return;
  }

  // FINAL CHECK: If title still matches previous video, something is wrong
  if (
    attempts >= maxAttempts &&
    videoInfo.title === lastExtractedTitle &&
    lastExtractedTitle !== ""
  ) {
    console.warn(
      "[LBNG YouTube] ⚠️ Title never changed from previous video - YouTube metadata may be stuck"
    );
    console.warn(
      "[LBNG YouTube] Proceeding anyway, but result may be inaccurate"
    );
  }

  console.log("[LBNG YouTube] Final video info:", videoInfo);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "analyzeYouTubeContent",
      videoInfo: videoInfo,
    });

    console.log("[LBNG YouTube] Analysis response:", response);

    if (response && response.shouldBlock) {
      console.log("[LBNG YouTube] ❌ Content blocked:", response.reason);

      // ✅ NEW: Just keep overlay visible - background script will redirect
      blockPending = true;

      // Update overlay to show blocking message
      const goalText = document.getElementById("lbng-goal-text");
      if (goalText) {
        goalText.innerHTML = `<strong style="color: #e74c3c;">🚫 Video Blocked</strong><br>${
          response.reason || "Not relevant to your goal"
        }`;
      }

      // Background script will redirect to block page
      // Keep overlay visible during redirect
      console.log(
        "[LBNG YouTube] Waiting for background script to redirect..."
      );
    } else {
      console.log("[LBNG YouTube] ✅ Content allowed:", response?.reason);
      hideLoadingOverlay();
    }
  } catch (error) {
    console.error("[LBNG YouTube] Analysis error:", error);
    hideLoadingOverlay();
  }

  analysisInProgress = false;
}

function isVideoPage() {
  return (
    window.location.pathname === "/watch" &&
    window.location.search.includes("v=")
  );
}

// Check on script load
if (isVideoPage()) {
  console.log("[LBNG YouTube] Video page detected on load");
  showLoadingOverlay(true);
  analyzeCurrentVideo();
}

// IMPROVED: Better SPA navigation detection
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log("[LBNG YouTube] URL changed:", lastUrl, "→", currentUrl);
    lastUrl = currentUrl;

    // Reset state
    analysisInProgress = false;
    currentVideoId = null;
    blockPending = false;
    // DON'T reset lastExtractedTitle - we need it for comparison!
    hideLoadingOverlay();

    if (isVideoPage()) {
      console.log("[LBNG YouTube] New video page detected, analyzing...");
      // Longer delay for YouTube's SPA to settle
      setTimeout(() => {
        showLoadingOverlay(true);
        analyzeCurrentVideo();
      }, 200);
    } else {
      // Not a video page, reset title tracking
      lastExtractedTitle = "";
    }
  }
});

urlObserver.observe(document, { subtree: true, childList: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateOverlayGoal") {
    updateOverlayGoal(message.goal);
    sendResponse({ success: true });
  }
});

window.addEventListener("popstate", () => {
  console.log("[LBNG YouTube] Popstate event - checking URL");
  setTimeout(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      analysisInProgress = false;
      currentVideoId = null;
      blockPending = false;
      hideLoadingOverlay();

      if (isVideoPage()) {
        showLoadingOverlay(true);
        analyzeCurrentVideo();
      } else {
        lastExtractedTitle = "";
      }
    }
  }, 200);
});
