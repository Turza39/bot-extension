document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById("save");
  const apiKeyInput = document.getElementById("apiKey");
  const statusElement = document.getElementById("status");
  const togglePassword = document.getElementById("togglePassword");

  // Check if API key exists
  chrome.storage.sync.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      statusElement.textContent = "Mini Bot is active and ready!";
      statusElement.style.color = "#34a853";
    }
  });

  // Toggle password visibility
  togglePassword.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    togglePassword.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
  });

  // Save API key
  saveButton.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      statusElement.textContent = "Please enter an API key";
      statusElement.style.color = "#ea4335";
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      statusElement.textContent = "Success! Mini Bot is ready to help.";
      statusElement.style.color = "#34a853";
    } catch (error) {
      statusElement.textContent = "Error saving API key. Please try again.";
      statusElement.style.color = "#ea4335";
    }

    saveButton.disabled = false;
    saveButton.textContent = "Activate Mini Bot";
  });

  // Handle input changes
  apiKeyInput.addEventListener('input', () => {
    statusElement.textContent = "";
  });
});
