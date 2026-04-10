document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const settingsBtn = document.getElementById('settingsBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  
  const apiKeyInput = document.getElementById('apiKey');
  const errorMsg = document.getElementById('errorMsg');
  const settingsMsg = document.getElementById('settingsMsg');

  // Views
  const settingsView = document.getElementById('settingsView');
  const mainView = document.getElementById('mainView');
  const loadingView = document.getElementById('loadingView');
  const resultsView = document.getElementById('resultsView');

  let currentView = mainView;
  let isCheckingKey = true;

  // Init
  checkApiKey();

  // Event Listeners
  settingsBtn.addEventListener('click', () => showView(settingsView));
  cancelSettingsBtn.addEventListener('click', () => showView(mainView));
  
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ 'geminiApiKey': key }, () => {
        settingsMsg.textContent = 'API Key saved successfully!';
        setTimeout(() => {
          settingsMsg.textContent = '';
          showView(mainView);
        }, 1500);
        cancelSettingsBtn.classList.remove('hidden');
      });
    } else {
      settingsMsg.textContent = 'Please enter a valid key.';
      settingsMsg.style.color = 'var(--against-color)';
    }
  });

  resetBtn.addEventListener('click', () => showView(mainView));

  analyzeBtn.addEventListener('click', () => {
    errorMsg.textContent = '';
    
    chrome.storage.local.get(['geminiApiKey'], async (result) => {
      const apiKey = result.geminiApiKey;
      if (!apiKey) {
        showView(settingsView);
        return;
      }

      showView(loadingView);

      try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Execute content script to scrape text
        // Use scripting API for Manifest V3
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Request content
        chrome.tabs.sendMessage(tab.id, { action: "extractContent" }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.content) {
            showError("Could not extract text from this page.");
            showView(mainView);
            return;
          }

          if (resp.content.length < 50) {
            showError("Not enough text found on this page.");
            showView(mainView);
            return;
          }

          // Send to background for processing
          chrome.runtime.sendMessage(
            { action: "analyzeContent", content: resp.content, apiKey: apiKey },
            (bgResp) => {
              if (chrome.runtime.lastError || !bgResp) {
                showError("Error connecting to extension background.");
                showView(mainView);
                return;
              }

              if (!bgResp.success) {
                showError("API Error: " + bgResp.error);
                showView(mainView);
                return;
              }

              displayResults(bgResp.data);
            }
          );
        });

      } catch (err) {
        showError("Failed to analyze page: " + err.message);
        showView(mainView);
      }
    });
  });

  // Functions
  function checkApiKey() {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (!result.geminiApiKey) {
        cancelSettingsBtn.classList.add('hidden');
        showView(settingsView);
      } else {
        apiKeyInput.value = result.geminiApiKey;
        cancelSettingsBtn.classList.remove('hidden');
        showView(mainView);
      }
    });
  }

  function showView(view) {
    [settingsView, mainView, loadingView, resultsView].forEach(v => v.classList.add('hidden'));
    view.classList.remove('hidden');
    currentView = view;
  }

  function showError(msg) {
    errorMsg.textContent = msg;
  }

  function displayResults(data) {
    document.getElementById('motionText').textContent = data.motion || 'Unknown Context';
    
    const inFavor = data.inFavor || 0;
    const against = data.against || 0;
    const neutral = data.neutral || 0;

    // Animate counters
    animateCounter('favorCount', inFavor);
    animateCounter('againstCount', against);
    animateCounter('neutralCount', neutral);

    // Calculate bar chart percentages
    const total = inFavor + against + neutral;
    if (total > 0) {
      const favorPct = (inFavor / total) * 100;
      const neutralPct = (neutral / total) * 100;
      const againstPct = (against / total) * 100;

      // Small timeout for CSS transition to trigger after display:block
      setTimeout(() => {
        document.getElementById('favorBar').style.width = `${favorPct}%`;
        document.getElementById('neutralBar').style.width = `${neutralPct}%`;
        document.getElementById('againstBar').style.width = `${againstPct}%`;
      }, 50);
    } else {
      document.getElementById('favorBar').style.width = "0%";
      document.getElementById('neutralBar').style.width = "0%";
      document.getElementById('againstBar').style.width = "0%";
    }

    // Populate Breakdown Section
    const breakdownSection = document.getElementById('breakdownSection');
    if (data.details) {
      breakdownSection.classList.remove('hidden');

      const populateCard = (stance, details) => {
        const card = document.getElementById(`${stance}Details`);
        const summary = document.getElementById(`${stance}Summary`);
        const topEl = document.getElementById(`${stance}Top`);
        
        if (details && details.summary && details.summary.trim() !== "") {
          card.classList.remove('hidden');
          summary.textContent = details.summary;
          topEl.textContent = details.topArticle || 'None provided';
        } else {
          card.classList.add('hidden');
        }
      };

      populateCard('favor', data.details.inFavor);
      populateCard('against', data.details.against);
      populateCard('neutral', data.details.neutral);
      
      // Hide the entire section if all cards are hidden
      const anyVisible = data.details.inFavor?.summary || data.details.against?.summary || data.details.neutral?.summary;
      if (!anyVisible) breakdownSection.classList.add('hidden');
      
    } else {
      breakdownSection.classList.add('hidden');
    }

    showView(resultsView);
  }

  function animateCounter(id, targetValue) {
    const el = document.getElementById(id);
    let current = 0;
    const duration = 1000; // ms
    const delay = 30; // ms
    const steps = duration / delay;
    const increment = targetValue / steps;

    if (targetValue === 0) {
      el.textContent = '0';
      return;
    }

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetValue) {
        el.textContent = targetValue;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current);
      }
    }, delay);
  }
});
