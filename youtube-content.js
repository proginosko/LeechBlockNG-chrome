console.log("[LBNG YouTube] Content script loaded");

let analysisInProgress = false;
let overlayElement = null;
let currentVideoId = null;
let blockPending = false;
let lastExtractedTitle = "";
let focusModeActive = false;
let filterStyleElement = null;

// ==========================================
// CHECK IF AI FOCUS MODE IS ACTIVE
// ==========================================
async function checkFocusMode() {
    try {
        const data = await chrome.storage.local.get([
            'aiLockdownActive',
            'aiLockdownEndTime',
            'aiLockdownGoal'
        ]);
        
        const isActive = data.aiLockdownActive && Date.now() < data.aiLockdownEndTime;
        
        if (isActive !== focusModeActive) {
            focusModeActive = isActive;
            
            if (focusModeActive) {
                console.log("[LBNG YouTube] 🎯 AI Focus Mode ACTIVE");
                applyYouTubeFilters();
                blockShortsIfNeeded();
            } else {
                console.log("[LBNG YouTube] ✅ AI Focus Mode INACTIVE");
                removeYouTubeFilters();
            }
        }
        
        return isActive;
    } catch (error) {
        console.error("[LBNG YouTube] Error checking focus mode:", error);
        return false;
    }
}

