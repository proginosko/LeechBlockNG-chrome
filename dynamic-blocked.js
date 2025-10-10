console.log("[LBNG Dynamic Block] Page loaded");

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const blockedURL = urlParams.get("U") || "";
const blockSet = urlParams.get("S") || "1";
const keyword = urlParams.get("K") || "";

// Parse video info from keyword (format: "YouTube: reason" or "title | channel")
let videoTitle = "Unknown Video";
let videoChannel = "";
let aiReason = "";

if (keyword.startsWith("YouTube:")) {
    aiReason = keyword.replace("YouTube: ", "");
    // Extract from URL or use generic
    videoTitle = blockedURL.includes("youtube.com")
        ? "A YouTube Video"
        : "Unknown Content";
} else if (keyword.includes(" | ")) {
    [videoTitle, videoChannel] = keyword.split(" | ");
} else {
    videoTitle = keyword || "Unknown Video";
}

// Initialize page
async function initializePage() {
    console.log("[LBNG Dynamic Block] Initializing...");

    try {
        // Get session data
        const data = await chrome.storage.local.get([
            "aiLockdownActive",
            "aiLockdownGoal",
            "aiLockdownEndTime",
            "aiBlockStats",
            "aiStartTime",
        ]);

        console.log("[LBNG Dynamic Block] Session data:", data);

        const goal = data.aiLockdownGoal || "your goal";
        const endTime = data.aiLockdownEndTime || Date.now();
        const stats = data.aiBlockStats || {
            blocked: 0,
            allowed: 0,
            focusTimeProtected: 0,
            startTime: Date.now(),
        };

        // Update basic info
        updateEvidence(goal, videoTitle, videoChannel, endTime);
        updateStats(stats);
        updateStreak(stats);

        // Generate AI content
        await generateRoast(goal, videoTitle, videoChannel, stats.blocked);
        setAvatarByBlockCount(stats.blocked || 0);
        await generateAlternatives(goal);
        await generateQuote(goal, stats.blocked);

        // Setup interactions
        setupReflection(goal);
        setupActions();
    } catch (error) {
        console.error("[LBNG Dynamic Block] Initialization error:", error);
        showFallbackContent();
    }
}

// Update evidence section
function updateEvidence(goal, title, channel, endTime) {
    document.getElementById("userGoal").textContent = goal;
    document.getElementById("blockedTitle").textContent = title;

    if (channel) {
        document.getElementById(
            "blockedChannel"
        ).textContent = `Channel: ${channel}`;
    }

    const timeLeft = getTimeRemaining(endTime);
    document.getElementById("timeLeft").textContent = timeLeft;

    // Update time every minute
    setInterval(() => {
        document.getElementById("timeLeft").textContent =
            getTimeRemaining(endTime);
    }, 60000);
}

// Update stats
function updateStats(stats) {
    const blocked = stats.blocked || 0;
    const allowed = stats.allowed || 0;
    const total = blocked + allowed;
    const successRate = total > 0 ? Math.round((allowed / total) * 100) : 0;

    // Calculate focus time protected (assume 10 min average per blocked video)
    const focusTimeProtected = blocked * 10;

    // Animate values
    animateValue("blockedCount", 0, blocked, 1000);
    animateValue("allowedCount", 0, allowed, 1000);
    animateValue("successRate", 0, successRate, 1000, "%");

    document.getElementById("focusTime").textContent = `${focusTimeProtected}m`;

    // Update progress bar
    const progressFill = document.getElementById("progressFill");
    setTimeout(() => {
        progressFill.style.width = `${successRate}%`;
    }, 100);
}

