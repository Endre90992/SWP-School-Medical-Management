import React from "react";
import styles from "../assets/css/LoadingOverlay.module.css";

const LoadingOverlay = ({ text = "資料載入中..." }) => (
  <div className={styles.loadingOverlay}>
    <div className={styles.spinner} />
    <div className={styles.loadingText}>{text}</div>
  </div>
);

export default LoadingOverlay;
