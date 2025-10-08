// youtube-content.js - UPDATED VERSION

console.log("[LBNG YouTube] Content script loaded");

let analysisInProgress = false;
let overlayElement = null;
let currentVideoId = null;

// Create and show loading overlay IMMEDIATELY
function showLoadingOverlay(immediate = false) {
    if (overlayElement) return; // Already showing

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

// Remove loading overlay
function hideLoadingOverlay() {
    if (overlayElement) {
        overlayElement.remove();
        overlayElement = null;
        console.log("[LBNG YouTube] Overlay hidden");
    }
}

// Update overlay with goal text
function updateOverlayGoal(goal) {
    const goalText = document.getElementById('lbng-goal-text');
    if (goalText && goal) {
        goalText.innerHTML = `Checking if this video matches your goal:<br><strong>${goal}</strong>`;
    }
}

// Extract video ID from URL
function getVideoIdFromUrl(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
}

// Extract video information from the page
function extractVideoInfo() {
    const videoId = getVideoIdFromUrl(window.location.href);
    
    if (!videoId) {
        return null;
    }

    let title = '';
    let channelName = '';
    let description = '';

    // Try multiple selectors for title
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

    // Try multiple selectors for channel
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

    // Get description from meta tag
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

// Main analysis function
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
    
    // If same video, don't re-analyze
    if (videoId === currentVideoId) {
        console.log("[LBNG YouTube] Same video, skipping re-analysis");
        return;
    }
    
    currentVideoId = videoId;
    analysisInProgress = true;
    
    console.log("[LBNG YouTube] Starting analysis for video:", videoId);

    // SHOW OVERLAY IMMEDIATELY - don't wait
    showLoadingOverlay(true);

    // Give page a moment to load metadata
    await new Promise(resolve => setTimeout(resolve, 500));

    // Extract video info
    let videoInfo = extractVideoInfo();
    
    // If title not available yet, wait a bit more
    if (!videoInfo || !videoInfo.title) {
        console.log("[LBNG YouTube] Waiting for video metadata to load...");
        await new Promise(resolve => setTimeout(resolve, 1500));
        videoInfo = extractVideoInfo();
    }

    if (!videoInfo || !videoInfo.videoId) {
        console.log("[LBNG YouTube] Could not extract video info, allowing by default");
        hideLoadingOverlay();
        analysisInProgress = false;
        return;
    }

    console.log("[LBNG YouTube] Video info extracted:", videoInfo);

    // Send to background for analysis
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'analyzeYouTubeContent',
            videoInfo: videoInfo
        });

        console.log("[LBNG YouTube] Analysis response:", response);

        if (response && response.shouldBlock) {
            // Content is a distraction - redirect
            console.log("[LBNG YouTube] ❌ Content blocked:", response.reason);
            
            // Keep overlay visible during redirect
            const blockURL = response.blockURL || chrome.runtime.getURL('blocked.html');
            window.location.href = blockURL;
        } else {
            // Content is allowed - remove overlay
            console.log("[LBNG YouTube] ✅ Content allowed:", response?.reason);
            hideLoadingOverlay();
        }
    } catch (error) {
        console.error("[LBNG YouTube] Analysis error:", error);
        // On error, hide overlay and allow (fail open)
        hideLoadingOverlay();
    }

    analysisInProgress = false;
}

// Detect video page IMMEDIATELY
function isVideoPage() {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
}

// Check on script load
if (isVideoPage()) {
    console.log("[LBNG YouTube] Video page detected on load");
    // Show overlay IMMEDIATELY, even before page loads
    showLoadingOverlay(true);
    // Start analysis
    analyzeCurrentVideo();
}

// Listen for URL changes (YouTube is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("[LBNG YouTube] URL changed to:", currentUrl);
        
        // Reset state
        analysisInProgress = false;
        currentVideoId = null;
        hideLoadingOverlay();
        
        // Check if new URL is a watch page
        if (isVideoPage()) {
            // Show overlay immediately for new video
            showLoadingOverlay(true);
            analyzeCurrentVideo();
        }
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateOverlayGoal') {
        updateOverlayGoal(message.goal);
        sendResponse({ success: true });
    }
});