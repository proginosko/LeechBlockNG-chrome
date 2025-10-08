// ai_service.js

const API_KEY = "AIzaSyAwseltM54QYjazceWSFQLna29v5kqnCCA"; // Replace with your API key
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function classifyUrl(url) {
  const prompt = `Is the following URL a distraction? Answer with "yes" or "no". URL: ${url}`;

  try {
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    console.log(response);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const classification = data.candidates[0].content.parts[0].text.trim().toLowerCase();
    return classification === 'yes';
  } catch (error) {
    console.error('Error classifying URL:', error);
    return false; // Default to not a distraction on error
  }
}

async function getBlockingRules(userPlan) {
    const prompt = `Based on the following user plan, provide a comma-separated list of website hostnames that are distractions and should be blocked. User Plan: "${userPlan}"`;

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const blocklist = data.candidates[0].content.parts[0].text.trim().split(',').map(s => s.trim());
        return blocklist;
    } catch (error) {
        console.error('Error getting blocking rules:', error);
        return []; // Return empty list on error
    }
}