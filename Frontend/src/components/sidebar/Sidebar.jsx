import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart2,
  CalendarPlus,
  ClipboardList,
  ClipboardPlus,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  Package,
  Syringe,
  User,
  Users,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import style from "./Sidebar.module.css";

const items = [
  { to: "/nurse", icon: Home, label: "健康中心首頁" },
  { to: "/students", icon: Users, label: "學生名單" },
  { to: "/incidents", icon: AlertTriangle, label: "傷病紀錄" },
  { to: "/medicine", icon: ClipboardList, label: "用藥管理" },
  { to: "/supplies", icon: Package, label: "醫療物資" },
  { to: "/vaccination-campaigns", icon: Syringe, label: "預防接種管理" },
  { to: "/vaccines", icon: ClipboardPlus, label: "接種批次明細" },
  { to: "/health-check-campaign", icon: CalendarPlus, label: "健康檢查排程" },
  { to: "/health-check", icon: HeartPulse, label: "健康檢查紀錄" },
  { to: "/report", icon: BarChart2, label: "統計報表" },
];

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
          <div className={style.avatar}>
            <User size={18} stroke="#20b2aa" />
          </div>
          <div className={style.profileName}>{username || "健康中心護理師"}</div>
        </div>
      )}

      <button
        type="button"
        className={style.navItem}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? "收合側邊欄" : "展開側邊欄"}
      >
        <Menu size={20} />
        {isOpen && <span className={style.systemName}>EduHealth 本機版</span>}
      </button>

      <nav>
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${style.navItem} ${isActive ? style.active : ""}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`${style.navItem} ${style.logoutButton}`}
          onClick={logout}
        >
          <LogOut size={20} />
          <span>登出</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
