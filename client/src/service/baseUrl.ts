import axios, { AxiosError } from "axios";

const resolveBaseUrl = () => {
  let rawUrl =
    import.meta.env.VITE_API_BASE_URL ??
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0")
      ? "/api"
      : "https://curriculumos.onrender.com/api");

  // Automatically migrate the old backend domain to the current active domain.
  rawUrl = rawUrl.replace(
    "curriculumos-detz.onrender.com",
    "curriculumos.onrender.com"
  );

  let cleanedUrl = rawUrl.replace(/\/$/, "");

  // Ensure the /api suffix is present if a domain/url was configured without it
  if (cleanedUrl !== "/api" && !cleanedUrl.endsWith("/api")) {
    cleanedUrl += "/api";
  }

  return cleanedUrl;
};

export const apiBaseUrl = resolveBaseUrl();

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
