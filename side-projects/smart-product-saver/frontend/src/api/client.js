import { useAuthStore } from "../stores/authStore";

const API_BASE = "/api";

async function request(endpoint, options = {}) {
  const token = useAuthStore.getState().token;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Auth
export async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return request("/auth/me");
}

// Products
export async function getProducts(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page);
  if (params.pageSize) searchParams.set("page_size", params.pageSize);
  if (params.collectionId) searchParams.set("collection_id", params.collectionId);
  if (params.domain) searchParams.set("domain", params.domain);

  const query = searchParams.toString();
  return request(`/products${query ? `?${query}` : ""}`);
}

export async function getProduct(id) {
  return request(`/products/${id}`);
}

export async function createProduct(data) {
  return request("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id, data) {
  return request(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id) {
  return request(`/products/${id}`, {
    method: "DELETE",
  });
}

export async function getDomains() {
  return request("/products/domains");
}

// Collections
export async function getCollections() {
  return request("/collections");
}

export async function getCollection(id) {
  return request(`/collections/${id}`);
}

export async function createCollection(data) {
  return request("/collections", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCollection(id, data) {
  return request(`/collections/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCollection(id) {
  return request(`/collections/${id}`, {
    method: "DELETE",
  });
}

// Search
export async function searchProducts(query, limit = 20) {
  return request(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}
