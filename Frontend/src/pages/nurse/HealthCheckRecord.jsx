import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "../../assets/css/HealthCheckRecord.module.css";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";


const HealthCheckRecord = () => {
  const { recordId } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const campaignStatus = location.state?.campaignStatus;
  const isEditMode = location.pathname.includes("/healthcheck-detail/");
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  // Nếu là ghi nhận mới (recordId === 'new')
  const isNewRecord = recordId === "new";
  const state = location.state || {};
  const [newRecord, setNewRecord] = useState({
    bloodPressure: "",
    heartRate: "",
    height: "",
    weight: "",
    bmi: "",
    visionSummary: "",
    ent: "",
    entNotes: "",
    mouth: "",
    toothDecay: "",
    toothNotes: "",
    throat: "",
    generalNote: "",
    followUpNote: "",
    consentStatusId: 1,
    isActive: true,
  });

  // Tự động tính BMI khi height/weight thay đổi
  useEffect(() => {
    if (newRecord.height && newRecord.weight) {
      const h = parseFloat(newRecord.height) / 100;
      const w = parseFloat(newRecord.weight);
      if (h > 0 && w > 0) {
        setNewRecord((r) => ({ ...r, bmi: (w / (h * h)).toFixed(1) }));
      }
    }
  }, [newRecord.height, newRecord.weight]);

  const handleNewChange = (e) => {
    const { name, value } = e.target;
    setNewRecord((r) => ({ ...r, [name]: value }));
  };

  const handleNewSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        "http://127.0.0.1:5080/api/health-checks/summaries",
        {
          ...newRecord,
          studentId: state.studentId,
          campaignId: state.campaignId,
          throat: newRecord.throat || "",
          consentStatusId: 1,
          isActive: true,
          generalNote: newRecord.generalNote,
          bloodPressure: Number(newRecord.bloodPressure),
          heartRate: Number(newRecord.heartRate),
          height: Number(newRecord.height),
          weight: Number(newRecord.weight),
          bmi: Number(newRecord.bmi),
        }
      );
      notifySuccess("健康檢查資料登錄成功。");
      navigate(-1);
    } catch (error) {
      notifyError(
        "登錄失敗：" + (error.response?.data?.message || error.message)
      );
    }
  };

  useEffect(() => {
    const fetchRecord = async () => {
      console.log("Fetching record with ID:", recordId);
      try {
        const res = await axios.get(
          `http://127.0.0.1:5080/api/health-checks/summaries/${recordId}`
        );
        console.log("Full API Response:", res);
        console.log("Response data:", res.data);

        if (res.data.status === "200") {
          console.log("Setting record data:", res.data.data);
          setRecord(res.data.data);
          if (res.data.data.campaignStatus === "進行中" && isEditMode) {
            setIsEditing(true);
          }
        } else {
          console.log("No data found or invalid status");
          setRecord(null);
        }
      } catch (error) {
        console.error("API Error Details:", {
          message: error.message,
          response: error.response,
          status: error.response?.status,
        });
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [recordId, isEditMode, campaignStatus]);

  // Tự động tính BMI khi height/weight thay đổi ở chế độ chỉnh sửa
  useEffect(() => {
    if (isEditing && record && record.height && record.weight) {
      const h = parseFloat(record.height) / 100;
      const w = parseFloat(record.weight);
      if (h > 0 && w > 0) {
        setRecord((r) => ({ ...r, bmi: (w / (h * h)).toFixed(1) }));
      }
    }
    // eslint-disable-next-line
  }, [isEditing, record?.height, record?.weight]);

  if (loading) return <LoadingOverlay text="健康檢查資料載入中..." />;


  if (!record)
    return (
      <div>
        <p>找不到健康檢查資料。</p>
        <button onClick={() => navigate(-1)}>⬅ 返回</button>
      </div>
    );

  // Hàm xử lý submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isNewRecord) {
        // Tạo mới
        await axios.post(
          "http://127.0.0.1:5080/api/health-checks/summaries",
          {
            ...record,
            throat: record.throat || "",
            consentStatusId: 1,
            isActive: true,
            generalNote: record.generalNote,
            bloodPressure: Number(record.bloodPressure),
            heartRate: Number(record.heartRate),
            height: Number(record.height),
            weight: Number(record.weight),
            bmi: Number(record.bmi),
          }
        );
        notifySuccess("健康檢查資料登錄成功。");
        navigate(-1);
      } else {
        // Cập nhật
        const res = await axios.put(
          `http://127.0.0.1:5080/api/health-checks/summaries/${recordId}`,
          {
            ...record,
            throat: record.throat || "",
            consentStatusId: 1,
            isActive: true,
            generalNote: record.generalNote,
            bloodPressure: Number(record.bloodPressure),
            heartRate: Number(record.heartRate),
            height: Number(record.height),
            weight: Number(record.weight),
            bmi: Number(record.bmi),
          }
        );
        if (res.status === 200) {
          notifySuccess("更新成功。");
          setIsEditing(false);
        } else {
          notifyError("更新失敗：" + (res.data?.message || ""));
        }
      }
    } catch (error) {
      notifyError(
        "送出資料失敗：" +
          (error.response?.data?.message || error.message)
      );
      console.error("Error while submitting the data", error);
    }
  };

  if (isNewRecord) {
    return (
      <div className={styles.container}>
        <h2>登錄健康檢查</h2>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ⬅ 返回
        </button>
        <form onSubmit={handleNewSubmit} className={styles.form}>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td>血壓</td>
                <td>
                  <input
                    name="bloodPressure"
                    value={newRecord.bloodPressure}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>心率</td>
                <td>
                  <input
                    name="heartRate"
                    value={newRecord.heartRate}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>身高</td>
                <td>
                  <input
                    name="height"
                    value={newRecord.height}
                    onChange={handleNewChange}
                    required
                  />{" "}
                  cm
                </td>
              </tr>
              <tr>
                <td>體重</td>
                <td>
                  <input
                    name="weight"
                    value={newRecord.weight}
                    onChange={handleNewChange}
                    required
                  />{" "}
                  kg
                </td>
              </tr>
              <tr>
                <td>BMI</td>
                <td>
                  <input name="bmi" value={newRecord.bmi} readOnly />
                </td>
              </tr>
              <tr>
                <td>視力／眼睛</td>
                <td>
                  <input
                    name="visionSummary"
                    value={newRecord.visionSummary}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>耳鼻喉</td>
                <td>
                  <input
                    name="ent"
                    value={newRecord.ent}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>耳鼻喉備註</td>
                <td>
                  <input
                    name="entNotes"
                    value={newRecord.entNotes}
                    onChange={handleNewChange}
                  />
                </td>
              </tr>
              <tr>
                <td>口腔</td>
                <td>
                  <input
                    name="mouth"
                    value={newRecord.mouth}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>齲齒</td>
                <td>
                  <input
                    name="toothDecay"
                    value={newRecord.toothDecay}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>牙齒備註</td>
                <td>
                  <input
                    name="toothNotes"
                    value={newRecord.toothNotes}
                    onChange={handleNewChange}
                  />
                </td>
              </tr>
              <tr>
                <td>咽喉</td>
                <td>
                  <input
                    name="throat"
                    value={newRecord.throat}
                    onChange={handleNewChange}
                  />
                </td>
              </tr>
              <tr>
                <td>整體健康</td>
                <td>
                  <input
                    name="generalNote"
                    value={newRecord.generalNote}
                    onChange={handleNewChange}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td>後續建議</td>
                <td>
                  <input
                    name="followUpNote"
                    value={newRecord.followUpNote}
                    onChange={handleNewChange}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit">儲存紀錄</button>
        </form>
      </div>
    );
  }

  const handleSendResultToParent = async () => {
    try {
      // 1. Lấy thông tin học sinh để truy xuất parentId
      const studentRes = await axios.get(
        `http://127.0.0.1:5080/api/Student/${record.studentId}`
      );
      const parentId = studentRes.data?.data?.parentId;

      if (!parentId) {
        notifyError("找不到此學生的家長／聯絡人。");
        return;
      }

      // 2. Soạn nội dung thông báo
      const message = `
家長您好：

以下為學生健康檢查結果：${
        record.studentName
      } trong chiến dịch "${record.campaignTitle}":

• 血壓: ${record.bloodPressure}
• 心率: ${record.heartRate}
• 身高: ${record.height} cm
• 體重: ${record.weight} kg
• BMI: ${record.bmi}
• 視力／眼睛: ${record.visionSummary}
• 耳鼻喉: ${record.ent} (${record.entNotes || "無備註"})
• 口腔: ${record.mouth}
• 齲齒: ${record.toothDecay} (${record.toothNotes || "無備註"})
• 咽喉: ${record.throat || "無備註"}
• 整體健康: ${record.generalNote}
• 後續建議: ${record.followUpNote || "無"}


學校健康中心
    `.trim();

      // 3. Gửi thông báo qua Notification
      let notificationSuccess = false;
      let emailSuccess = false;
      let notificationError = null;
      let emailError = null;
      try {
        const response = await axios.post(
          "http://127.0.0.1:5080/api/Notification/send",
          {
            receiverId: parentId, // ✅ đúng theo VaccineResult
            title: "健康檢查結果",
            message: message,
            typeId: 7, // Loại thông báo khám sức khỏe
            isRead: false,
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        if (response.status === 200 || response.status === 201) {
          notificationSuccess = true;
        } else {
          notificationError = response.data?.message || "未知錯誤";
        }
      } catch (error) {
        notificationError = error.response?.data?.message || error.message;
      }

      // 4. Gửi email qua API
      try {
        const emailRes = await axios.post(
          "http://127.0.0.1:5080/api/Email/send-by-userid",
          {
            userId: parentId,
            subject: "健康檢查結果 cho học sinh " + record.studentName,
            body: message,
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        if (emailRes.status === 200) {
          emailSuccess = true;
        } else {
          emailError = emailRes.data?.message || "未知錯誤";
        }
      } catch (error) {
        emailError = error.response?.data?.message || error.message;
      }

      // 5. Thông báo kết quả
      if (notificationSuccess && emailSuccess) {
        notifySuccess("已建立家長本機結果通知。");
      } else if (!notificationSuccess && !emailSuccess) {
        notifyError(
          `建立通知失敗。\nNotification: ${notificationError}\nEmail: ${emailError}`
        );
      } else if (!notificationSuccess) {
        notifyError(`本機通知失敗：${notificationError}`);
        notifySuccess("離線模式已略過電子郵件。");
      } else if (!emailSuccess) {
        notifyError(`電子郵件已停用：${emailError}`);
        notifySuccess("已建立家長本機通知。");
      }
    } catch (error) {
      console.error("建立結果通知失敗：", error);
      notifyError(
        "建立結果通知時發生錯誤：" +
          (error.response?.data?.message || error.message)
      );
    }
  };

  return (
    <div className={styles.container}>
      <Notification />
      <h2>健康檢查資料： {record.studentName}</h2>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        ⬅ 返回
      </button>
      <button
        onClick={handleSendResultToParent}
        className={styles.sendButton}
        style={{
          marginTop: "16px",
          padding: "10px 16px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        建立結果通知
      </button>

      {!isEditing && record.campaignStatus === "進行中" && isEditMode && (
        <button
          onClick={() => setIsEditing(true)}
          style={{ marginBottom: "10px" }}
        >
          登錄
        </button>
      )}

      {isEditing ? (
        <form onSubmit={handleSubmit}>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td>健康檢查活動</td>
                <td>{record.campaignTitle}</td>
              </tr>
              <tr>
                <td>血壓</td>
                <td>
                  <input
                    type="text"
                    value={record.bloodPressure}
                    onChange={(e) =>
                      setRecord({ ...record, bloodPressure: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>心率</td>
                <td>
                  <input
                    type="text"
                    value={record.heartRate}
                    onChange={(e) =>
                      setRecord({ ...record, heartRate: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>身高</td>
                <td>
                  <input
                    type="number"
                    value={record.height}
                    onChange={(e) =>
                      setRecord({ ...record, height: e.target.value })
                    }
                  />{" "}
                  cm
                </td>
              </tr>
              <tr>
                <td>體重</td>
                <td>
                  <input
                    type="number"
                    value={record.weight}
                    onChange={(e) =>
                      setRecord({ ...record, weight: e.target.value })
                    }
                  />{" "}
                  kg
                </td>
              </tr>
              <tr>
                <td>BMI</td>
                <td>{record.bmi}</td>
              </tr>
              <tr>
                <td>視力／眼睛</td>
                <td>
                  <input
                    type="text"
                    value={record.visionSummary}
                    onChange={(e) =>
                      setRecord({ ...record, visionSummary: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>耳鼻喉</td>
                <td>
                  <input
                    type="text"
                    value={record.ent}
                    onChange={(e) =>
                      setRecord({ ...record, ent: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>耳鼻喉備註</td>
                <td>
                  <input
                    type="text"
                    value={record.entNotes}
                    onChange={(e) =>
                      setRecord({ ...record, entNotes: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>口腔</td>
                <td>
                  <input
                    type="text"
                    value={record.mouth}
                    onChange={(e) =>
                      setRecord({ ...record, mouth: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>齲齒</td>
                <td>
                  <input
                    type="text"
                    value={record.toothDecay}
                    onChange={(e) =>
                      setRecord({ ...record, toothDecay: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>牙齒備註</td>
                <td>
                  <input
                    type="text"
                    value={record.toothNotes}
                    onChange={(e) =>
                      setRecord({ ...record, toothNotes: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>咽喉</td>
                <td>
                  <input
                    type="text"
                    value={record.throat || ""}
                    onChange={(e) =>
                      setRecord({ ...record, throat: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>整體健康</td>
                <td>
                  <input
                    type="text"
                    value={record.generalNote}
                    onChange={(e) =>
                      setRecord({ ...record, generalNote: e.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>後續建議</td>
                <td>
                  <input
                    type="text"
                    value={record.followUpNote}
                    onChange={(e) =>
                      setRecord({ ...record, followUpNote: e.target.value })
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit">儲存資料</button>
        </form>
      ) : (
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>健康檢查活動</td>
              <td>{record.campaignTitle}</td>
            </tr>
            <tr>
              <td>血壓</td>
              <td>{record.bloodPressure}</td>
            </tr>
            <tr>
              <td>心率</td>
              <td>{record.heartRate}</td>
            </tr>
            <tr>
              <td>身高</td>
              <td>{record.height} cm</td>
            </tr>
            <tr>
              <td>體重</td>
              <td>{record.weight} kg</td>
            </tr>
            <tr>
              <td>BMI</td>
              <td>{record.bmi}</td>
            </tr>
            <tr>
              <td>視力／眼睛</td>
              <td>{record.visionSummary}</td>
            </tr>
            <tr>
              <td>耳鼻喉</td>
              <td>{record.ent}</td>
            </tr>
            <tr>
              <td>耳鼻喉備註</td>
              <td>{record.entNotes}</td>
            </tr>
            <tr>
              <td>口腔</td>
              <td>{record.mouth}</td>
            </tr>
            <tr>
              <td>齲齒</td>
              <td>{record.toothDecay}</td>
            </tr>
            <tr>
              <td>牙齒備註</td>
              <td>{record.toothNotes}</td>
            </tr>
            <tr>
              <td>咽喉</td>
              <td>{record.throat || ""}</td>
            </tr>
            <tr>
              <td>整體健康</td>
              <td>{record.generalNote}</td>
            </tr>
            <tr>
              <td>後續建議</td>
              <td>{record.followUpNote}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HealthCheckRecord;
