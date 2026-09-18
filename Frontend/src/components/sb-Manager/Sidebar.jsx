import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, Home, LogOut, Menu, Rss, User, Users } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import style from "./Sidebar.module.css";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      setUsername(
        decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
          localStorage.getItem("fullname") ||
          ""
      );
    } catch {
      setUsername(localStorage.getItem("fullname") || "");
    }
  }, []);

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`${style.sbSidebar} ${isOpen ? style.expanded : style.collapsed}`}>
      {isOpen && (
        <div className={style.profileBox}>
          <div className={style.avatar}><User size={18} stroke="#20b2aa" /></div>
          <div className={style.profileName}>{username || "本機管理者"}</div>
        </div>
      )}

      <button type="button" className={style.navItem} onClick={() => setIsOpen((v) => !v)}>
        <Menu size={20} />
        {isOpen && <span className={style.systemName}>EduHealth 本機版</span>}
      </button>

      <nav>
        <NavLink to="/manager" className={({ isActive }) => `${style.navItem} ${isActive ? style.active : ""}`}>
          <Home size={20} /><span>管理首頁</span>
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `${style.navItem} ${isActive ? style.active : ""}`}>
          <Users size={20} /><span>使用者管理</span>
        </NavLink>
        <NavLink to="/manager/blog" className={({ isActive }) => `${style.navItem} ${isActive ? style.active : ""}`}>
          <Rss size={20} /><span>健康資訊管理</span>
        </NavLink>
        <NavLink to="/sendnotifications" className={({ isActive }) => `${style.navItem} ${isActive ? style.active : ""}`}>
          <Bell size={20} /><span>通知管理</span>
        </NavLink>
        <button type="button" className={`${style.navItem} ${style.logoutButton}`} onClick={logout}>
          <LogOut size={20} /><span>登出</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
