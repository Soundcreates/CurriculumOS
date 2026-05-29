import axios from "axios";

const normalizedBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0")
    ? "/api"
    : "https://curriculumos.onrender.com/api")
).replace(/\/$/, "");

export const apiBaseUrl = normalizedBaseUrl;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