// ==========================================
// APPLY YOUTUBE CONTENT FILTERS
// ==========================================
function applyYouTubeFilters() {
  if (filterStyleElement) return; // Already applied
  
  console.log("[LBNG YouTube] 🎨 Applying Zen Mode filters...");
  
  // Inject CSS to hide distractions
  filterStyleElement = document.createElement('style');
  filterStyleElement.id = 'lbng-youtube-filter';
  filterStyleElement.textContent = `
      /* ===================================
         LBNG YOUTUBE ZEN MODE
         Complete distraction elimination
         =================================== */

      /* ========== HIDE SIDEBAR COMPLETELY ========== */
      #guide,
      #guide-wrapper,
      #guide-content,
      ytd-guide-renderer,
      ytd-mini-guide-renderer,
      tp-yt-app-drawer {
          display: none !important;
      }

      /* Hide sidebar toggle button */
      #guide-button,
      ytd-guide-button {
          display: none !important;
      }

      /* Expand content to use full width */
      ytd-page-manager {
          margin-left: 0 !important;
      }

      #primary,
      #secondary {
          margin-left: 0 !important;
      }

      /* ========== HOME PAGE ========== */
      /* Hide entire home feed */
      ytd-browse[page-subtype="home"] #primary,
      ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer,
      ytd-browse[page-subtype="subscriptions"] #primary,
      ytd-browse[page-subtype="subscriptions"] ytd-two-column-browse-results-renderer {
          display: none !important;
      }

      /* Hide Shorts shelf everywhere */
      ytd-reel-shelf-renderer,
      ytd-rich-shelf-renderer[is-shorts],
      ytd-guide-entry-renderer a[title="Shorts"],
      ytd-mini-guide-entry-renderer a[title="Shorts"],
      a[title="Shorts"] {
          display: none !important;
      }

      /* ========== VIDEO PAGE ========== */
      /* Hide sidebar recommendations */
      #related,
      #secondary {
          display: none !important;
      }

      /* Make video player use full width */
      #primary {
          max-width: 100% !important;
      }

      #primary-inner {
          padding-right: 0 !important;
      }

      /* Hide end screens and suggestions */
      .ytp-ce-element,
      .ytp-endscreen-content,
      .ytp-suggestion-set,
      .ytp-autonav-endscreen-upnext-container {
          display: none !important;
      }

      /* Hide autoplay */
      #secondary ytd-compact-autoplay-renderer,
      ytd-compact-autoplay-renderer {
          display: none !important;
      }

      /* ========== NOTIFICATIONS & DISTRACTIONS ========== */
      /* Hide notification bell */
      ytd-notification-topbar-button-renderer {
          display: none !important;
      }

      /* Hide "Create" button */
      ytd-topbar-menu-button-renderer:has(a[href*="/upload"]) {
          display: none !important;
      }

      /* ========== TRENDING & EXPLORE ========== */
      ytd-browse[page-subtype="trending"],
      ytd-browse[page-subtype="explore"] {
          display: none !important;
      }

      /* ========== ZEN MODE INDICATORS ========== */
      /* Show focus mode message on home page */
      ytd-browse[page-subtype="home"]::before {
          content: "🧘‍♂️ Zen Mode Active";
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          height: 60vh;
          font-size: 40px;
          font-weight: 700;
          color: #606060;
          font-family: "YouTube Sans", "Roboto", sans-serif;
          margin-top: 10vh;
      }

      ytd-browse[page-subtype="home"]::after {
          content: "Use the search bar above to find content relevant to your goal";
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: #909090;
          margin-top: -45vh;
          padding-top: 60px;
          font-family: "YouTube Sans", "Roboto", sans-serif;
      }

      /* Subscriptions page message */
      ytd-browse[page-subtype="subscriptions"]::before {
          content: "🧘‍♂️ Zen Mode Active";
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          height: 60vh;
          font-size: 40px;
          font-weight: 700;
          color: #606060;
          font-family: "YouTube Sans", "Roboto", sans-serif;
          margin-top: 10vh;
      }

      ytd-browse[page-subtype="subscriptions"]::after {
          content: "Subscription feeds are hidden during focus mode";
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: #909090;
          margin-top: -45vh;
          padding-top: 60px;
          font-family: "YouTube Sans", "Roboto", sans-serif;
      }

      /* ========== KEEP ESSENTIAL ELEMENTS ========== */
      /* Keep top bar (masthead) with search */
      #masthead-container,
      ytd-masthead,
      #container.ytd-masthead,
      #search,
      #search-form,
      #search-icon-legacy,
      ytd-searchbox {
          display: flex !important;
          visibility: visible !important;
      }

      /* Keep YouTube logo clickable */
      #logo,
      ytd-logo,
      #logo-icon {
          display: flex !important;
          visibility: visible !important;
      }

      /* Keep user account menu */
      #avatar-btn,
      ytd-topbar-menu-button-renderer:last-child {
          display: flex !important;
          visibility: visible !important;
      }

      /* ========== SEARCH RESULTS ========== */
      /* Keep search results fully visible - they're intentional */
      ytd-search {
          display: block !important;
      }

      ytd-search #primary {
          display: block !important;
      }

      /* ========== COMMENTS ========== */
      /* Keep comments - can be educational */
      #comments {
          display: block !important;
      }

      /* ========== FOCUS MODE BADGE ========== */
      /* Add visual indicator to top bar */
      #masthead-container #end::after {
          content: "🎯 FOCUS MODE";
          position: absolute;
          right: 80px;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
          z-index: 2100;
          font-family: "YouTube Sans", "Roboto", sans-serif;
      }
  `;
  
  document.documentElement.appendChild(filterStyleElement);
  console.log("[LBNG YouTube] ✅ Zen Mode filters applied");
}

// ==========================================
// REMOVE YOUTUBE CONTENT FILTERS
// ==========================================
function removeYouTubeFilters() {
    if (filterStyleElement) {
        filterStyleElement.remove();
        filterStyleElement = null;
        console.log("[LBNG YouTube] ❌ Content filters removed");
    }
}

// ==========================================
// BLOCK YOUTUBE SHORTS
// ==========================================
async function blockShortsIfNeeded() {
    const isShortsPage = window.location.pathname.startsWith('/shorts/');
    
    if (isShortsPage && focusModeActive) {
        console.log("[LBNG YouTube] 🚫 Blocking YouTube Shorts");
        
        try {
            const data = await chrome.storage.local.get(['aiLockdownGoal', 'aiBlockSet']);
            const goal = data.aiLockdownGoal || 'your goal';
            const aiBlockSet = data.aiBlockSet || 1;
            
            // Construct block URL
            const blockURL = chrome.runtime.getURL('dynamic-blocked.html') +
                `?S=${aiBlockSet}` +
                `&U=${encodeURIComponent(window.location.href)}` +
                `&K=${encodeURIComponent('YouTube Shorts | Distraction')}`;
            
            // Redirect to block page
            window.location.replace(blockURL);
        } catch (error) {
            console.error("[LBNG YouTube] Error blocking Shorts:", error);
        }
    }
}

