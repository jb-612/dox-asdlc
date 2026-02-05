/**
 * Popup script for Smart Product Saver extension.
 */

// State
let productData = null;
let collections = [];

// DOM Elements
const authView = document.getElementById("auth-view");
const saveView = document.getElementById("save-view");
const successView = document.getElementById("success-view");
const errorView = document.getElementById("error-view");
const loading = document.getElementById("loading");

const authForm = document.getElementById("auth-form");
const saveForm = document.getElementById("save-form");
const apiUrlInput = document.getElementById("api-url");
const apiKeyInput = document.getElementById("api-key");
const notesInput = document.getElementById("notes");
const collectionSelect = document.getElementById("collection");
const saveBtn = document.getElementById("save-btn");

const previewImage = document.getElementById("preview-image");
const previewTitle = document.getElementById("preview-title");
const previewPrice = document.getElementById("preview-price");
const previewDomain = document.getElementById("preview-domain");

const errorMessage = document.getElementById("error-message");
const retryBtn = document.getElementById("retry-btn");
const openAppBtn = document.getElementById("open-app-btn");

// Initialize
document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const auth = await getAuth();

    if (!auth || !auth.apiKey || !auth.apiUrl) {
      showView(authView);
      // Pre-fill default URL
      apiUrlInput.value = "http://localhost:8000";
    } else {
      await loadProductAndCollections();
    }
  } catch (error) {
    showError(formatError(error));
  }
}

// Format error message properly
function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  if (Array.isArray(error)) {
    return error.map(e => e.msg || e.message || JSON.stringify(e)).join(", ");
  }
  if (typeof error === "object") {
    return JSON.stringify(error);
  }
  return String(error);
}

// Auth
async function getAuth() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_AUTH" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Auth error:", chrome.runtime.lastError);
        resolve({});
      } else {
        resolve(response || {});
      }
    });
  });
}

async function setAuth(apiUrl, apiKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SET_AUTH", apiUrl, apiKey }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Set auth error:", chrome.runtime.lastError);
      }
      resolve(response);
    });
  });
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoading(true);

  const apiUrl = apiUrlInput.value.trim().replace(/\/$/, "");
  const apiKey = apiKeyInput.value.trim();

  try {
    // Validate credentials by calling /api/auth/me
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error("Invalid API key");
    }

    await setAuth(apiUrl, apiKey);
    await loadProductAndCollections();
  } catch (error) {
    showError(formatError(error));
  } finally {
    showLoading(false);
  }
});

// Load product data and collections
async function loadProductAndCollections() {
  showLoading(true);

  try {
    // Get current tab and extract product
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("No active tab found");
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT_PRODUCT",
      });
    } catch (err) {
      throw new Error("Cannot extract from this page. Try a product page.");
    }

    if (!response || !response.success) {
      throw new Error("Failed to extract product data");
    }

    productData = response.data;

    // Load collections
    const auth = await getAuth();
    try {
      const collectionsResponse = await fetch(`${auth.apiUrl}/api/collections`, {
        headers: { Authorization: `Bearer ${auth.apiKey}` },
      });

      if (collectionsResponse.ok) {
        collections = await collectionsResponse.json();
        populateCollections();
      }
    } catch (err) {
      console.warn("Could not load collections:", err);
    }

    // Show preview
    updatePreview();
    showView(saveView);
  } catch (error) {
    showError(formatError(error));
  } finally {
    showLoading(false);
  }
}

function updatePreview() {
  if (!productData) return;

  previewTitle.textContent = productData.title || "Untitled";
  previewImage.src = productData.thumbnail || "";
  previewImage.style.display = productData.thumbnail ? "block" : "none";

  if (productData.price) {
    const currency = productData.currency || "USD";
    previewPrice.textContent = `${currency} ${productData.price}`;
    previewPrice.style.display = "block";
  } else {
    previewPrice.style.display = "none";
  }

  try {
    const url = new URL(productData.url);
    previewDomain.textContent = url.hostname;
  } catch {
    previewDomain.textContent = "";
  }
}

function populateCollections() {
  // Clear existing options except "None"
  collectionSelect.innerHTML = '<option value="">None</option>';

  for (const collection of collections) {
    const option = document.createElement("option");
    option.value = collection.id;
    option.textContent = collection.name;
    collectionSelect.appendChild(option);
  }
}

// Save product
saveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoading(true);
  saveBtn.disabled = true;

  try {
    const auth = await getAuth();

    const payload = {
      ...productData,
      user_notes: notesInput.value.trim() || null,
      collection_id: collectionSelect.value || null,
    };

    const response = await fetch(`${auth.apiUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail;
      // Handle FastAPI validation errors (array of objects)
      if (Array.isArray(detail)) {
        throw new Error(detail.map(d => d.msg || d.message).join(", "));
      }
      throw new Error(detail || "Failed to save");
    }

    showView(successView);
  } catch (error) {
    showError(formatError(error));
  } finally {
    showLoading(false);
    saveBtn.disabled = false;
  }
});

// Error handling
retryBtn.addEventListener("click", () => {
  init();
});

openAppBtn.addEventListener("click", async () => {
  const auth = await getAuth();
  if (auth && auth.apiUrl) {
    // Assume frontend is on port 3456
    const frontendUrl = auth.apiUrl.replace(":8000", ":3456");
    chrome.tabs.create({ url: frontendUrl });
  }
  window.close();
});

// View helpers
function showView(view) {
  [authView, saveView, successView, errorView].forEach((v) => {
    if (v) v.classList.add("hidden");
  });
  if (view) view.classList.remove("hidden");
}

function showLoading(show) {
  if (loading) {
    if (show) {
      loading.classList.remove("hidden");
    } else {
      loading.classList.add("hidden");
    }
  }
}

function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message || "An error occurred";
  }
  showView(errorView);
}
