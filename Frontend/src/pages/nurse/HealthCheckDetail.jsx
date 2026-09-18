import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Modal from "../../components/Modal";
import styles from "../../assets/css/HealthCheckDetail.module.css";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";
import HealthCheckDetailTour from "../../utils/HealthCheckDetailTour";
const HealthCheckDetail = () => {
  const { campaignId } = useParams(); // Lấy campaignId từ URL
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false); // loading khi submit modal
  const [campaign, setCampaign] = useState(null); // Thêm state cho chiến dịch
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [healthCheckSummaries, setHealthCheckSummaries] = useState([]);
  const [showModal, setShowModal] = useState(false); // Hiển thị modal
  const [modalType, setModalType] = useState(""); // 'add' hoặc 'edit'
  const [selectedStudent, setSelectedStudent] = useState(null); // Học sinh được chọn
  const [selectedRecord, setSelectedRecord] = useState(null); // Record được chọn để edit

  // Hàm xử lý dữ liệu form khi submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    const formData = new FormData(e.target);
    const healthDetails = Object.fromEntries(formData.entries());

    // Log dữ liệu form để kiểm tra
    console.log("Dữ liệu form: ", healthDetails);

    // Gửi dữ liệu đến API
    const dataToSubmit = {
      studentId: selectedStudent.studentId,
      campaignId: campaignId,
      bloodPressure: healthDetails.bloodPressure,
      heartRate: healthDetails.heartRate,
      height: healthDetails.height,
      weight: healthDetails.weight,
      bmi: healthDetails.bmi,
      visionSummary: healthDetails.vision,
      ent: healthDetails.ent,
      entNotes: healthDetails.entNotes,
      mouth: healthDetails.mouth,
      throat: healthDetails.throat,
      toothDecay: healthDetails.teeth,
      toothNotes: healthDetails.teethNotes,
      generalNote: healthDetails.overallHealth,
      followUpNote: healthDetails.recommendation,
      consentStatusId: 1, // Giả sử consentStatusId là 1 khi đồng ý
      isActive: true,
    };

    console.log("Dữ liệu gửi đi: ", dataToSubmit); // Kiểm tra dữ liệu gửi đi

    try {
      const response = await axios.post(
        "http://127.0.0.1:5080/api/health-checks/summaries",
        dataToSubmit
      );
      console.log("Dữ liệu đã được lưu:", response.data);
      notifySuccess("健康檢查資料已登錄。");
      setShowModal(false); // Đóng modal sau khi lưu thành công
      // Reload data
      fetchData();
    } catch (error) {
      console.error("Lỗi khi gửi dữ liệu:", error);
      if (error.response) {
        console.error("Lỗi từ server:", error.response.data);
        notifyError(
          "儲存健康檢查資料失敗：" + error.response.data.message
        );
      } else {
        notifyError("送出資料時發生錯誤。");
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Hàm chỉnh sửa thông tin sức khỏe học sinh
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    const formData = new FormData(e.target);
    const healthDetails = Object.fromEntries(formData.entries());

    // Gửi dữ liệu cập nhật đến API
    const dataToUpdate = {
      bloodPressure: healthDetails.bloodPressure,
      heartRate: healthDetails.heartRate,
      height: healthDetails.height,
      weight: healthDetails.weight,
      bmi: healthDetails.bmi,
      visionSummary: healthDetails.vision,
      ent: healthDetails.ent,
      entNotes: healthDetails.entNotes,
      mouth: healthDetails.mouth,
      throat: healthDetails.throat,
      toothDecay: healthDetails.teeth,
      toothNotes: healthDetails.teethNotes,
      generalNote: healthDetails.overallHealth,
      followUpNote: healthDetails.recommendation,
      consentStatusId: 1, // hoặc lấy từ form nếu cần
      isActive: true,
    };

    try {
      const response = await axios.put(
        `http://127.0.0.1:5080/api/health-checks/summaries/${selectedRecord.recordId}`,
        dataToUpdate
      );
      console.log("Dữ liệu đã được cập nhật:", response.data);
      notifySuccess("健康檢查資料更新成功。");
      setShowModal(false); // Đóng modal sau khi cập nhật thành công
      // Reload data
      fetchData();
    } catch (error) {
      console.error("Lỗi khi cập nhật dữ liệu:", error);
      if (error.response) {
        notifyError(
          "更新健康檢查資料失敗：" + error.response.data.message
        );
      } else {
        notifyError("送出更新資料時發生錯誤。");
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Thêm hàm gửi email qua userId
  const sendEmailToParent = async (userId, subject, body) => {
    try {
      await axios.post(
        "http://127.0.0.1:5080/api/Email/send-by-userid",
        {
          userId,
          subject,
          body,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch {
      // Đã log ở nơi gọi hàm, không cần xử lý thêm ở đây
      throw new Error("Gửi email thất bại");
    }
  };

  const sendNotificationToAll = async () => {
    if (!campaign) return;
    let hasError = false;
    try {
      await Promise.all(
        students.map(async (student) => {
          if (!student.parentId) return;
          // Gửi notification
          await axios.post(
            "http://127.0.0.1:5080/api/Notification/send",
            {
              receiverId: student.parentId,
              title: "健康檢查通知",
              message: `Học sinh ${student.fullName} sẽ tham gia chiến dịch kiểm tra sức khỏe: ${campaign.title}.\n說明： ${campaign.description}.\nNgày kiểm tra: ${campaign.date}`,
              typeId: 2,
              isRead: false,
            },
            {
              headers: { "Content-Type": "application/json" },
            }
          );
          // Gửi email
          try {
            await sendEmailToParent(
              student.parentId,
              "健康檢查通知 học sinh",
              `Học sinh ${student.fullName} sẽ tham gia chiến dịch kiểm tra sức khỏe: ${campaign.title}.\n說明： ${campaign.description}.\nNgày kiểm tra: ${campaign.date}`
            );
          } catch {
            hasError = true;
          }
        })
      );
      if (hasError) {
        notifyError("部分本機通知建立失敗，請確認。");
      } else {
        notifySuccess("已為家長建立本機通知。");
      }
    } catch (error) {
      console.error("Lỗi khi gửi thông báo/email hàng loạt:", error);
      notifyError("建立本機通知失敗，請稍後再試。");
    }
  };

  const fetchData = async () => {
    try {
      const campaignRes = await axios.get(
        `http://127.0.0.1:5080/api/HealthCheckCampaign/${campaignId}`
      );
      console.log("Campaign data:", campaignRes.data); // Kiểm tra dữ liệu chiến dịch
      setCampaign(campaignRes.data.data); // 儲存 chiến dịch
      // Lấy danh sách học sinh tham gia chiến dịch
      const studentsRes = await axios.get(
        `http://127.0.0.1:5080/api/student/`
      );
      setStudents(studentsRes.data.data || []);
      // Lấy toàn bộ health check summaries
      const summariesRes = await axios.get(
        `http://127.0.0.1:5080/api/health-checks/summaries`
      );
      setHealthCheckSummaries(summariesRes.data.data || []);
    } catch (error) {
      console.error("Lỗi khi gọi API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  // Hàm mở modal để thêm mới
  const openAddModal = (student) => {
    setSelectedStudent(student);
    setSelectedRecord(null);
    setModalType("add");
    setShowModal(true);
  };

  // Hàm mở modal để chỉnh sửa
  const openEditModal = (student, record) => {
    setSelectedStudent(student);
    setSelectedRecord(record);
    setModalType("edit");
    setShowModal(true);
  };

  // Hàm đóng modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedStudent(null);
    setSelectedRecord(null);
    setModalType("");
  };

  // Phân trang
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = students.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(students.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    if (currentPage > 1) handlePageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) handlePageChange(currentPage + 1);
  };

  if (loading || modalLoading)
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner}></div>
      </div>
    );

  return (
    <div className={styles.container}>
      <h1 id="page-title" className={styles.title}>
        學生名單－健康檢查活動 {campaignId}
      </h1>

      <button
        id="btn-back"
        className={styles.backButton}
        onClick={() => navigate(-1)}
      >
        ⬅ 返回
      </button>

      {campaign && (
        <div id="campaign-info">
          <p>
            <strong>活動名稱：</strong> {campaign.title}
          </p>
          <p>
            <strong>檢查日期：</strong> {campaign.date}
          </p>
          <p>
            <strong>說明：</strong> {campaign.description}
          </p>
          <p>
            <strong>狀態：</strong> {campaign.statusName}
          </p>
          {campaign.statusName === "尚未開始" && (
            <button
              id="btn-notify"
              onClick={sendNotificationToAll}
              className={styles.notifyButton}
            >
              建立本機通知
            </button>
          )}
          {campaign.statusName === "進行中" && (
            <button
              id="btn-complete"
              className={styles.saveButton}
              style={{ marginLeft: 12 }}
              onClick={async () => {
                try {
                  await axios.put(
                    `http://127.0.0.1:5080/api/HealthCheckCampaign/${campaignId}`,
                    { statusId: 3 }
                  );
                  notifySuccess("活動已標記為完成。");
                  fetchData();
                } catch {
                  notifyError("更新活動狀態失敗。");
                }
              }}
            >
              標記完成
            </button>
          )}
          {campaign.statusName === "已完成" && (
            <button
              id="btn-send-result"
              className={styles.saveButton}
              style={{ marginLeft: 12 }}
              onClick={async () => {
                let hasError = false;
                try {
                  // Lọc các học sinh có healthCheckSummaries trong chiến dịch này
                  const summaries = healthCheckSummaries.filter(
                    (s) => Number(s.campaignId) === Number(campaignId)
                  );
                  await Promise.all(
                    summaries.map(async (summary) => {
                      const student = students.find(
                        (stu) =>
                          Number(stu.studentId) === Number(summary.studentId)
                      );
                      if (!student || !student.parentId) return;
                      // Soạn nội dung kết quả
                      const result = `學生健康檢查結果：${
                        student.fullName
                      } trong chiến dịch "${campaign.title}":\n- 血壓： ${
                        summary.bloodPressure
                      }\n- 心率： ${summary.heartRate}\n- 身高： ${
                        summary.height
                      } cm\n- 體重： ${summary.weight} kg\n- BMI: ${
                        summary.bmi
                      }\n- 視力／眼睛： ${summary.visionSummary}\n- 耳鼻喉： ${
                        summary.ent
                      } (${summary.entNotes || ""})\n- 口腔： ${
                        summary.mouth
                      }\n- 咽喉： ${summary.throat}\n- 齲齒： ${
                        summary.toothDecay
                      } (${summary.toothNotes || ""})\n- 整體健康： ${
                        summary.generalNote
                      }\n- 後續建議： ${
                        summary.followUpNote || "無"
                      }\n檢查日期： ${campaign.date}`;
                      // Gửi notification
                      await axios.post(
                        "http://127.0.0.1:5080/api/Notification/send",
                        {
                          receiverId: student.parentId,
                          title: `學生健康檢查結果－${student.fullName}`,
                          message: result,
                          typeId: 2,
                          isRead: false,
                        },
                        {
                          headers: { "Content-Type": "application/json" },
                        }
                      );
                      // Gửi email
                      try {
                        await axios.post(
                          "http://127.0.0.1:5080/api/Email/send-by-userid",
                          {
                            userId: student.parentId,
                            subject: `學生健康檢查結果－${student.fullName}`,
                            body: result,
                          },
                          {
                            headers: { "Content-Type": "application/json" },
                          }
                        );
                      } catch {
                        hasError = true;
                      }
                    })
                  );
                  if (hasError) {
                    notifyError(
                      "部分本機通知建立失敗，請確認。"
                    );
                  } else {
                    notifySuccess(
                      "已建立所有學生的本機結果通知。"
                    );
                  }
                  // eslint-disable-next-line no-unused-vars
                } catch (err) {
                  notifyError("批次建立結果通知失敗。");
                }
              }}
            >
              建立結果通知
            </button>
          )}
        </div>
      )}

      {students.length === 0 ? (
        <p>無 học sinh trong chiến dịch này.</p>
      ) : (
        <>
          <table id="student-table" className={styles.table}>
            <thead>
              <tr>
                <th>STT</th>
                <th>學生姓名</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentStudents.map((student, index) => {
                const filteredSummaries = healthCheckSummaries.filter(
                  (s) => Number(s.campaignId) === Number(campaignId)
                );
                const summary = filteredSummaries.find(
                  (s) => Number(s.studentId) === Number(student.studentId)
                );
                const recordId = summary ? summary.recordId : null;
                return (
                  <tr key={student.studentId}>
                    <td>{indexOfFirstItem + index + 1}</td>
                    <td>{student.fullName || "未填寫姓名"}</td>
                    <td className={styles.actionButtons}>
                      {recordId ? (
                        <>
                          <Link to={`/health-record/${recordId}`}>
                            <button
                              className={`${styles.viewButton} btn-view-record`}
                            >
                              查看詳細資料
                            </button>
                          </Link>
                          {campaign &&
                            campaign.statusName === "進行中" && (
                              <button
                                className={`${styles.editButton} btn-edit-health`}
                                onClick={() => openEditModal(student, summary)}
                              >
                                編輯
                              </button>
                            )}
                        </>
                      ) : (
                        campaign &&
                        campaign.statusName === "進行中" && (
                          <button
                            className={`${styles.editButton} btn-add-edit`}
                            onClick={() => openAddModal(student)}
                          >
                            登錄
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div id="pagination" className={styles.pagination}>
            <button onClick={handlePrev} disabled={currentPage === 1}>
              ⬅ 上一頁
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={currentPage === i + 1 ? styles.activePage : ""}
              >
                {i + 1}
              </button>
            ))}
            <button onClick={handleNext} disabled={currentPage === totalPages}>
              Trang sau ➡
            </button>
          </div>
        </>
      )}

      {/* Modal Form */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={
          modalType === "add"
            ? "登錄 thông tin sức khỏe"
            : "編輯 thông tin sức khỏe"
        }
      >
        <form
          onSubmit={modalType === "add" ? handleFormSubmit : handleEditSubmit}
          className={styles.modalForm}
        >
          <div className={styles.formGroup}>
            <label htmlFor="bloodPressure">血壓（mmHg）：</label>
            <input
              type="number"
              step="any"
              id="bloodPressure"
              name="bloodPressure"
              defaultValue={
                modalType === "edit" ? selectedRecord?.bloodPressure : ""
              }
              placeholder="輸入血壓"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="heartRate">心率（bpm）：</label>
            <input
              type="number"
              id="heartRate"
              name="heartRate"
              defaultValue={
                modalType === "edit" ? selectedRecord?.heartRate : ""
              }
              placeholder="輸入心率"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="height">身高（cm）：</label>
            <input
              type="number"
              step="any"
              id="height"
              name="height"
              defaultValue={modalType === "edit" ? selectedRecord?.height : ""}
              placeholder="輸入身高"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="weight">體重（kg）：</label>
            <input
              type="number"
              step="any"
              id="weight"
              name="weight"
              defaultValue={modalType === "edit" ? selectedRecord?.weight : ""}
              placeholder="輸入體重"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="bmi">BMI:</label>
            <input
              type="number"
              step="any"
              id="bmi"
              name="bmi"
              defaultValue={modalType === "edit" ? selectedRecord?.bmi : ""}
              placeholder="輸入 BMI"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="vision">視力／眼睛：</label>
            <input
              type="text"
              id="vision"
              name="vision"
              defaultValue={
                modalType === "edit" ? selectedRecord?.visionSummary : ""
              }
              placeholder="視力／眼睛"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="ent">耳鼻喉：</label>
            <input
              type="text"
              id="ent"
              name="ent"
              defaultValue={modalType === "edit" ? selectedRecord?.ent : ""}
              placeholder="耳鼻喉"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="entNotes">耳鼻喉備註:</label>
            <input
              type="text"
              id="entNotes"
              name="entNotes"
              defaultValue={
                modalType === "edit" ? selectedRecord?.entNotes : ""
              }
              placeholder="耳鼻喉備註"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="mouth">口腔：</label>
            <input
              type="text"
              id="mouth"
              name="mouth"
              defaultValue={modalType === "edit" ? selectedRecord?.mouth : ""}
              placeholder="口腔"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="throat">咽喉：</label>
            <input
              type="text"
              id="throat"
              name="throat"
              defaultValue={modalType === "edit" ? selectedRecord?.throat : ""}
              placeholder="咽喉"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="teeth">齲齒：</label>
            <input
              type="text"
              id="teeth"
              name="teeth"
              defaultValue={
                modalType === "edit" ? selectedRecord?.toothDecay : ""
              }
              placeholder="齲齒"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="teethNotes">牙齒備註:</label>
            <input
              type="text"
              id="teethNotes"
              name="teethNotes"
              defaultValue={
                modalType === "edit" ? selectedRecord?.toothNotes : ""
              }
              placeholder="牙齒備註"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="overallHealth">整體健康：</label>
            <input
              type="text"
              id="overallHealth"
              name="overallHealth"
              defaultValue={
                modalType === "edit" ? selectedRecord?.generalNote : ""
              }
              placeholder="整體健康"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="recommendation">後續建議：</label>
            <input
              type="text"
              id="recommendation"
              name="recommendation"
              defaultValue={
                modalType === "edit" ? selectedRecord?.followUpNote : ""
              }
              placeholder="後續建議"
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={closeModal}
              className={styles.cancelButton}
            >
              取消
            </button>
            <button type="submit" className={styles.saveButton}>
              {modalType === "add" ? "儲存" : "更新"}
            </button>
          </div>
        </form>
      </Modal>
      <Notification />
      <HealthCheckDetailTour />
    </div>
  );
};

export default HealthCheckDetail;