// Update streak
function updateStreak(stats) {
    if (stats.startTime) {
        const streakMs = Date.now() - stats.startTime;
        const hours = Math.floor(streakMs / (1000 * 60 * 60));
        const minutes = Math.floor((streakMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0 || minutes > 0) {
            document.getElementById("streakSection").style.display = "block";
            document.getElementById("streakValue").textContent =
                hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
    }
}

// Generate AI roast
async function generateRoast(goal, title, channel, blockCount) {
    const roastEl = document.getElementById("roastText");

    try {
        console.log("[LBNG Dynamic Block] Requesting roast generation...");

        const response = await chrome.runtime.sendMessage({
            type: "generateRoast",
            goal: goal,
            blockedTitle: title,
            blockedChannel: channel,
            blockCount: blockCount,
        });

        console.log("[LBNG Dynamic Block] Roast response:", response);

        if (response && response.roast) {
            typeWriter(roastEl, response.roast, 40);
            updateAvatarMood("roast");
        } else {
            roastEl.textContent = getFallbackRoast(goal, title, blockCount);
        }
    } catch (error) {
        console.error("[LBNG Dynamic Block] Roast generation error:", error);
        roastEl.textContent = getFallbackRoast(goal, title, blockCount);
    }
}

// Fallback roasts
function getFallbackRoast(goal, title, blockCount) {
    const roasts = [
        `Really? "${title}" while trying to ${goal}? Bold strategy, Cotton. 😏`,
        `I see we're taking a very... creative approach to "${goal}" today. 🤔`,
        `Plot twist: This video won't help you ${goal}. Shocking revelation, I know. 🎭`,
        `"${title}" ≠ ${goal}. The math checks out. 🧮`,
        `Interesting choice. Very interesting. (It's not.) 🤨`,
        `Your future self called. They're disappointed. 📞`,
        `This is your ${
            blockCount > 1 ? blockCount + "th" : "1st"
        } distraction today. We're keeping score. 📊`,
    ];

    if (blockCount >= 5) {
        return `Okay, this is getting ridiculous. That's ${blockCount} distractions blocked today. FIVE! Are we even trying anymore? 😤`;
    }

    if (blockCount >= 3) {
        return `Third time's the charm? No. No it's not. Get back to ${goal}. 😐`;
    }

    return roasts[Math.floor(Math.random() * roasts.length)];
}

// Generate alternatives
async function generateAlternatives(goal) {
    const listEl = document.getElementById("suggestionsList");

    try {
        console.log("[LBNG Dynamic Block] Requesting alternatives...");

        const response = await chrome.runtime.sendMessage({
            type: "generateAlternatives",
            goal: goal,
        });

        console.log("[LBNG Dynamic Block] Alternatives response:", response);

        if (
            response &&
            response.suggestions &&
            response.suggestions.length > 0
        ) {
            listEl.innerHTML = response.suggestions
                .map(
                    (video, index) => `
                <a href="${
                    video.url
                }" class="suggestion-item" target="_blank" rel="noopener noreferrer">
                    <div class="suggestion-icon">🎥</div>
                    <div class="suggestion-content">
                        <div class="suggestion-title">${video.title}</div>
                        <div class="suggestion-meta">${
                            video.channel || "Educational Content"
                        }</div>
                    </div>
                </a>
            `
                )
                .join("");
        } else {
            // Fallback: generic YouTube search
            listEl.innerHTML = `
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(
                    goal + " tutorial"
                )}" 
                   class="suggestion-item" target="_blank">
                    <div class="suggestion-icon">🔍</div>
                    <div class="suggestion-content">
                        <div class="suggestion-title">Search for "${goal}" tutorials</div>
                        <div class="suggestion-meta">Find relevant educational content</div>
                    </div>
                </a>
            `;
        }
    } catch (error) {
        console.error("[LBNG Dynamic Block] Alternatives error:", error);
        listEl.innerHTML = `
            <a href="https://www.youtube.com/" class="suggestion-item" target="_blank">
                <div class="suggestion-icon">🏠</div>
                <div class="suggestion-content">
                    <div class="suggestion-title">Return to YouTube Home</div>
                    <div class="suggestion-meta">Find something productive</div>
                </div>
            </a>
        `;
    }
}

// Generate quote
async function generateQuote(goal, blockCount) {
    const quoteEl = document.getElementById("quoteText");

    try {
        const response = await chrome.runtime.sendMessage({
            type: "generateQuote",
            goal: goal,
            blockCount: blockCount,
        });

        if (response && response.quote) {
            quoteEl.textContent = response.quote;
        } else {
            quoteEl.textContent = getFallbackQuote(goal);
        }
    } catch (error) {
        console.error("[LBNG Dynamic Block] Quote error:", error);
        quoteEl.textContent = getFallbackQuote(goal);
    }
}

function getFallbackQuote(goal) {
    const quotes = [
        `"The road to ${goal} is paved with unclicked distractions."`,
        `"Every blocked video is a step closer to ${goal}."`,
        `"Your goals are closer than the YouTube recommendation algorithm."`,
        `"Focus is not a gift, it's a skill. You're building it right now."`,
        `"The best time to ${goal} was yesterday. The second best time is now."`,
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
}

// Setup reflection interaction
function setupReflection(goal) {
    const buttons = document.querySelectorAll(".reflection-btn");
    const responseDiv = document.getElementById("reflectionResponse");
    const responseText = document.getElementById("responseText");

    buttons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            // Remove previous selection
            buttons.forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");

            const reason = btn.dataset.reason;

            // Show loading
            responseDiv.style.display = "flex";
            responseText.textContent = "Thinking...";

            try {
                const response = await chrome.runtime.sendMessage({
                    type: "generateReflectionResponse",
                    goal: goal,
                    reason: reason,
                });

                if (response && response.advice) {
                    responseText.textContent = response.advice;
                } else {
                    responseText.textContent = getFallbackReflectionResponse(
                        reason,
                        goal
                    );
                }
            } catch (error) {
                responseText.textContent = getFallbackReflectionResponse(
                    reason,
                    goal
                );
            }

            // Track the reflection
            trackReflection(reason);
        });
    });
}

