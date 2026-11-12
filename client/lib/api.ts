import axios from "axios";

export const api = axios.create({
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && window.location.host) {
    config.headers["x-mp-host"] = window.location.host;
  }
  return config;
});

export function apiErrorKey(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const key = error.response?.data?.error;
    if (typeof key === "string" && key.length > 0) return key;
  }
  return "errors.server";
}
