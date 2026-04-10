/**
 * Extracts news headlines and snippets from the current page.
 * Targets common elements used in news aggregators like h1-h4, and prominent links.
 */
function extractPageText() {
  // Broaden the search selectors to catch Google News tabs and other varied structures
  const elements = document.querySelectorAll('h1, h2, h3, h4, article, .title, .headline, a, div[role="heading"], p');
  let extractedText = [];
  
  // Deduplicate strings to avoid noise
  const seenTexts = new Set();

  elements.forEach((el) => {
    // Only capture elements with reasonable length to avoid navigation links
    const text = el.innerText ? el.innerText.trim() : '';
    if (text.length > 25 && text.length < 1000 && !seenTexts.has(text)) {
      seenTexts.add(text);
      extractedText.push(text);
    }
  });

  let finalContent = extractedText.join('\n\n--- \n\n');

  // Fallback: If not enough structured text is found (e.g. heavily nested divs without headers), 
  // just return the visible text of the body (capped at 60k chars to keep payload manageable).
  if (finalContent.length < 50 && document.body && document.body.innerText) {
    finalContent = document.body.innerText.substring(0, 60000);
  }

  return finalContent;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractContent") {
    const textContent = extractPageText();
    sendResponse({ content: textContent, url: window.location.href });
  }
  return true; // Keep message channel open for async if needed
});
