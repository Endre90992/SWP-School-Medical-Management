import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Sidebar from "../../components/sidebar/Sidebar";
import style from "../../assets/css/nursedashboard.module.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Notification from "../../components/Notification";
import LoadingOverlay from "../../components/LoadingOverlay";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f7f"];
const OVERVIEW_API = "http://127.0.0.1:5080/api/Dashboard/overview";

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const downloadCsv = (rows, fileName) => {
  const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};


const NurseReport = () => {
  const [stats, setStats] = useState({
    vaccination: null,
    medical: null,
    health: null,
    medication: null,
  });
  const [loading, setLoading] = useState(true);
  const reportRef = useRef();

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(OVERVIEW_API, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = response.data?.data;
        if (!data) throw new Error("報表總覽資料不存在");

        setStats({
          vaccination: {
            totalCampaigns: data.totalVaccinationCampaigns || 0,
            activeCampaigns: data.activeVaccinationCampaigns || 0,
            notStartedCampaigns: data.notStartedVaccinationCampaigns || 0,
            completedCampaigns: data.completedVaccinationCampaigns || 0,
            cancelledCampaigns: data.cancelledVaccinationCampaigns || 0,
          },
          medical: {
            totalMedicalEvents: data.totalMedicalEvents || 0,
            recentMedicalEvents: data.recentMedicalEvents || [],
          },
          health: {
            totalHealthCheckCampaigns: data.totalHealthCheckCampaigns || 0,
            activeHealthCheckCampaigns: data.activeHealthCheckCampaigns || 0,
          },
          medication: {
            totalMedicationRequests: data.totalMedicationRequests || 0,
            pendingMedicationRequests: data.pendingMedicationRequests || 0,
            recentMedicationRequests: data.recentMedicationRequests || [],
          },
        });
      } catch (err) {
        console.error("載入報表資料失敗：", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) return <LoadingOverlay text="資料載入中..." />;
  if (!stats.vaccination || !stats.medical || !stats.health || !stats.medication)
    return <div>目前無法載入報表資料。</div>;

  const vaccineData = [
    { name: "尚未開始", value: stats.vaccination.notStartedCampaigns },
    { name: "進行中", value: stats.vaccination.activeCampaigns },
    { name: "已完成", value: stats.vaccination.completedCampaigns },
    { name: "已取消", value: stats.vaccination.cancelledCampaigns },
  ];

  const healthChartData = [
    { name: "進行中", value: stats.health.activeHealthCheckCampaigns },
    {
      name: "其他",
      value:
        stats.health.totalHealthCheckCampaigns -
        stats.health.activeHealthCheckCampaigns,
    },
  ];

  const exportToExcel = () => {
    const rows = [
      ["類別", "數量"],
      ["預防接種活動", stats.vaccination.totalCampaigns],
      ["傷病紀錄", stats.medical.totalMedicalEvents],
      ["用藥申請", stats.medication.totalMedicationRequests],
      ["健康檢查活動", stats.health.totalHealthCheckCampaigns],
      [],
      ["近期用藥"],
      ["學生", "藥物", "狀態", "時間"],
      ...stats.medication.recentMedicationRequests.map((item) => [
        item.studentName,
        item.medicationName,
        item.status,
        new Date(item.requestDate).toLocaleString("zh-TW"),
      ]),
    ];

    downloadCsv(rows, "健康中心報表.csv");
  };

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className={style.container}>
      <Sidebar />
      <main className={style.dashboardWrapper}>
        <div className={style.header}>
          <h2>健康中心統計報表</h2>
          <p>校園健康中心業務總覽</p>
        </div>

        <div className={style.exportControls}>
          <button onClick={exportToExcel} className={style.btnExport}>📥 匯出試算表</button>
          <button onClick={exportToPDF} className={style.btnExport}>📄 列印／另存 PDF</button>
        </div>

        <div ref={reportRef}>
          <div className={style.summaryGrid}>
            <div className={style.summaryBox}>
              <h4>預防接種活動</h4>
              <p>{stats.vaccination.totalCampaigns}</p>
            </div>
            <div className={style.summaryBox}>
              <h4>傷病紀錄</h4>
              <p>{stats.medical.totalMedicalEvents}</p>
            </div>
            <div className={style.summaryBox}>
              <h4>用藥申請</h4>
              <p>{stats.medication.totalMedicationRequests}</p>
            </div>
            <div className={style.summaryBox}>
              <h4>健康檢查活動</h4>
              <p>{stats.health.totalHealthCheckCampaigns}</p>
            </div>
          </div>

          <div className={style.contentRow}>
            <div className={style.leftPanel}>
              <section className={style.card}>
                <h3>預防接種活動進度</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={vaccineData} dataKey="value" nameKey="name" outerRadius={100} label>
                      {vaccineData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            </div>

            <div className={style.rightPanel}>
              <section className={style.card}>
                <h3>健康檢查活動</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={healthChartData} dataKey="value" nameKey="name" outerRadius={100} label>
                      {healthChartData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Notification />
    </div>
  );
};

export default NurseReport;