// ==========================================
// OVERLAY FUNCTIONS
// ==========================================
function showLoadingOverlay(immediate = false) {
    if (overlayElement) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'lbng-youtube-overlay';
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
    const goalText = document.getElementById('lbng-goal-text');
    if (goalText && goal) {
        goalText.innerHTML = `Checking if this video matches your goal:<br><strong>${goal}</strong>`;
    }
}

// ==========================================
// VIDEO INFO EXTRACTION
// ==========================================
function getVideoIdFromUrl(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
}

function extractVideoInfo() {
    const videoId = getVideoIdFromUrl(window.location.href);
    
    if (!videoId) {
        return null;
    }

    let title = '';
    let channelName = '';
    let description = '';

    const titleSelectors = [
        'meta[name="title"]',
        'h1.ytd-watch-metadata yt-formatted-string',
        'h1.title yt-formatted-string',
        'h1 yt-formatted-string'
    ];

    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            title = element.getAttribute('content') || element.textContent || '';
            if (title) break;
        }
    }

    const channelSelectors = [
        'ytd-channel-name a',
        'ytd-video-owner-renderer ytd-channel-name a',
        '#owner-name a',
        'link[itemprop="name"]'
    ];

    for (const selector of channelSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            channelName = element.getAttribute('content') || element.textContent || '';
            if (channelName) break;
        }
    }

    const descElement = document.querySelector('meta[name="description"]');
    if (descElement) {
        description = descElement.getAttribute('content') || '';
    }

    return {
        videoId,
        url: window.location.href,
        title: title.trim(),
        channelName: channelName.trim(),
        description: description.trim().substring(0, 300)
    };
}

