import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import style from "../../assets/css/CampaignDetail.module.css";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import Guideline from "../../utils/CampaignDetailTour";
const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // New state for send consent options modal (move here to fix hook order)
  const [showSendOptions, setShowSendOptions] = useState(false);

  const [campaign, setCampaign] = useState(null);
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false); // loading khi gửi phiếu xác nhận
  const [sendResult, setSendResult] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const isChuaBatDau = (status) => status === "尚未開始";
  const isDangDienRa = (status) => status === "進行中";
  const isDaHoanThanh = (status) => status === "已完成";
  const isDaHuy = (status) => status === "已取消";

  // State cho phạm vi gửi và dữ liệu học sinh/lớp
  const [sendScope, setSendScope] = useState("all"); // "all" hoặc "class"
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [classList, setClassList] = useState([]); // Danh sách lớp
  const [studentList, setStudentList] = useState([]); // 學生名單 hiển thị
  const [allStudents, setAllStudents] = useState([]); // Toàn bộ học sinh
  const [autoDeclineAfterDays, setAutoDeclineAfterDays] = useState(1); // Số 天 tự động 不同意

  useEffect(() => {
    const fetchCampaignDetail = async () => {
      const res = await axios.get(
        `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns`
      );
      const campaignData = res.data.data.find(
        (item) => item.campaignId.toString() === id
      );
      setCampaign(campaignData);
    };

    const fetchConsents = async () => {
      const res = await axios.get(
        `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${id}/consent-requests`
      );
      setConsents(res.data.data);
    };

    const fetchStudents = async () => {
      try {
        const res = await axios.get("/api/Student");
        const students = Array.isArray(res.data.data) ? res.data.data : [];
        setAllStudents(students);
        // Lấy danh sách lớp duy nhất
        const uniqueClasses = Array.from(
          new Set(students.map((s) => s.className).filter(Boolean))
        );
        setClassList(uniqueClasses);
        // Nếu mặc định là toàn trường thì hiển thị toàn bộ học sinh
        setStudentList(students);
      } catch {
        setAllStudents([]);
        setClassList([]);
        setStudentList([]);
      }
    };

    Promise.all([
      fetchCampaignDetail(),
      fetchConsents(),
      fetchStudents(),
    ]).finally(() => setLoading(false));
  }, [id]);

  // Khi chọn phạm vi gửi hoặc lớp thì cập nhật danh sách học sinh hiển thị
  useEffect(() => {
    if (sendScope === "all") {
      setStudentList(allStudents);
    } else if (sendScope === "class" && selectedClasses.length > 0) {
      setStudentList(
        allStudents.filter((s) => selectedClasses.includes(s.className))
      );
    } else {
      setStudentList([]);
    }
  }, [sendScope, selectedClasses, allStudents]);

  // Thêm hàm gửi email qua userId
  const sendEmailToParent = async (userId, subject, body) => {
    try {
      await axios.post("/api/Email/send-by-userid", {
        userId,
        subject,
        body,
      });
    } catch (err) {
      console.error("Gửi email thất bại cho userId:", userId, err);
    }
  };

  // --- VALIDATION HELPER ---
  const isCompletedOrCancelled = (status) =>
    status === "已完成" || status === "已取消";

  const handleSendConsentToAll = async () => {
    // Validation: Không gửi nếu đã hoàn thành/hủy
    if (isCompletedOrCancelled(campaign.statusName)) {
      notifyError(
        "活動已完成或取消，無法再建立同意回覆。"
      );
      return;
    }
    try {
      setModalLoading(true);
      if (!campaign || !campaign.campaignId) {
        notifyError("找不到接種活動資料。");
        return;
      }
      const res = await axios.post(
        `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${campaign.campaignId}/send-consent-to-all-parents`,
        null,
        { params: { autoDeclineAfterDays } }
      );
      setSendResult(res.data.data);
      notifySuccess("已建立家長本機通知。");
      setShowModal(true);
      const consentsRes = await axios.get(
        `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${campaign.campaignId}/consent-requests`
      );
      setConsents(consentsRes.data.data);
      // Gửi email cho từng phụ huynh
      const subject = "學生預防接種確認";
      const body =
        "請家長確認學生本次預防接種意願。";
      const parentIds = [
        ...new Set(allStudents.map((stu) => stu.parentId).filter(Boolean)),
      ];
      for (const parentId of parentIds) {
        await sendEmailToParent(parentId, subject, body);
      }
    } catch (err) {
      console.error("建立接種意願確認 thất bại:", err, err.response?.data);
      notifyError(
        "建立接種確認失敗：" +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleStartCampaign = async () => {
    // Validation: Không có sự 同意 từ phụ huynh
    const agreedStudents = consents
      .filter((c) => c.consentStatusName === "同意")
      .map((c) => parseInt(c.studentId));
    if (agreedStudents.length === 0) {
      notifyError("尚無家長同意資料，無法建立接種紀錄。");
      return;
    }
    try {
      if (!isChuaBatDau(campaign.statusName)) {
        notifyError(
          "只有「尚未開始」的活動可以開始。"
        );
        return;
      }

      await axios.put(
        "http://127.0.0.1:5080/api/VaccinationCampaign/campaigns",
        {
          vaccineName: campaign.vaccineName,
          date: campaign.date,
          description: campaign.description,
          createdBy: campaign.createdBy,
          statusId: 2,
          campaignId: campaign.campaignId,
        }
      );

      notifySuccess("接種活動已開始。");
      setCampaign((prev) => ({
        ...prev,
        statusName: "進行中",
        statusId: 2,
        totalVaccinationRecords: agreedStudents.length,
      }));
    } catch (err) {
      console.error("Lỗi khi khởi động chiến dịch:", err, err.response?.data);
      notifyError(
        "無法開始接種活動：" +
          (err.response?.data?.message || err.message)
      );
    }
  };

  const handleMarkAsCompleted = async () => {
    // Validation: Không có bản ghi tiêm chủng nào
    if (
      !campaign.totalVaccinationRecords ||
      campaign.totalVaccinationRecords === 0
    ) {
      notifyError(
        "尚無接種紀錄，無法將活動標記為完成。"
      );
      return;
    }
    try {
      await axios.put(
        `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${id}/deactivate`
      );
      notifySuccess("接種活動已標記為完成。");
      setCampaign((prev) => ({
        ...prev,
        statusName: "已完成",
      }));
    } catch (err) {
      console.error("Lỗi khi đánh dấu hoàn thành:", err);
      notifyError("無法更新接種活動狀態。");
    }
  };

  const exportToExcel = () => {
    const agreed = consents.filter((c) => c.consentStatusName === "同意");
    const rejected = consents.filter((c) => c.consentStatusName === "不同意");
    const pending = consents.filter(
      (c) => c.consentStatusName === "待回覆"
    );

    // Sheet 1: 摘要
    const summarySheet = [
      ["活動名稱", campaign.vaccineName],
      ["接種日期", campaign.date],
      ["回覆總數", consents.length],
      ["同意人數", agreed.length],
      ["不同意人數", rejected.length],
      ["尚未回覆", pending.length],
    ];

    // Sheet 2: Chi tiết
    const detailHeader = [
      "STT",
      "學生",
      "家長／聯絡人",
      "狀態",
      "回覆日期",
    ];
    const detailRows = consents.map((c, idx) => [
      idx + 1,
      c.studentName,
      c.parentName,
      c.consentStatusName,
      c.consentDate ? new Date(c.consentDate).toLocaleDateString("zh-TW") : "",
    ]);

    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ...summarySheet,
      [],
      ["回覆明細"],
      detailHeader,
      ...detailRows,
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const safeName = String(campaign.vaccineName || "預防接種").replace(/[\\/:*?"<>|]/g, "_");
    anchor.download = `預防接種_${safeName}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const totalAgreed = consents.filter(
    (c) => c.consentStatusName === "同意"
  ).length;
  const totalRejected = consents.filter(
    (c) => c.consentStatusName === "不同意"
  ).length;

  const filteredConsents = consents.filter((c) => {
    if (activeTab === "approved") return c.consentStatusName === "同意";
    if (activeTab === "rejected") return c.consentStatusName === "不同意";
    return true;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentConsents = filteredConsents.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredConsents.length / itemsPerPage);
  const consentByDate = {};
  consents.forEach((c) => {
    if (c.consentDate) {
      const dateStr = new Date(c.consentDate).toDateString();
      consentByDate[dateStr] = (consentByDate[dateStr] || 0) + 1;
    }
  });

  return (
    <div className={style.container}>
      <h2 id="campaign-title">預防接種活動詳細資料</h2>
      <Guideline />

      {/* Info cards section */}
      <div id="info-row" className={style.infoRow}>
        <div className={style.infoCard}>
          <div className={style.infoTitle}>名稱</div>
          <div className={style.infoValue}>{campaign.vaccineName}</div>
        </div>
        <div className={style.infoCard}>
          <div className={style.infoTitle}>說明</div>
          <div className={style.infoValue}>{campaign.description}</div>
        </div>
        <div className={style.infoCard}>
          <div className={style.infoTitle}>日期</div>
          <div className={style.infoValue}>{campaign.date}</div>
        </div>
        <div className={style.infoCard}>
          <div className={style.infoTitle}>狀態</div>
          <div className={style.infoValue}>{campaign.statusName}</div>
        </div>
        {/* 統計 card */}
        <div className={style.statsCard}>
          <div className={style.infoTitle}>統計</div>
          <div className={style.statsRow}>
            <div className={style.statBox}>
              <span className={`${style.statNum} ${style.agree}`}>
                {totalAgreed}
              </span>
              <span className={style.statLabel}>同意</span>
            </div>
            <div className={style.statBox}>
              <span className={`${style.statNum} ${style.reject}`}>
                {totalRejected}
              </span>
              <span className={style.statLabel}>不同意</span>
            </div>
          </div>
        </div>
      </div>

      {/* Send consent options modal */}
      {showSendOptions && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "#0006",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 32,
              minWidth: 320,
              boxShadow: "0 2px 16px #0002",
              textAlign: "center",
            }}
          >
            <h3>選擇接種意願確認範圍</h3>
            <button
              style={{
                margin: "16px 0",
                padding: "10px 24px",
                borderRadius: 6,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
              }}
              onClick={async () => {
                setShowSendOptions(false);
                await handleSendConsentToAll();
              }}
            >
              全校學生
            </button>
            <br />
            <button
              style={{
                margin: "8px 0",
                padding: "10px 24px",
                borderRadius: 6,
                background: "#10b981",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
              }}
              onClick={() => {
                setShowSendOptions(false);
                setSendScope("class");
              }}
            >
              依班級
            </button>
            <br />
            <button
              style={{
                marginTop: 16,
                background: "none",
                color: "#ef4444",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => setShowSendOptions(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Class selection and student list only if sendScope is 'class' and campaign chưa bắt đầu */}
      {sendScope === "class" &&
        (isChuaBatDau(campaign.statusName) ||
          isDangDienRa(campaign.statusName)) && (
          <div className={style.sendClassCard}>
            <div className={style.sendClassTitle}>
              依班級建立接種意願確認
            </div>
            <div
              className={style.sendClassRow}
              style={{ flexWrap: "wrap", alignItems: "flex-start" }}
            >
              {/* Danh sách checkbox lớp dạng lưới 4 cột */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px 0",
                  width: "100%",
                }}
              >
                {classList.map((cls) => (
                  <label
                    key={cls}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 500,
                      width: "24%",
                      minWidth: 120,
                      marginBottom: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClasses.includes(cls)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClasses((prev) => [...prev, cls]);
                        } else {
                          setSelectedClasses((prev) =>
                            prev.filter((c) => c !== cls)
                          );
                        }
                      }}
                    />
                    {cls}
                  </label>
                ))}
              </div>
            </div>
            {/* Input số 天 quy định nằm dưới, căn giữa */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "12px 0 0 0",
              }}
            >
              <span className={style.sendClassInputLabel}>
                回覆期限：
              </span>
              <input
                type="number"
                min={1}
                value={autoDeclineAfterDays}
                onChange={(e) =>
                  setAutoDeclineAfterDays(Number(e.target.value))
                }
                className={style.sendClassInput}
              />
              <span>天</span>
            </div>
            <div className={style.sendClassList}>
              <div className={style.sendClassListTitle}>
                學生名單 ({studentList.length}):
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {studentList.map((stu) => (
                  <li key={stu.studentId}>
                    {stu.fullName} ({stu.className})
                  </li>
                ))}
              </ul>
            </div>
            <button
              className={style.sendClassBtn}
              disabled={selectedClasses.length === 0}
              onClick={async () => {
                // Validation: Không gửi nếu đã hoàn thành/hủy
                if (isCompletedOrCancelled(campaign.statusName)) {
                  notifyError(
                    "活動已完成或取消，無法再建立同意回覆。"
                  );
                  return;
                }
                if (selectedClasses.length > 0) {
                  try {
                    for (const cls of selectedClasses) {
                      await axios.post(
                        `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${campaign.campaignId}/send-consent-by-class`,
                        { className: cls, autoDeclineAfterDays }
                      );
                    }
                    notifySuccess("已為選取班級建立接種意願確認。");
                    // Load lại consents nếu cần
                    const consentsRes = await axios.get(
                      `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${campaign.campaignId}/consent-requests`
                    );
                    setConsents(consentsRes.data.data);
                    // Gửi email cho từng phụ huynh với thông tin học sinh cụ thể
                    for (const stu of studentList) {
                      // Kiểm tra học sinh đã nhận phiếu hoặc đã xác nhận chưa
                      const consent = consents.find(
                        (c) => String(c.studentId) === String(stu.studentId)
                      );
                      if (
                        stu.parentId &&
                        (!consent || consent.consentStatusName === "待回覆")
                      ) {
                        const subject = "學生預防接種確認";
                        const body = `請確認學生 ${stu.fullName}（${stu.className}）的預防接種意願。`;
                        await sendEmailToParent(stu.parentId, subject, body);
                      }
                    }
                    setSendScope("all"); // Ẩn form sau khi gửi thành công
                  } catch {
                    notifyError("建立接種意願確認失敗。");
                  }
                }
              }}
            >
              確認此班級
            </button>
            <button
              style={{
                background: "#f3f4f6",
                color: "#ef4444",
                border: "none",
                borderRadius: 6,
                padding: "10px 0",
                fontSize: "1.05rem",
                fontWeight: 600,
                marginTop: 8,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onClick={() => setSendScope("all")}
            >
              取消
            </button>
          </div>
        )}

      <div className={style.actions}>
        {(isChuaBatDau(campaign.statusName) ||
          isDangDienRa(campaign.statusName)) && (
          <button
          id="btn-send"
            className={style.btnNotify}
            onClick={() => setShowSendOptions(true)}
          >
            建立接種意願確認
          </button>
        )}
        {isChuaBatDau(campaign.statusName) && totalAgreed > 0 && (
          <button  id="btn-start" className={style.btnStart} onClick={handleStartCampaign}>
            開始接種活動
          </button>
        )}
        {isDaHoanThanh(campaign.statusName) && (
          <>
            <button id="btn-export"   className={style.btnExport} onClick={exportToExcel}>
              匯出 CSV（Excel 可開啟）
            </button>
          </>
        )}
        {isDangDienRa(campaign.statusName) && (
          <button id="btn-complete" className={style.btnComplete} onClick={handleMarkAsCompleted}>
            標記為完成
          </button>
        )}
        {isDaHuy(campaign.statusName) && (
          <span className={style.cancelledTag}> 已取消</span>
        )}
        <button id="btn-result" onClick={() => navigate(`/vaccines/${id}/result`)}>
          查看接種結果
        </button>
      </div>

      <div id="tab-row" className={style.tabRow}>
        <button
          className={activeTab === "all" ? style.activeTab : ""}
          onClick={() => {
            setActiveTab("all");
            setCurrentPage(1);
          }}
        >
          全部 ({consents.length})
        </button>
        <button
          className={activeTab === "approved" ? style.activeTab : ""}
          onClick={() => {
            setActiveTab("approved");
            setCurrentPage(1);
          }}
        >
          同意 ({totalAgreed})
        </button>
        <button
          className={activeTab === "rejected" ? style.activeTab : ""}
          onClick={() => {
            setActiveTab("rejected");
            setCurrentPage(1);
          }}
        >
          不同意 ({totalRejected})
        </button>
      </div>

      <table  id="consent-table" className={style.table}>
        <thead>
          <tr>
            <th>學生</th>
            <th>家長／聯絡人</th>
            <th>狀態</th>
            <th>回覆日期</th>
          </tr>
        </thead>
        <tbody>
          {currentConsents.map((c) => (
            <tr key={c.requestId}>
              <td>{c.studentName}</td>
              <td>{c.parentName}</td>
              <td>
                <span
                  className={
                    style[`status-${c.consentStatusName.replace(/\s/g, "-")}`]
                  }
                >
                  {c.consentStatusName}
                </span>
              </td>
              <td>
                {c.consentDate
                  ? new Date(c.consentDate).toLocaleDateString("zh-TW")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={style.pagination}>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            className={currentPage === i + 1 ? style.activePage : ""}
            onClick={() => setCurrentPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Removed chart and calendar section as requested */}

      <button onClick={() => navigate(-1)} id="btn-back" className={style.btnBack}>
        ← 返回
      </button>

      {showModal && sendResult && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>建立確認結果</h3>
            <p>
              🟢 成功: <strong>{sendResult.successCount}</strong> /{" "}
              {sendResult.totalStudents}
            </p>
            <p>
              🔴 失敗: <strong>{sendResult.failedCount}</strong>
            </p>
            {sendResult.failedReasons.length > 0 && (
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  marginTop: "10px",
                }}
              >
                <ul>
                  {sendResult.failedReasons.map((reason, idx) => (
                    <li
                      key={idx}
                      style={{ fontSize: "14px", marginBottom: "4px" }}
                    >
                      • {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => setShowModal(false)}
              className={style.btnBack}
            >
              關閉
            </button>
          </div>
        </div>
      )}

      <Notification />
    </div>
  );
};

export default CampaignDetail;
