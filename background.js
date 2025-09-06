async function getApiKey() {
  const { geminiApiKey } = await chrome.storage.sync.get("geminiApiKey");
  return geminiApiKey;
}

const API_BASE_URL = "http://127.0.0.1:8000";

function getUserFriendlyError(error) {
  // Network errors
  if (!navigator.onLine || error.message.includes('Failed to fetch')) {
    return "Unable to connect to the assistant. Please check your internet connection.";
  }
  
  // API key related errors
  if (error.message.includes('API key')) {
    return "Please set up your API key in the extension settings.";
  }

  // Server not running
  if (error.message.includes('Failed to get response') || 
      error.message.includes('connect') ||
      error.message.includes('ECONNREFUSED')) {
    return "The assistant service is not running. Please start the local server.";
  }

  // JSON parsing errors
  if (error.message.includes('parse') || error.message.includes('JSON')) {
    return "There was a problem communicating with the server. Please try again.";
  }

  // No answer from server
  if (error.message.includes('No answer received')) {
    return "The assistant couldn't generate a response. Please try rephrasing your question.";
  }

  // Vector store errors
  if (error.message.includes('No vector database found')) {
    return "No page content has been processed yet. Please try asking a question about the current page.";
  }

  // Default error message
  return "Sorry, I'm having trouble processing your request. Please try again.";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ASK_GEMINI") {
    (async () => {
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          sendResponse({ 
            ok: false, 
            error: "Please set up your API key in the extension settings."
          });
          return;
        }

        // Get the answer using our custom API
        const res = await fetch(`${API_BASE_URL}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qsn: msg.question,
            api_key: apiKey,
            chat_history: msg.chatHistory || []
          })
        });

        let data;
        try {
          data = await res.json();
        } catch (jsonErr) {
          console.error('JSON parsing error:', jsonErr);
          throw new Error('Failed to parse server response');
        }
        
        if (!res.ok) {
          throw new Error(data.error || data.message || "Failed to get response");
        }

        if (data.status === "error") {
          throw new Error(data.message || "Failed to process request");
        }

        if (!data.answer) {
          throw new Error("No answer received from server");
        }

        sendResponse({ ok: true, answer: data.answer });
      } catch (err) {
        console.error('Error details:', err);
        sendResponse({ 
          ok: false, 
          error: getUserFriendlyError(err)
        });
      }
    })();
    return true; // keep channel open
  }
});
