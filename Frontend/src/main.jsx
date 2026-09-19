import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import axios from "axios";

const LOCAL_API_ORIGIN = "http://127.0.0.1:5080";

axios.interceptors.request.use((config) => {
  const url = config.url || "";
  const isLocalApi =
    url.startsWith("/api/") ||
    url === "/api" ||
    url.startsWith(`${LOCAL_API_ORIGIN}/api/`);

  if (isLocalApi) {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
