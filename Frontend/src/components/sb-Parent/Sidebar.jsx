import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, ClipboardList, HeartPulse, Home, LogOut, Menu, User } from "lucide-react";
import styles from "./Sidebar.module.css";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setUsername(localStorage.getItem("fullname") || "家長");
  }, []);

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`${styles.sbSidebar} ${isOpen ? styles.expanded : styles.collapsed}`}>
      {isOpen && (
        <div className={styles.profileBox}>
          <div className={styles.avatar}><User size={18} stroke="#20b2aa" /></div>
          <div className={styles.profileName}>{username}</div>
        </div>
      )}

      <button type="button" className={styles.navItem} onClick={() => setIsOpen((v) => !v)}>
        <Menu size={20} />
        {isOpen && <span className={styles.systemName}>EduHealth</span>}
      </button>

      <nav>
        <NavLink to="/parent" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}>
          <Home size={20} /><span>首頁</span>
        </NavLink>
        <NavLink to="/healthprofile" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}>
          <HeartPulse size={20} /><span>學生健康資料</span>
        </NavLink>
        <NavLink to="/sendmedicine" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}>
          <ClipboardList size={20} /><span>用藥申請</span>
        </NavLink>
        <NavLink to="/hisofcare" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}>
          <HeartPulse size={20} /><span>照護紀錄</span>
        </NavLink>
        <NavLink to="/notification" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}>
          <Bell size={20} /><span>通知與回覆</span>
        </NavLink>
        <button type="button" className={`${styles.navItem} ${styles.logoutButton}`} onClick={logout}>
          <LogOut size={20} /><span>登出</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
