import Axios from "axios";
import baseUrl from "./baseurl";

const axios = Axios.create({ baseURL: baseUrl });

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
    if (error?.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("config");
      window.dispatchEvent(new Event("jellyglance-auth-expired"));
    }

    return Promise.reject(error);
  }
);

export default axios;
