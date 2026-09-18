import "../../assets/css/login.css";
import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = "http://127.0.0.1:5080/api";

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const goToRoleHome = (roleName) => {
    if (roleName === "Manager") navigate("/manager", { replace: true });
    else if (roleName === "Nurse") navigate("/nurse", { replace: true });
    else if (roleName === "Parent") navigate("/parent", { replace: true });
    else navigate("/", { replace: true });
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      toast.error("請輸入帳號與密碼。");
      return;
    }

    if (!/^[a-zA-Z0-9_@-]+$/.test(username)) {
      toast.error("帳號只能包含英文字母、數字、_、- 與 @。");
      return;
    }

    if (password.length < 6) {
      toast.error("密碼至少需要 6 個字元。");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/User/login`, {
        username,
        password,
      });

      const data = response.data?.data;
      const token = data?.token;
      if (!token || String(response.data?.status) !== "200") {
        toast.error("登入失敗，請確認帳號與密碼。");
        return;
      }

      const decoded = jwtDecode(token);
      const roleName =
        decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
        data.roleName ||
        "";

      localStorage.setItem("token", token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("fullname", data.fullName || "使用者");
      localStorage.setItem("role", roleName);

      toast.success("登入成功。");

      if (data.isFirstLogin) {
        navigate("/firstlogin", { replace: true });
        return;
      }

      if (roleName === "Parent") {
        localStorage.setItem("parentId", data.userId);
        try {
          const studentRes = await axios.get(`${API_BASE}/Student/by-parent/${data.userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const students = Array.isArray(studentRes.data?.data)
            ? studentRes.data.data
            : [];
          localStorage.setItem(
            "studentIds",
            JSON.stringify(students.map((s) => s.studentId))
          );
          if (students[0]?.studentId) {
            localStorage.setItem("studentId", students[0].studentId);
          }
        } catch {
          // 家長資料載入失敗不阻擋登入。
        }
      }

      goToRoleHome(roleName);
    } catch (error) {
      console.error("登入失敗：", error);
      toast.error("無法登入。請確認本機 EduHealth 後端是否已啟動。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <ToastContainer position="top-center" autoClose={2500} theme="colored" />
      <div className="login-container">
        <div className="left-section">
          <h1>校園健康中心管理系統</h1>
          <p>集中管理學生健康資料、傷病處置、健檢與預防接種紀錄。</p>
          <div className="illustration" />
        </div>

        <div className="right-section">
          <div className="right-content">
            <div className="form-header">
              <h2>登入</h2>
              <p>歡迎使用 EduHealth 本機版</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">帳號</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="請輸入帳號"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">密碼</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="請輸入密碼"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "登入中..." : "登入"}
              </button>

              <div className="register-link">
                <span>本系統為健康中心單機離線版本</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
