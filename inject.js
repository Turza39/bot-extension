// Load saved chat messages
function loadSavedMessages() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatMessages'], (result) => {
      resolve(result.chatMessages || []);
    });
  });
}

// Save chat messages
function saveMessages(messages) {
  chrome.storage.local.set({ chatMessages: messages });
}

async function embedPageContent() {
  try {
    const pageContent = {
      url: window.location.href,
      title: document.title,
      text: document.body.innerText
    };

    // Send the content to our embedding API
    const response = await fetch('http://127.0.0.1:8000/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: pageContent.url })
    });

    if (!response.ok) {
      console.error('[MiniBot] Failed to embed page content:', await response.text());
    } else {
      console.log('[MiniBot] Page content embedded successfully');
    }
  } catch (error) {
    console.error('[MiniBot] Error embedding page content:', error);
  }
}

function createBotUI() {
  console.log("[MiniBot] Starting createBotUI...");

  // Prevent duplicate injection
  if (document.getElementById("mini-bot-btn")) {
    console.warn("[MiniBot] Bot already injected, skipping...");
    return;
  }

  // Embed the page content when UI is created
  embedPageContent();

  // Create container and inject HTML
  const container = document.createElement("div");
  container.className = "mini-bot-container";

  // Fetch and inject HTML
  fetch(chrome.runtime.getURL("inject.html"))
    .then((response) => response.text())
    .then((html) => {
      container.innerHTML = html;
      document.body.appendChild(container);

      // Set bot icon image
      const iconImg = document.getElementById("bot-icon-img");
      iconImg.src = chrome.runtime.getURL("ChatGPT-bot-icon.png");

      // Restore saved messages
      loadSavedMessages().then(messages => {
        const container = document.getElementById("mini-bot-messages");
        messages.forEach(msg => {
          const msgDiv = document.createElement("div");
          msgDiv.className = `message ${msg.sender}-message`;
          msgDiv.innerHTML = `
            <div class="message-content">${msg.text}</div>
            <div class="message-time">${msg.time}</div>
          `;
          container.appendChild(msgDiv);
        });
        container.scrollTop = container.scrollHeight;
      });

      initializeEventListeners();
    });
}

function initializeEventListeners() {
  const chat = document.getElementById("mini-bot-chat");
  const btn = document.getElementById("mini-bot-btn");
  const closeBtn = document.getElementById("mini-bot-close");
  const minBtn = document.getElementById("mini-bot-minimize");
  const sendBtn = document.getElementById("mini-bot-send");
  const textarea = document.querySelector("#mini-bot-input textarea");

  // Toggle chat
  btn.addEventListener("click", () => {
    chat.style.display = "flex";
    btn.style.display = "none";
    textarea.focus();
  });

  // Close chat
  closeBtn.addEventListener("click", () => {
    chat.style.display = "none";
    btn.style.display = "block";
    // Clear saved messages when explicitly closed
    chrome.storage.local.remove(['chatMessages']);
    document.getElementById("mini-bot-messages").innerHTML = "";
  });

  // Minimize chat
  minBtn.addEventListener("click", () => {
    chat.style.display = "none";
    btn.style.display = "block";
  });

  // Handle send message
  async function sendMessage() {
    try {
      const text = textarea.value.trim();
      if (!text) return;

      addMessage("user", text);
      textarea.value = "";
      textarea.style.height = "auto";

      // Get page context and chat history
      const pageText = document.body.innerText.slice(0, 2000);
      const messages = await loadSavedMessages();

      // Convert saved messages to the format expected by the API
      const chatHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      try {
        const resp = await chrome.runtime.sendMessage({
          type: "ASK_GEMINI",
          question: text,
          context: pageText,
          chatHistory: chatHistory
        });

        if (resp?.ok) {
          addMessage("bot", resp.answer);
        } else {
          addMessage("bot", "⚠️ Error: " + (resp?.error || "Unknown error"));
        }
      } catch (err) {
        addMessage("bot", "⚠️ Internal error");
        console.error("[MiniBot] Error:", err);
      }
    } catch (err) {
      addMessage("bot", "⚠️ Failed to process message");
      console.error("[MiniBot] Error in sendMessage:", err);
    }
  }

  // Send button click
  sendBtn.addEventListener("click", sendMessage);

  // Enter to send (Shift+Enter for new line)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });
}

function addMessage(sender, text) {
    const container = document.getElementById("mini-bot-messages");
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}-message`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Process the text content
    let processedText = text;
    
    if (sender === 'bot') {
        // Convert markdown-style formatting
        processedText = formatBotResponse(text);
    }
    
    msgDiv.innerHTML = `
        <div class="message-content">${processedText}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    
    // Save message to storage with proper format
    loadSavedMessages().then(messages => {
        const messageObj = {
            sender,
            text: sender === 'bot' ? text : processedText, // Save raw text for bot messages
            time,
            role: sender === 'user' ? 'user' : 'assistant',
            content: sender === 'bot' ? text : processedText // Add content field for API
        };
        messages.push(messageObj);
        saveMessages(messages);
    });
    
    // Initialize any code blocks with syntax highlighting
    if (sender === 'bot') {
        msgDiv.querySelectorAll('pre code').forEach(block => {
            highlightCode(block);
        });
        // Setup copy buttons
        setupCopyButtons();
    }
}

function formatBotResponse(text) {
    try {
        // Check if the response contains code blocks
        const hasCodeBlock = text.includes('```');
        
        if (hasCodeBlock) {
            // Replace code blocks with properly formatted ones
            text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
                const copyButton = `<button class="copy-button" onclick="event.stopPropagation();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z"/><path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2"/></svg></button>`;
                return `<pre>${copyButton}<code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
            });
        }
        
        // Convert inline code
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Basic list formatting
        text = formatLists(text);
        
        // Use marked for other markdown formatting if available
        if (typeof marked !== 'undefined') {
            text = marked.parse(text);
        }
        
        return text;
    } catch (error) {
        console.error('[MiniBot] Error formatting response:', error);
        return text; // Return original text if formatting fails
    }
}

// Add this after the formatBotResponse function
function setupCopyButtons() {
    document.querySelectorAll('.copy-button').forEach(button => {
        if (!button.hasListener) {
            button.addEventListener('click', async () => {
                const pre = button.closest('pre');
                const code = pre.querySelector('code');
                const text = code.textContent;

                try {
                    await navigator.clipboard.writeText(text);
                    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
                    button.classList.add('copied');
                    
                    // Reset button after 2 seconds
                    setTimeout(() => {
                        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z"/><path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2"/></svg>`;
                        button.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text:', err);
                }
            });
            button.hasListener = true;
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightCode(block) {
    // You can add syntax highlighting here if needed
    // For example, using Prism.js or highlight.js
    block.style.whiteSpace = 'pre';
}

// Helper function to detect and format lists
function formatLists(text) {
    // Unordered lists
    text = text.replace(/^\s*[-*•]\s+(.+)/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Ordered lists
    text = text.replace(/^\s*(\d+)\.\s+(.+)/gm, '<li>$2</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    
    return text;
}
// Initialize
createBotUI();
