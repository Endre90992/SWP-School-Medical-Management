import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const getUserInfo = () => ({
  fullname:
    localStorage.getItem("fullname") ||
    localStorage.getItem("fullName") ||
    "使用者",
  role: localStorage.getItem("role") || "",
  avatar: localStorage.getItem("avatar") || "",
  token: localStorage.getItem("token") || "",
});

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "人";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const UserMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const { fullname, role, avatar, token } = getUserInfo();

  useEffect(() => {
    if (!token || !role) return;
    localStorage.setItem("loginTime", localStorage.getItem("loginTime") || String(Date.now()));
  }, [token, role]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const openDashboard = () => {
    setOpen(false);
    if (role === "Manager") navigate("/manager");
    else if (role === "Nurse") navigate("/nurse");
    else if (role === "Parent") navigate("/parent");
    else navigate("/");
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          background: "#fff",
          color: "#222",
          border: "1px solid #20b2aa",
          borderRadius: 24,
          padding: "4px 14px 4px 6px",
          fontWeight: 600,
          cursor: "pointer",
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#20b2aa",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {getInitials(fullname)}
          </span>
        )}
        <span>{fullname}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            borderRadius: 8,
            minWidth: 180,
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={openDashboard}
            style={{
              width: "100%",
              padding: "12px 20px",
              border: 0,
              background: "#fff",
              textAlign: "left",
              cursor: "pointer",
              color: "#222",
            }}
          >
            回到工作首頁
          </button>
          <button
            type="button"
            onClick={logout}
            style={{
              width: "100%",
              padding: "12px 20px",
              border: 0,
              borderTop: "1px solid #eee",
              background: "#fff",
              textAlign: "left",
              cursor: "pointer",
              color: "#e11d48",
            }}
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
