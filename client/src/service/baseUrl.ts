import axios from "axios";

const normalizedBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "https://curriculumos.onrender.com/api"
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
