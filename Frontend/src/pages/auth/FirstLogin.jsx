import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "../../assets/css/FirstLogin.module.css";

const API_BASE = "http://127.0.0.1:5080/api";

const FirstLogin = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("token") || !localStorage.getItem("userId")) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const goToRoleHome = () => {
    const role = localStorage.getItem("role");
    if (role === "Manager") navigate("/manager", { replace: true });
    else if (role === "Nurse") navigate("/nurse", { replace: true });
    else if (role === "Parent") navigate("/parent", { replace: true });
    else navigate("/", { replace: true });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setMessage("請完整輸入新密碼與確認密碼。");
      return;
    }

    if (newPassword.length < 10) {
      setMessage("新密碼至少需要 10 個字元。");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("兩次輸入的密碼不一致。");
      return;
    }

    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE}/User/change-password-firstlogin/${userId}`,
        { newPassword },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("密碼更新成功，正在進入系統...");
      setTimeout(goToRoleHome, 700);
    } catch (error) {
      console.error("修改密碼失敗：", error);
      setMessage(error.response?.data?.message || "密碼更新失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <h2 className={styles.title}>首次登入－設定新密碼</h2>
        <p>為保護學生資料，首次登入請先更換預設密碼。</p>
        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            placeholder="新密碼（至少 10 個字元）"
            className={styles.input}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="再次輸入新密碼"
            className={styles.input}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "更新中..." : "更新密碼"}
          </button>
          {message && <p className={styles.message}>{message}</p>}
        </form>
      </div>
    </div>
  );
};

export default FirstLogin;
