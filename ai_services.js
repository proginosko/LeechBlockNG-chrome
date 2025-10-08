// A helper to get settings from storage, ensuring we always have the latest key.
async function getAiOptions() {
  return new Promise((resolve) => {
      chrome.storage.local.get(['isAiEnabled', 'apiKey', 'aiBlockSet'], resolve);
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
  
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  const prompt = `A user's goal is to "${userGoal}". What are 10 common websites that would be a distraction from this specific goal? Return only a space-separated list of the base domain names (e.g., "youtube.com twitter.com espn.com"). Do not include any other text, explanation, or commas.`;

  try {
      const response = await fetch(`${API_URL}?key=${options.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const rawResponse = data.candidates[0].content.parts[0].text.trim();
      return rawResponse.split(/\s+/).filter(site => site.includes('.'));
  } catch (error) {
      console.error('[LBNG AI] Error getting initial blocklist:', error);
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

  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  const prompt = `A user is trying to focus on the goal: "${userGoal}". Is visiting the website at the URL "${url}" a distraction from this specific goal? Answer with only a single word: "Yes" or "No".`;

  try {
      const response = await fetch(`${API_URL}?key=${options.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const classification = data.candidates[0].content.parts[0].text.trim().toLowerCase();
      return classification.startsWith('yes');
  } catch (error) {
      console.error('[LBNG AI] Error classifying URL for goal:', error);
      return false; // Default to not a distraction on error
  }
}