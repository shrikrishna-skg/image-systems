import axios from "axios";
import { supabase } from "../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Add Supabase auth token to requests
client.interceptors.request.use(
  async (config) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Failed to get Supabase session:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 - refresh Supabase session
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const { data } = await supabase.auth.refreshSession();
        if (data?.session) {
          originalRequest.headers["Authorization"] = `Bearer ${data.session.access_token}`;
          return client(originalRequest);
        }
      } catch {
        // Refresh failed
      }

      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default client;
