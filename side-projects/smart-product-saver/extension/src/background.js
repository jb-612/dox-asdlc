/**
 * Background service worker for Smart Product Saver extension.
 */

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-product",
    title: "Save to Smart Product Saver",
    contexts: ["page", "link", "image"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-product") {
    try {
      // Send message to content script to extract data
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT_PRODUCT",
      });

      if (response.success) {
        // Open popup or save directly
        await saveProduct(response.data);
      }
    } catch (error) {
      console.error("Failed to extract product:", error);
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_PRODUCT") {
    saveProduct(message.data)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["apiKey", "apiUrl"], (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === "SET_AUTH") {
    chrome.storage.local.set(
      { apiKey: message.apiKey, apiUrl: message.apiUrl },
      () => {
        sendResponse({ success: true });
      }
    );
    return true;
  }
});

/**
 * Save product to API.
 */
async function saveProduct(productData) {
  const { apiKey, apiUrl } = await chrome.storage.local.get([
    "apiKey",
    "apiUrl",
  ]);

  if (!apiKey || !apiUrl) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetch(`${apiUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to save product");
  }

  return { success: true, data: await response.json() };
}