function getFallbackReflectionResponse(reason, goal) {
    const responses = {
        break: `Breaks are important! But maybe try a 5-minute walk instead of YouTube? Your brain (and ${goal}) will thank you. 🚶‍♂️`,
        auto: `Autopilot mode is sneaky! Try asking yourself "Does this help me ${goal}?" before each click. Build that awareness muscle! 💪`,
        curious: `Curiosity is great... when it's about ${goal}! Channel that energy toward learning something relevant instead. 🧠`,
        "thought-educational": `The algorithm is tricky! It WANTS you to think everything is educational. Trust your AI guardian to filter the noise. 🛡️`,
    };
    return responses[reason] || `Stay focused on ${goal}. You've got this! 💪`;
}

// Setup action buttons
function setupActions() {
    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "https://www.youtube.com/";
    });
}

// Utility: Typewriter effect
function typeWriter(element, text, speed = 30) {
    element.textContent = "";
    let i = 0;

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }

    type();
}

// Utility: Animate number values
function animateValue(elementId, start, end, duration, suffix = "") {
    const element = document.getElementById(elementId);
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (
            (increment > 0 && current >= end) ||
            (increment < 0 && current <= end)
        ) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current) + suffix;
    }, 16);
}

// Utility: Time remaining
function getTimeRemaining(endTime) {
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) {
        return "Session ended";
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Utility: Update avatar mood
function updateAvatarMood(mood) {
    // Use image avatar only - map mood to anger level images
    const img = document.querySelector(".ai-avatar .profile-icon img");
    if (!img) return;
    const moodToSrc = {
        roast: "images/anger-level/owl-angry-level-3.png",
        disappointed: "images/anger-level/owl-angry-level-2.png",
        proud: "images/anger-level/owl-angry-level-1.png",
        strict: "images/anger-level/owl-angry-level-4.png",
        angry: "images/anger-level/owl-angry-level-5.png",
        frustrated: "images/anger-level/owl-angry-level-3.png",
        warning: "images/anger-level/owl-angry-level-2.png",
        calm: "images/anger-level/owl-angry-level-1.png",
    };
    if (moodToSrc[mood]) img.src = moodToSrc[mood];
}

// Dynamic avatar by distraction count (blockCount)
function setAvatarByBlockCount(blockCount) {
    const img = document.querySelector(".ai-avatar .profile-icon img");
    if (!img) return;
    // Build path based on anger level assets
    // 0 -> neutral owl.png, 1..5 -> owl-angry-level-{level}.png (capped at 5)
    const baseDir = "images/anger-level";
    let src = "images/owl.png"; // Default neutral owl
    if (blockCount > 0) {
        const level = Math.min(Math.max(blockCount, 1), 5);
        src = `${baseDir}/owl-angry-level-${level}.png`;
    }
    img.src = src;
}

// Track reflection for analytics
async function trackReflection(reason) {
    try {
        await chrome.runtime.sendMessage({
            type: "trackReflection",
            reason: reason,
        });
    } catch (error) {
        console.error("[LBNG Dynamic Block] Tracking error:", error);
    }
}

// Fallback content on error
function showFallbackContent() {
    document.getElementById("roastText").textContent =
        "Nice try with that distraction! But we're staying focused today. 😤";
    document.getElementById("userGoal").textContent = "your goal";
    document.getElementById("blockedTitle").textContent = videoTitle;
    document.getElementById("timeLeft").textContent = "Unknown";
}

// Initialize on load
document.addEventListener("DOMContentLoaded", initializePage);
