// VaccineResult.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import style from "../../assets/css/ResultPage.module.css";
import Notification from "../../components/Notification";
import LoadingOverlay from "../../components/LoadingOverlay";
import { notifySuccess, notifyError } from "../../utils/notification";

const VaccineResult = () => {
  const { id } = useParams();
  const [records, setRecords] = useState([]);
  const [campaignStatus, setCampaignStatus] = useState("");
  const [loading, setLoading] = useState(true);
  // Removed unused modalLoading state
  const [editingIndex, setEditingIndex] = useState(null);
  const [viewingIndex, setViewingIndex] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(
          `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${id}`
        );
        const statusName =
          res.data.data.statusName || res.data.data.status?.name;
        setCampaignStatus(statusName);
      } catch (error) {
        console.error("Lỗi lấy trạng thái chiến dịch:", error);
      }
    };
    fetchStatus();
  }, [id]);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `http://127.0.0.1:5080/api/VaccinationCampaign/campaigns/${id}/approved-consents`
        );
        const students = res.data.data || [];

        const allRecords = await Promise.all(
          students.map(async (student) => {
            try {
              const recordRes = await axios.get(
                `http://127.0.0.1:5080/api/VaccinationCampaign/records/student/${student.studentId}`
              );
              let record = recordRes.data.data;
              if (Array.isArray(record)) {
                record = record.find(
                  (r) => String(r.campaignId) === String(id)
                );
              }
              return { ...student, ...record };
            } catch {
              return { ...student };
            }
          })
        );
        setRecords(allRecords);
      } catch (error) {
        console.error("Lỗi lấy kết quả tiêm chủng:", error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    if (campaignStatus) fetchRecords();
  }, [id, campaignStatus]);

  const handleInputChange = (index, field, value) => {
    const updated = [...records];
    updated[index][field] = value;
    setRecords(updated);
  };

  const handleSave = async (index) => {
    const r = records[index];
    try {
      await axios.post(
        "http://127.0.0.1:5080/api/VaccinationCampaign/records",
        {
          studentId: r.studentId,
          campaignId: id,
          consentStatusId: r.consentStatusId || 2,
          vaccinationDate: r.vaccinationDate || new Date().toISOString(),
          result: r.result,
          followUpNote: r.followUpNote || "",
          isActive: true,
        },
        { headers: { "Content-Type": "application/json" } }
      );
      notifySuccess("儲存 thành công!");
      setEditingIndex(null);
    } catch (error) {
      notifyError(
        "Lỗi khi lưu dữ liệu: " + JSON.stringify(error.response?.data)
      );
    }
  };

  const handleSendNotificationAndEmail = async (student) => {
    try {
      // Gửi notification
      const note = student.followUpNote
        ? `備註: ${student.followUpNote}`
        : "無備註。";
      await axios.post(
        "http://127.0.0.1:5080/api/Notification/send",
        {
          receiverId: student.parentId,
          title: "預防接種結果",
          message: `學生 ${
            student.studentName
          } đã ${student.result.toLowerCase()} trong đợt tiêm chủng.\n${note}`,
          typeId: 2,
          isRead: false,
        },
        { headers: { "Content-Type": "application/json" } }
      );
      // Gửi email
      await axios.post(
        "http://127.0.0.1:5080/api/Email/send-by-userid",
        {
          userId: student.parentId,
          subject: `預防接種結果 cho học sinh ${student.studentName}`,
          body: `學生 ${
            student.studentName
          } đã ${student.result?.toLowerCase()} trong đợt tiêm chủng.\n${note}`,
        },
        { headers: { "Content-Type": "application/json" } }
      );
      notifySuccess("已建立家長本機通知。");
    } catch (error) {
      console.error("Lỗi khi gửi thông báo/email:", error);
      notifyError(
        "無法建立本機通知：" + error.response?.data?.message
      );
    }
  };

  // 批次建立本機通知
  const handleSendAllNotifications = async () => {
    const studentsToSend = records.filter(
      (r) =>
        r.result &&
        r.parentId !== null &&
        r.parentId !== undefined &&
        r.parentId !== "" &&
        (typeof r.parentId === "number" || typeof r.parentId === "string")
    );
    // Log các trường hợp không hợp lệ
    records.forEach((r) => {
      if (
        r.result &&
        (!r.parentId ||
          r.parentId === "" ||
          r.parentId === null ||
          r.parentId === undefined)
      ) {
        console.warn(
          "Không có parentId hợp lệ cho học sinh:",
          r.studentName,
          r
        );
      }
    });
    if (studentsToSend.length === 0) return;
    let successCount = 0;
    let failCount = 0;
    for (const student of studentsToSend) {
      if (
        !student.parentId ||
        student.parentId === "" ||
        student.parentId === null ||
        student.parentId === undefined
      ) {
        // Bỏ qua nếu không hợp lệ
        continue;
      }
      try {
        const note = student.followUpNote
          ? `備註: ${student.followUpNote}`
          : "無備註。";
        const notificationPayload = {
          receiverId: student.parentId,
          title: "預防接種結果",
          message: `學生 ${
            student.studentName
          } đã ${student.result.toLowerCase()} trong đợt tiêm chủng.\n${note}`,
          typeId: 2, // <-- SỬA LẠI TỪ 8 THÀNH 2
          isRead: false,
        };
        const emailPayload = {
          userId: student.parentId,
          subject: `預防接種結果 cho học sinh ${student.studentName}`,
          body: `學生 ${
            student.studentName
          } đã ${student.result?.toLowerCase()} trong đợt tiêm chủng.\n${note}`,
        };
        console.log(
          "Gửi notification cho:",
          student.studentName,
          "parentId:",
          student.parentId,
          "typeof:",
          typeof student.parentId
        );
        console.log("Notification payload:", notificationPayload);
        console.log("Email payload:", emailPayload);
        await axios.post(
          "http://127.0.0.1:5080/api/Notification/send",
          notificationPayload,
          { headers: { "Content-Type": "application/json" } }
        );
        await axios.post(
          "http://127.0.0.1:5080/api/Email/send-by-userid",
          emailPayload,
          { headers: { "Content-Type": "application/json" } }
        );
        successCount++;
      } catch (err) {
        failCount++;
        console.error(
          "Lỗi gửi cho:",
          student.studentName,
          "parentId:",
          student.parentId,
          err.response?.data || err.message
        );
      }
    }
    if (successCount > 0)
      notifySuccess(
        `Đã gửi thông báo & email cho ${successCount} phụ huynh thành công!`
      );
    if (failCount > 0)
      notifyError(`Không gửi được cho ${failCount} phụ huynh.`);
  };

  return (
    <div className={style.container}>
      {loading && <LoadingOverlay text="資料載入中..." />}
      <h2 className={style.title}>預防接種結果</h2>
      <button className={style.btnBack} onClick={() => navigate(-1)}>
        ← 返回
      </button>

      <button
        className={style.btnBack}
        style={{ marginBottom: 16, marginRight: 12 }}
        onClick={handleSendAllNotifications}
        disabled={records.filter((r) => r.result && r.parentId).length === 0}
      >
        批次建立本機通知
      </button>

      <table className={style.resultTable}>
        <thead>
          <tr>
            <th>STT</th>
            <th>學生</th>
            <th>家長／聯絡人</th>
            <th>回覆日期</th>
            <th>接種結果</th>
            <th>備註</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && !loading ? (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                目前沒有資料
              </td>
            </tr>
          ) : (
            records.map((r, index) => (
              <tr key={r.studentId}>
                <td>{index + 1}</td>
                <td>{r.studentName}</td>
                <td>{r.parentName}</td>
                <td>
                  {r.consentDate
                    ? new Date(r.consentDate).toLocaleDateString("zh-TW")
                    : ""}
                </td>
                {editingIndex === index ? (
                  <>
                    <td>
                      <select
                        value={r.result || ""}
                        onChange={(e) =>
                          handleInputChange(index, "result", e.target.value)
                        }
                      >
                        <option value="">-- 請選擇 --</option>
                        <option value="接種完成">接種完成</option>
                        <option value="未完成">未完成</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={r.followUpNote || ""}
                        onChange={(e) =>
                          handleInputChange(
                            index,
                            "followUpNote",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <button onClick={() => handleSave(index)}>儲存</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{r.result || "尚未登錄"}</td>
                    <td>{r.followUpNote || ""}</td>
                    <td>
                      {r.result && (
                        <button
                          onClick={() => setViewingIndex(index)}
                          className={style.detailBtn}
                        >
                          查看詳細資料
                        </button>
                      )}
                      {campaignStatus === "進行中" &&
                        (r.result ? (
                          <button onClick={() => setEditingIndex(index)}>
                            編輯
                          </button>
                        ) : (
                          <button onClick={() => setEditingIndex(index)}>
                            登錄
                          </button>
                        ))}
                      {campaignStatus === "已完成" && r.result && (
                        <button
                          onClick={() => handleSendNotificationAndEmail(r)}
                        >
                          建立本機通知
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {viewingIndex !== null && (
        <div className={style.detailModal}>
          <div className={style.modalContent}>
            <h3>接種結果詳細資料</h3>
            <p>
              <strong>學生:</strong> {records[viewingIndex].studentName}
            </p>
            <p>
              <strong>家長／聯絡人:</strong> {records[viewingIndex].parentName}
            </p>
            <p>
              <strong>接種結果:</strong> {records[viewingIndex].result}
            </p>
            <p>
              <strong>備註:</strong>{" "}
              {records[viewingIndex].followUpNote || "Không có"}
            </p>
            <button
              onClick={() => setViewingIndex(null)}
              className={style.closeBtn}
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

export default VaccineResult;
