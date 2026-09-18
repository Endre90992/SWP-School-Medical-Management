import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import Sidebar from "../../components/sidebar/Sidebar";
import UserMenu from "../../components/UserMenu";
import style from "../../assets/css/nursedashboard.module.css";

const API_URL = "http://127.0.0.1:5080/api/Dashboard/overview";
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f7f", "#4D96FF", "#F4C430"];

const NurseDashBoard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(API_URL, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (String(res.data?.status) === "200") {
          setDashboardData(res.data.data);
        }
      } catch (error) {
        console.error("無法載入健康中心儀表板：", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const incidentChartData = useMemo(() => {
    const count = {};
    (dashboardData?.recentMedicalEvents || []).forEach((event) => {
      const type = event.eventType || "未分類";
      count[type] = (count[type] || 0) + 1;
    });
    return Object.entries(count).map(([name, value]) => ({ name, value }));
  }, [dashboardData]);

  if (loading) {
    return (
      <div className={style.loadingOverlay}>
        <div className={style.spinner} />
        <div className={style.loadingText}>資料載入中...</div>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className={style.loadingText}>目前沒有儀表板資料</div>;
  }

  const recentEvents = dashboardData.recentMedicalEvents || [];
  const recentMedicationRequests = dashboardData.recentMedicationRequests || [];

  return (
    <div className={style.container}>
      <Sidebar />
      <main className={style.dashboardWrapper}>
        <header className={style.dashboardHeaderBar}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className={style.titleGroup}>
              <h1>
                <span className={style.textBlack}>健康中心</span>
                <span className={style.textAccent}> 儀表板</span>
              </h1>
            </div>
            <UserMenu />
          </div>
        </header>

        <div className={style.summaryGrid}>
          <div className={style.summaryBox}>
            <h4>待處理用藥申請</h4>
            <p>{dashboardData.pendingMedicationRequests || 0}</p>
            <span>
              {(dashboardData.totalMedicationRequests || 0) -
                (dashboardData.pendingMedicationRequests || 0)}{" "}
              筆已處理
            </span>
          </div>
          <div className={style.summaryBox}>
            <h4>預防接種活動</h4>
            <p>{dashboardData.totalVaccinationCampaigns || 0}</p>
            <span>本機資料庫中的接種活動</span>
          </div>
          <div className={style.summaryBox}>
            <h4>健康檢查</h4>
            <p>{dashboardData.totalHealthCheckCampaigns || 0}</p>
            <span>{dashboardData.activeHealthCheckCampaigns || 0} 個進行中</span>
          </div>
          <div className={style.summaryBox}>
            <h4>近期傷病紀錄</h4>
            <p>{recentEvents.length}</p>
            <span>可至「傷病紀錄」查看完整內容</span>
          </div>
        </div>

        <div className={style.contentRow}>
          <div className={style.leftPanel}>
            <section className={style.card}>
              <div className={style.cardHeader}>
                <h3>近期用藥申請</h3>
              </div>
              <table className={style.styledTable}>
                <thead>
                  <tr>
                    <th>學生</th>
                    <th>藥物</th>
                    <th>狀態</th>
                    <th>申請時間</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMedicationRequests.length === 0 ? (
                    <tr><td colSpan="4">目前沒有用藥申請</td></tr>
                  ) : (
                    recentMedicationRequests.map((req) => (
                      <tr key={req.requestId}>
                        <td>{req.studentName || "—"}</td>
                        <td>{req.medicationName || "—"}</td>
                        <td><span className={style.pill}>{req.status || "—"}</span></td>
                        <td>{req.requestDate ? new Date(req.requestDate).toLocaleString("zh-TW") : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <div className={style.rightPanel}>
            <section className={style.card}>
              <h3>近期傷病類型統計</h3>
              {incidentChartData.length === 0 ? (
                <p>目前沒有傷病紀錄</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={incidentChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name }) => name}
                    >
                      {incidentChartData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NurseDashBoard;
