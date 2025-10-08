// A helper to get settings from storage, ensuring we always have the latest key.
async function getAiOptions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["isAiEnabled", "apiKey", "aiBlockSet"], resolve);
  });
}

/**
 * Generates an initial list of common distractions based on the user's goal.
 * @param {string} userGoal - The user's core task (e.g., "code", "write an essay").
 * @returns {Promise<string[]>} - An array of domain names to block.
 */
async function getInitialBlocklistForGoal(userGoal) {
  const options = await getAiOptions();
  if (!options.isAiEnabled || !options.apiKey) {
    console.warn("[LBNG AI] AI features disabled or API key missing.");
    return [];
  }

  const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const prompt = `A user wants to focus on: "${userGoal}"

    List 10-15 websites that would be DISTRACTIONS or PROCRASTINATION for this specific goal.
    
    IMPORTANT RULES:
    - ONLY include entertainment, social media, news, gaming, and time-wasting sites
    - DO NOT include educational resources, documentation, or professional tools needed for the goal
    - DO NOT include AI assistants, coding tools, research sites, or learning platforms
    - DO NOT include YouTube, Reddit, or Twitter (these will be handled with smart content filtering)
    
    Examples of what TO BLOCK: facebook.com, instagram.com, tiktok.com, netflix.com, twitch.tv, espn.com
    Examples of what NOT to block: github.com, stackoverflow.com, gemini.google.com, chatgpt.com, youtube.com
    
    Return ONLY the domain names in a space-separated list, no explanations or other text.
    
    Distraction domains:`;
  try {
    const response = await fetch(`${API_URL}?key=${options.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const rawResponse = data.candidates[0].content.parts[0].text.trim();
    return rawResponse.split(/\s+/).filter((site) => site.includes("."));
  } catch (error) {
    console.error("[LBNG AI] Error getting initial blocklist:", error);
    return [];
  }
}

/**
 * Dynamically classifies if a URL is a distraction *given the user's current goal*.
 * @param {string} url - The URL of the page to classify.
 * @param {string} userGoal - The user's stored goal (e.g., "code").
 * @returns {Promise<boolean>} - True if the URL is a distraction from the goal.
 */
async function classifyUrlForGoal(url, userGoal) {
  const options = await getAiOptions();
  if (!options.isAiEnabled || !options.apiKey) {
    return false;
  }

  const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const prompt = `A user is trying to focus on: "${userGoal}". 

Is visiting "${url}" a DISTRACTION (entertainment, social media, procrastination) from this goal?

IMPORTANT: AI assistants, educational sites, and professional tools are NOT distractions.

Answer with ONLY one word: "Yes" or "No"`;

  try {
    const response = await fetch(`${API_URL}?key=${options.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const classification = data.candidates[0].content.parts[0].text
      .trim()
      .toLowerCase();
    return classification.startsWith("yes");
  } catch (error) {
    console.error("[LBNG AI] Error classifying URL for goal:", error);
    return false; // Default to not a distraction on error
  }
}

/**
 * Analyzes YouTube video content to determine if it matches the user's goal.
 * @param {Object} videoInfo - Video metadata
 * @param {string} userGoal - The user's focus goal
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{isAllowed: boolean, reason: string}>}
 */
async function analyzeYouTubeContent(videoInfo, userGoal, apiKey) {
  console.log("[LBNG AI Services] analyzeYouTubeContent called:", {
    videoInfo,
    userGoal,
  });

  const { title, channelName, description } = videoInfo;

  // Quick check: if no title, can't analyze
  if (!title) {
    console.warn("[LBNG AI Services] No title available, defaulting to allow");
    return { isAllowed: true, reason: "No title to analyze" };
  }

  const prompt = `User's Focus Goal: "${userGoal}"

YouTube Video Information:
- Title: "${title}"
- Channel: "${channelName}"
- Description: "${description}"

Task: Determine if this video content is HELPFUL or a DISTRACTION for the user's goal.

Rules:
1. ALLOW if the video is directly educational, relevant, or useful for the goal
2. ALLOW if it's a tutorial, lesson, or informational content related to the goal
3. BLOCK if it's entertainment, unrelated content, or procrastination
4. BLOCK if it's gaming, comedy, vlogs, or general entertainment
5. When uncertain, prefer ALLOW for educational-looking content

Respond with ONLY one word: "ALLOW" or "BLOCK"

Answer:`;

  const model = "gemini-2.5-flash"; // UPDATED MODEL
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  console.log(`[LBNG AI Services] Using API endpoint: ${API_URL}`);

  try {
    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    };

    console.log("[LBNG AI Services] Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    console.log("[LBNG AI Services] Response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[LBNG AI Services] API Error Response:", errorData);
      return { 
        isAllowed: true, 
        reason: `API error: ${response.status}` 
      };
    }

    const data = await response.json();
    console.log("[LBNG AI Services] Full API Response:", JSON.stringify(data, null, 2));

    // MORE ROBUST TEXT EXTRACTION
    let text = null;
    
    // Try to extract text from various possible locations
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      console.log("[LBNG AI Services] First candidate:", candidate);
      
      // Check if there's a finishReason that might indicate blocking
      if (candidate.finishReason) {
        console.log("[LBNG AI Services] Finish reason:", candidate.finishReason);
      }
      
      // Check for safety ratings
      if (candidate.safetyRatings) {
        console.log("[LBNG AI Services] Safety ratings:", candidate.safetyRatings);
      }
      
      // Try to get text
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        text = candidate.content.parts[0].text;
      }
    }

    if (!text) {
      console.warn("[LBNG AI Services] No text in response");
      console.warn("[LBNG AI Services] This might be due to:");
      console.warn("  1. Safety filters blocking the response");
      console.warn("  2. Invalid API key");
      console.warn("  3. Quota exceeded");
      console.warn("  4. Model not available");
      
      // Fail open - allow content
      return { 
        isAllowed: true, 
        reason: "Analysis failed (no response text), defaulting to allow" 
      };
    }

    const decision = text.trim().toUpperCase();
    const isAllowed = decision.includes("ALLOW");

    console.log("[LBNG AI Services] YouTube analysis result:", {
      title,
      goal: userGoal,
      rawResponse: text,
      decision,
      isAllowed,
    });

    return {
      isAllowed,
      reason: isAllowed
        ? `Content appears relevant to: ${userGoal}`
        : `Content not relevant to: ${userGoal}`,
    };
  } catch (error) {
    console.error(`[LBNG AI Services] Exception during analysis:`, error);
    
    // Fail open - allow content if analysis fails
    return { 
      isAllowed: true, 
      reason: "Analysis exception: " + error.message 
    };
  }
}
