import api, { apiBaseUrl } from "../service/baseUrl";

export type OAuthProvider = "google" | "twitter";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  provider: string;
  hasPassword: boolean;
};

export function getOAuthLoginUrl(provider: OAuthProvider) {
  return `${apiBaseUrl}/auth/oauth/${provider}/login`;
}

export function startOAuthLogin(provider: OAuthProvider) {
  window.location.assign(getOAuthLoginUrl(provider));
}

export function login(payload: LoginPayload) {
  return api.post("/auth/login", payload);
}

export function register(payload: RegisterPayload) {
  return api.post("/auth/register", payload);
}

export function getCurrentUser() {
  return api.get<{ success: boolean; user: AuthUser }>("/auth/me");
}

export function logout() {
  return api.post("/auth/logout");
}
