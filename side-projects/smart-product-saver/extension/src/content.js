/**
 * Content script for extracting product data from web pages.
 */

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PRODUCT") {
    const data = extractProductData();
    sendResponse({ success: true, data });
  }
  return true;
});

/**
 * Extract product data from the current page.
 */
function extractProductData() {
  const data = {
    url: window.location.href,
    title: "",
    description: "",
    price: null,
    currency: null,
    images: [],
    thumbnail: null,
  };

  // 1. Try Schema.org Product markup
  const schemaData = extractSchemaOrg();
  if (schemaData) {
    Object.assign(data, schemaData);
  }

  // 2. Try Open Graph metadata
  const ogData = extractOpenGraph();
  Object.assign(data, { ...ogData, ...filterEmpty(data) });

  // 3. Try Twitter Cards
  const twitterData = extractTwitterCards();
  Object.assign(data, { ...twitterData, ...filterEmpty(data) });

  // 4. Fallback to basic page scraping
  if (!data.title) {
    data.title = document.title || "Untitled Product";
  }

  if (data.images.length === 0) {
    data.images = extractLargeImages();
  }

  if (!data.thumbnail && data.images.length > 0) {
    data.thumbnail = data.images[0];
  }

  // 5. Try to find price on page
  if (!data.price) {
    const priceData = extractPrice();
    if (priceData) {
      data.price = priceData.price;
      data.currency = priceData.currency;
    }
  }

  return data;
}

/**
 * Extract Schema.org Product data.
 */
function extractSchemaOrg() {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent);
      const product = findProduct(json);

      if (product) {
        return {
          title: product.name,
          description: product.description,
          price: parsePrice(product.offers?.price),
          currency: product.offers?.priceCurrency,
          images: Array.isArray(product.image)
            ? product.image
            : product.image
            ? [product.image]
            : [],
          thumbnail: Array.isArray(product.image)
            ? product.image[0]
            : product.image,
        };
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Find Product in potentially nested JSON-LD.
 */
function findProduct(obj) {
  if (!obj) return null;

  if (obj["@type"] === "Product") {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findProduct(item);
      if (found) return found;
    }
  }

  if (obj["@graph"]) {
    return findProduct(obj["@graph"]);
  }

  return null;
}

/**
 * Extract Open Graph metadata.
 */
function extractOpenGraph() {
  const data = {};

  const title = document.querySelector('meta[property="og:title"]');
  if (title) data.title = title.content;

  const description = document.querySelector('meta[property="og:description"]');
  if (description) data.description = description.content;

  const image = document.querySelector('meta[property="og:image"]');
  if (image) {
    data.thumbnail = image.content;
    data.images = [image.content];
  }

  // Additional images
  const images = document.querySelectorAll('meta[property="og:image"]');
  if (images.length > 1) {
    data.images = Array.from(images).map((img) => img.content);
  }

  return data;
}

/**
 * Extract Twitter Card metadata.
 */
function extractTwitterCards() {
  const data = {};

  const title = document.querySelector('meta[name="twitter:title"]');
  if (title) data.title = title.content;

  const description = document.querySelector('meta[name="twitter:description"]');
  if (description) data.description = description.content;

  const image = document.querySelector('meta[name="twitter:image"]');
  if (image) {
    data.thumbnail = image.content;
    if (!data.images) data.images = [];
    data.images.push(image.content);
  }

  return data;
}

/**
 * Extract large images from the page.
 */
function extractLargeImages() {
  const images = Array.from(document.querySelectorAll("img"));
  const largeImages = [];

  for (const img of images) {
    // Skip tiny images (icons, trackers)
    if (img.naturalWidth >= 200 && img.naturalHeight >= 200) {
      const src = img.src || img.dataset.src || img.dataset.lazySrc;
      if (src && !src.includes("data:image")) {
        largeImages.push(src);
      }
    }
  }

  // Also check srcset
  const srcsetImages = document.querySelectorAll("img[srcset]");
  for (const img of srcsetImages) {
    const srcset = img.srcset;
    const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
    largeImages.push(...urls);
  }

  // Dedupe and limit
  return [...new Set(largeImages)].slice(0, 10);
}

/**
 * Try to extract price from page.
 */
function extractPrice() {
  // Common price selectors
  const selectors = [
    '[class*="price"]',
    '[id*="price"]',
    '[data-price]',
    '[itemprop="price"]',
    ".product-price",
    ".sale-price",
    ".current-price",
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent || el.dataset.price;
      const price = parsePrice(text);
      if (price) {
        return {
          price,
          currency: detectCurrency(text),
        };
      }
    }
  }

  return null;
}

/**
 * Parse price from text.
 */
function parsePrice(text) {
  if (!text) return null;

  // Remove currency symbols and extract number
  const cleaned = String(text)
    .replace(/[^\d.,]/g, "")
    .replace(",", ".");

  const match = cleaned.match(/(\d+\.?\d*)/);
  if (match) {
    const price = parseFloat(match[1]);
    if (price > 0 && price < 1000000) {
      return price;
    }
  }

  return null;
}

/**
 * Detect currency from text.
 */
function detectCurrency(text) {
  if (!text) return null;

  const currencyMap = {
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    USD: "USD",
    EUR: "EUR",
    GBP: "GBP",
  };

  for (const [symbol, code] of Object.entries(currencyMap)) {
    if (text.includes(symbol)) {
      return code;
    }
  }

  return "USD"; // Default
}

/**
 * Filter out empty values from object.
 */
function filterEmpty(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== "") {
      result[key] = value;
    }
  }
  return result;
}
