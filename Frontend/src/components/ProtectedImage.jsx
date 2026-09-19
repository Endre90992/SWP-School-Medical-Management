import React, { useEffect, useState } from "react";
import axios from "axios";

const API_ORIGIN = "http://127.0.0.1:5080";

const ProtectedImage = ({ path, alt = "", className, style, onClick }) => {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!path) {
      setSrc("");
      return undefined;
    }

    let active = true;
    let objectUrl = "";
    const controller = new AbortController();

    const load = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await axios.get(
          path.startsWith("http") ? path : `${API_ORIGIN}${path}`,
          {
            responseType: "blob",
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        objectUrl = URL.createObjectURL(response.data);
        if (active) setSrc(objectUrl);
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error("無法載入受保護圖片：", error);
        }
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
    />
  );
};

export default ProtectedImage;
