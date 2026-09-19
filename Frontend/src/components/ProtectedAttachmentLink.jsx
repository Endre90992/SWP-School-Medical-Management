import React from "react";
import axios from "axios";

const API_ORIGIN = "http://127.0.0.1:5080";

const ProtectedAttachmentLink = ({ path, children = "查看附件" }) => {
  const handleOpen = async (event) => {
    event.preventDefault();
    if (!path) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(
        path.startsWith("http") ? path : `${API_ORIGIN}${path}`,
        {
          responseType: "blob",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error("無法開啟受保護附件：", error);
    }
  };

  return (
    <a href="#" onClick={handleOpen}>
      {children}
    </a>
  );
};

export default ProtectedAttachmentLink;
