import axios from "axios";

const normalizedBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080/api"
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
