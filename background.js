chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeContent") {
    // We get the content from the payload and then call Gemini API.
    analyzeWithGemini(request.content, request.apiKey)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
      
    // Must return true to indicate you wish to send a response asynchronously
    return true; 
  }
});

async function analyzeWithGemini(content, apiKey) {
  // Using gemini-2.5-flash as the stable active endpoint
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
You are a sentiment analysis assistant. I will provide you with a list of article headlines and snippets extracted from a news webpage.

Your tasks:
1. Identify the central 'motion' or main topic being debated or discussed across these items. It should be a concise phrase.
2. Determine whether each snippet supports ("In Favor"), opposes ("Against"), or is neutral towards that central motion.
3. Count the total number of articles that are 'In Favor', 'Against', and 'Neutral'.
4. For each stance (In Favor, Against, Neutral), write a short summary of the main arguments presented.
5. For each stance, provide the exact headline of the single best article that represents that viewpoint. If there are no articles for a stance, return null for summary and topArticle.

Review the text below:
---
${content}
---

Respond ONLY with a valid JSON object matching this schema, without any backticks or markdown fences:
{
  "motion": "String - The identified central motion",
  "inFavor": Number,
  "against": Number,
  "neutral": Number,
  "details": {
    "inFavor": { "summary": "String", "topArticle": "String | null" },
    "against": { "summary": "String", "topArticle": "String | null" },
    "neutral": { "summary": "String", "topArticle": "String | null" }
  }
}
`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errText}`);
    }

    const jsonResult = await response.json();
    const generatedText = jsonResult.candidates[0].content.parts[0].text;
    
    return JSON.parse(generatedText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
