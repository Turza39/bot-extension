function loadSavedMessages() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatMessages'], (result) => {
      resolve(result.chatMessages || []);
    });
  });
}

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

  if (document.getElementById("mini-bot-btn")) {
    console.warn("[MiniBot] Bot already injected, skipping...");
    return;
  }

  embedPageContent();

  const container = document.createElement("div");
  container.className = "mini-bot-container";

  fetch(chrome.runtime.getURL("inject.html"))
    .then((response) => response.text())
    .then((html) => {
      container.innerHTML = html;
      document.body.appendChild(container);

      const iconImg = document.getElementById("bot-icon-img");
      iconImg.src = chrome.runtime.getURL("ChatGPT-bot-icon.png");

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

  btn.addEventListener("click", () => {
    chat.style.display = "flex";
    btn.style.display = "none";
    textarea.focus();
  });

  closeBtn.addEventListener("click", () => {
    chat.style.display = "none";
    btn.style.display = "block";
    chrome.storage.local.remove(['chatMessages']);
    document.getElementById("mini-bot-messages").innerHTML = "";
  });

  minBtn.addEventListener("click", () => {
    chat.style.display = "none";
    btn.style.display = "block";
  });

  async function sendMessage() {
    try {
      const text = textarea.value.trim();
      if (!text) return;

      addMessage("user", text);
      textarea.value = "";
      textarea.style.height = "auto";

      const pageText = document.body.innerText;
      const messages = await loadSavedMessages();

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

  sendBtn.addEventListener("click", sendMessage);

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

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
    
    let processedText = text;
    
    if (sender === 'bot') {
        processedText = formatBotResponse(text);
    }
    
    msgDiv.innerHTML = `
        <div class="message-content">${processedText}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    
    loadSavedMessages().then(messages => {
        const messageObj = {
            sender,
            text: sender === 'bot' ? text : processedText,
            time,
            role: sender === 'user' ? 'user' : 'assistant',
            content: sender === 'bot' ? text : processedText 
        };
        messages.push(messageObj);
        saveMessages(messages);
    });
    
    if (sender === 'bot') {
        msgDiv.querySelectorAll('pre code').forEach(block => {
            highlightCode(block);
        });
        setupCopyButtons();
    }
}

function formatBotResponse(text) {
    try {
        const hasCodeBlock = text.includes('```');
        
        if (hasCodeBlock) {
            text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
                const copyButton = `<button class="copy-button" onclick="event.stopPropagation();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z"/><path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2"/></svg></button>`;
                return `<pre>${copyButton}<code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
            });
        }
        
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        text = formatLists(text);
        
        if (typeof marked !== 'undefined') {
            text = marked.parse(text);
        }
        
        return text;
    } catch (error) {
        console.error('[MiniBot] Error formatting response:', error);
        return text; 
    }
}

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
    block.style.whiteSpace = 'pre';
}

function formatLists(text) {
    text = text.replace(/^\s*[-*•]\s+(.+)/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    text = text.replace(/^\s*(\d+)\.\s+(.+)/gm, '<li>$2</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    
    return text;
}
createBotUI();
