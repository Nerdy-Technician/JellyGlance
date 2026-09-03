import Axios from "axios";
import baseUrl from "./baseurl";
import { clearApiCache } from "./api-cache";

const axios = Axios.create({ baseURL: baseUrl });

function requestUrl(error) {
  return String(error?.config?.url || error?.config?.baseURL || "");
}

function isJellyGlanceAuthFailure(error) {
  if (error?.response?.status !== 401) return false;
  const url = requestUrl(error);
  if (/\/proxy(\/|$)/i.test(url)) return false;
  if (/\/socket\.io/i.test(url)) return false;
  return Boolean(localStorage.getItem("token"));
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const url = String(config.url || "");
  const isExternalUrl = /^https?:\/\//i.test(url);

  if (token && token !== "null" && !isExternalUrl && !config.headers?.Authorization) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isJellyGlanceAuthFailure(error)) {
      localStorage.removeItem("token");
      localStorage.removeItem("config");
      clearApiCache();
      window.dispatchEvent(new Event("jellyglance-auth-expired"));
    }

    return Promise.reject(error);
  }
);

export default axios;
