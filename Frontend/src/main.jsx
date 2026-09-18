import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import "./index.css";
import App from "./App.jsx";

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (!token) return config;

  const url = String(config.url || "");
  const isLocalApi =
    url.startsWith("/api/") ||
    url.startsWith("http://127.0.0.1:5080/api/") ||
    url.startsWith("http://localhost:5080/api/");

  if (isLocalApi) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
