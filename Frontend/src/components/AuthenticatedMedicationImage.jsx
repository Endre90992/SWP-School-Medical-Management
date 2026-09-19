import React, { useEffect, useState } from "react";
import { fetchMedicationImageUrl } from "../utils/medicationImage";

const AuthenticatedMedicationImage = ({
  requestId,
  alt = "藥袋／藥品照片",
  className,
  style,
  onClick,
}) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    fetchMedicationImageUrl(requestId)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
        else URL.revokeObjectURL(nextUrl);
      })
      .catch(() => {
        if (active) setUrl("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestId]);

  if (!url) return <span>附件載入中...</span>;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      onClick={() => onClick?.(url)}
    />
  );
};

export default AuthenticatedMedicationImage;
