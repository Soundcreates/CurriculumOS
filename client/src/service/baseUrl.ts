import axios, { AxiosError } from "axios";

const normalizedBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0")
    ? "/api"
    : "https://curriculumos-detz.onrender.com/api")
).replace(/\/$/, "");

export const apiBaseUrl = normalizedBaseUrl;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const isServiceUnavailableError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return (
      error.response?.status === 503 ||
      error.response?.status === 502 ||
      error.code === "ECONNREFUSED" ||
      error.code === "ERR_NETWORK"
    );
  }
  return false;
};

export default api;