// ==========================================
// VIDEO ANALYSIS
// ==========================================
async function analyzeCurrentVideo() {
    // Check if focus mode is active first
    const isFocusActive = await checkFocusMode();
    if (!isFocusActive) {
        console.log("[LBNG YouTube] Focus mode not active, skipping analysis");
        return;
    }
    
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

    let videoInfo = null;
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
        const delay = attempts === 0 ? 800 : 600;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        videoInfo = extractVideoInfo();
        
        if (videoInfo && videoInfo.title && videoInfo.title.trim().length > 0) {
            if (videoInfo.title !== lastExtractedTitle || attempts === 0) {
                console.log("[LBNG YouTube] ✅ Got NEW video metadata on attempt", attempts + 1);
                console.log("[LBNG YouTube] Title:", videoInfo.title);
                lastExtractedTitle = videoInfo.title;
                
                if (attempts < 2) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    const recheck = extractVideoInfo();
                    if (recheck && recheck.title === videoInfo.title) {
                        console.log("[LBNG YouTube] ✅ Title verified stable");
                        break;
                    } else {
                        console.log("[LBNG YouTube] ⚠️ Title changed during verification, waiting...");
                        attempts++;
                        continue;
                    }
                } else {
                    break;
                }
            } else {
                console.log("[LBNG YouTube] ⏳ Title unchanged from previous video, waiting... attempt", attempts + 1);
            }
        } else {
            console.log("[LBNG YouTube] ⏳ No title yet... attempt", attempts + 1);
        }
        
        attempts++;
    }

    if (!videoInfo || !videoInfo.videoId) {
        console.log("[LBNG YouTube] Could not extract video info, allowing by default");
        hideLoadingOverlay();
        analysisInProgress = false;
        return;
    }

    if (!videoInfo.title || videoInfo.title.trim().length === 0) {
        console.log("[LBNG YouTube] No title available after", maxAttempts, "attempts, allowing");
        hideLoadingOverlay();
        analysisInProgress = false;
        return;
    }

    console.log("[LBNG YouTube] Final video info:", videoInfo);

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'analyzeYouTubeContent',
            videoInfo: videoInfo
        });

        console.log("[LBNG YouTube] Analysis response:", response);

        if (response && response.shouldBlock) {
            console.log("[LBNG YouTube] ❌ Content blocked:", response.reason);
            
            blockPending = true;
            
            const goalText = document.getElementById('lbng-goal-text');
            if (goalText) {
                goalText.innerHTML = `<strong style="color: #e74c3c;">🚫 Video Blocked</strong><br>${response.reason || 'Not relevant to your goal'}`;
            }
            
            console.log("[LBNG YouTube] Waiting for background script to redirect...");
            
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

// ==========================================
// PAGE TYPE DETECTION
// ==========================================
function isVideoPage() {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
}

function isShortsPage() {
    return window.location.pathname.startsWith('/shorts/');
}

function isHomePage() {
    return window.location.pathname === '/' || window.location.pathname === '/feed/subscriptions';
}

// ==========================================
// INITIALIZATION
// ==========================================
(async function init() {
    // Check focus mode on load
    await checkFocusMode();
    
    // Block Shorts if needed
    if (isShortsPage()) {
        await blockShortsIfNeeded();
        return; // Don't continue if we're redirecting
    }
    
    // Analyze video if on watch page
    if (isVideoPage() && focusModeActive) {
        console.log("[LBNG YouTube] Video page detected on load");
        showLoadingOverlay(true);
        analyzeCurrentVideo();
    }
})();

// ==========================================
// URL CHANGE DETECTION (SPA Navigation)
// ==========================================
let lastUrl = location.href;
const urlObserver = new MutationObserver(async () => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        console.log("[LBNG YouTube] URL changed:", lastUrl, "→", currentUrl);
        lastUrl = currentUrl;
        
        // Check focus mode status
        await checkFocusMode();
        
        // Reset state
        analysisInProgress = false;
        currentVideoId = null;
        blockPending = false;
        hideLoadingOverlay();
        
        // Block Shorts
        if (isShortsPage()) {
            await blockShortsIfNeeded();
            return;
        }
        
        // Analyze video
        if (isVideoPage() && focusModeActive) {
            console.log("[LBNG YouTube] New video page detected, analyzing...");
            setTimeout(() => {
                showLoadingOverlay(true);
                analyzeCurrentVideo();
            }, 200);
        } else if (!isVideoPage()) {
            lastExtractedTitle = "";
        }
    }
});

urlObserver.observe(document, { subtree: true, childList: true });

// ==========================================
// MESSAGE LISTENER
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateOverlayGoal') {
        updateOverlayGoal(message.goal);
        sendResponse({ success: true });
    } else if (message.type === 'focusModeChanged') {
        checkFocusMode();
        sendResponse({ success: true });
    }
});

// ==========================================
// POPSTATE LISTENER (Back/Forward buttons)
// ==========================================
window.addEventListener('popstate', async () => {
    console.log("[LBNG YouTube] Popstate event - checking URL");
    setTimeout(async () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            await checkFocusMode();
            analysisInProgress = false;
            currentVideoId = null;
            blockPending = false;
            hideLoadingOverlay();
            
            if (isShortsPage()) {
                await blockShortsIfNeeded();
            } else if (isVideoPage() && focusModeActive) {
                showLoadingOverlay(true);
                analyzeCurrentVideo();
            } else {
                lastExtractedTitle = "";
            }
        }
    }, 200);
});

// ==========================================
// STORAGE CHANGE LISTENER
// ==========================================
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.aiLockdownActive || changes.aiLockdownEndTime)) {
        console.log("[LBNG YouTube] Focus mode state changed, rechecking...");
        checkFocusMode();
    }
});

console.log("[LBNG YouTube] ✅ Enhanced content script initialized");