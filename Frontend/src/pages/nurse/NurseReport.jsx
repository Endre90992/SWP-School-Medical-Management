import React, { useEffect, useState, useRef } from "react";
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
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Notification from "../../components/Notification";
import LoadingOverlay from "../../components/LoadingOverlay";
// import { notifySuccess, notifyError } from "../../utils/notification";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f7f"];

const NurseReport = () => {
  const [stats, setStats] = useState({
    vaccination: null,
    medical: null,
    health: null,
    medication: null,
  });
  const [loading, setLoading] = useState(true); // loading fetch list
  const reportRef = useRef();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [vaccine, medical, health, medication] = await Promise.all([
          axios.get("http://127.0.0.1:5080/api/Dashboard/vaccination-campaigns/statistics"),
          axios.get("http://127.0.0.1:5080/api/Dashboard/medical-events-statistics"),
          axios.get("http://127.0.0.1:5080/api/Dashboard/health-statistics"),
          axios.get("http://127.0.0.1:5080/api/Dashboard/medication-statistics"),
        ]);
        setStats({
          vaccination: vaccine.data.data,
          medical: medical.data.data,
          health: health.data.data,
          medication: medication.data.data,
        });
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading)
    return <LoadingOverlay text="資料載入中..." />;
  if (!stats.vaccination || !stats.medical || !stats.health || !stats.medication)
    return <div>報表資料載入中...</div>;

  const vaccineData = [
    { name: "尚未開始", value: stats.vaccination.notStartedCampaigns },
    { name: "進行中", value: stats.vaccination.activeCampaigns },
    { name: "已完成", value: stats.vaccination.completedCampaigns },
    { name: "已取消", value: stats.vaccination.cancelledCampaigns },
  ];

  const healthChartData = [
    { name: "進行中", value: stats.health.activeHealthCheckCampaigns },
    {
      name: "尚未排程",
      value:
        stats.health.totalHealthCheckCampaigns -
        stats.health.activeHealthCheckCampaigns,
    },
  ];

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const overviewData = [
      ["類別", "數量"],
      ["預防接種活動", stats.vaccination.totalCampaigns],
      ["傷病紀錄", stats.medical.totalMedicalEvents],
      ["用藥申請", stats.medication.totalMedicationRequests],
      ["健康檢查活動", stats.health.totalHealthCheckCampaigns],
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, "總覽");

    const meds = stats.medication.recentMedicationRequests.map((item) => ({
      Học_sinh: item.studentName,
      Thuốc: item.medicationName,
      Trạng_thái: item.status,
      Thời_gian: new Date(item.requestDate).toLocaleString("zh-TW"),
    }));
    const medsSheet = XLSX.utils.json_to_sheet(meds);
    XLSX.utils.book_append_sheet(wb, medsSheet, "近期用藥");

    XLSX.writeFile(wb, "bao_cao_y_te.xlsx");
  };

  const exportToPDF = () => {
    const input = reportRef.current;
    html2canvas(input).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save("bao_cao_y_te.pdf");
    });
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
          <button onClick={exportToExcel} className={style.btnExport}>📥 匯出 Excel</button>
          <button onClick={exportToPDF} className={style.btnExport}>📄 匯出 PDF</button>
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
                    <Pie
                      data={vaccineData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label
                    >
                      {vaccineData.map((entry, index) => (
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
                    <Pie
                      data={healthChartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label
                    >
                      {healthChartData.map((entry, index) => (
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
      {loading && <LoadingOverlay text="資料載入中..." />}
      <Notification />
    </div>
  );
};

export default NurseReport;
