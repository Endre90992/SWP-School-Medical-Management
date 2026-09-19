import React, { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "../../components/sb-Parent/Sidebar";
import styles from "../../assets/css/SendMedicine.module.css";
import Notification from "../../components/Notification";
import Modal from "../../components/Modal";
import { FiInfo, FiEdit, FiClipboard } from "react-icons/fi";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ProtectedAttachmentLink from "../../components/ProtectedAttachmentLink";

const SendMedicine = () => {
  const [title, setTitle] = useState("");
  const [usage, setUsage] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [history, setHistory] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState(localStorage.getItem("studentId"));
  const [studentList, setStudentList] = useState([]);
  const [loading, setLoading] = useState(false);
  // Removed unused showAll state and its setter _setShowAll
  const [searchTerm, setSearchTerm] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cancelingRequestId, setCancelingRequestId] = useState(null);

  const parentId = localStorage.getItem("userId"); // bị lỗi chỗ này nè trc đó ai để là parent id nhưng bên đăng nhập lưu lại là userId
  const historyEndRef = useRef(null);
  const historyTopRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasShownNoStudentToastRef = useRef(false); // Sử dụng ref thay vì state để tránh re-render

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);

    const previews = selectedFiles.map(file =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    );
    setPreviewUrls(previews);

    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSend = async () => {
    const trimmedTitle = title.trim();
    const trimmedUsage = usage.trim();
    const trimmedNote = note.trim();

    if (!parentId || parentId === 'null') {
      return toast.error("找不到家長登入資料，請重新登入。", { 
        position: "top-center", 
        autoClose: 2500, 
        theme: "colored" 
      });
    }

    if (!studentId) {
      return toast.error("請選擇學生。", { position: "top-center", autoClose: 2500, theme: "colored" });
    }

    if (!trimmedTitle) {
      return toast.error("請輸入藥物名稱。", { position: "top-center", autoClose: 2500, theme: "colored" });
    }

    if (trimmedTitle.length < 3) {
      return toast.error("藥物名稱至少需要 3 個字元。", { position: "top-center", autoClose: 2500, theme: "colored" });
    }

    const titleRegex = /^[\p{L}0-9\s\-+®.™]+$/u;
    if (!titleRegex.test(trimmedTitle)) {
      return toast.error("藥物名稱包含不支援的字元。", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    }

    if (!trimmedUsage) {
      return toast.error("請輸入劑量。", { position: "top-center", autoClose: 2500, theme: "colored" });
    }

    if (trimmedUsage.length < 3) {
      return toast.error("劑量說明至少需要 3 個字元。", { position: "top-center", autoClose: 2500, theme: "colored" });
    }

    const dosageRegex = /^[\p{L}0-9\s/\-×]+$/u;
    if (!dosageRegex.test(trimmedUsage)) {
      return toast.error("劑量說明包含不支援的字元。", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    }

    const noteRegex = /^[\p{L}0-9\s.,;:()\-\u2013\u2014]+$/u;
    if (trimmedNote && !noteRegex.test(trimmedNote)) {
      return toast.error("備註包含不支援的字元。", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
    }

    // Kiểm tra file
    for (let file of files) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
      ];
      const maxSizeMB = 10;
      if (!allowedTypes.includes(file.type)) {
        return toast.error("檔案格式不支援；請上傳 PDF、DOC、DOCX、PNG 或 JPG。", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return toast.error("檔案不可超過 10MB。", {
          position: "top-center",
          autoClose: 3000,
          theme: "colored",
        });
      }
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("studentId", studentId);
      formData.append("medicationName", trimmedTitle);
      formData.append("dosage", trimmedUsage);
      formData.append("instructions", trimmedNote);
      files.forEach((file) => {
        formData.append("imageFile", file);
      });

      await axios.post(
        `http://127.0.0.1:5080/api/MedicationRequest/create?parentId=${parentId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      toast.success("用藥申請已送出。", {
        position: "top-center",
        autoClose: 2500,
        theme: "colored",
      });

      setTitle("");
      setUsage("");
      setNote("");
      setFiles([]);
      setPreviewUrls([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
      fetchHistory();
    } catch (err) {
      console.error(err);
      toast.error("送出用藥申請失敗。", {
        position: "top-center",
        autoClose: 2500,
        theme: "colored",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!requestId) return;

    try {
      setLoading(true);
      await axios.put(
        `http://127.0.0.1:5080/api/MedicationRequest/${requestId}/status`,
        { statusId: 6 } // 6 là trạng thái "Đã hủy"
      );
      toast.success("用藥申請已取消。", {
        position: "top-center",
        autoClose: 2500,
        theme: "colored",
      });
      // Cập nhật trạng thái trong state để UI thay đổi ngay lập tức, không fetch lại từ server
      setHistory(prevHistory =>
        prevHistory.map(item =>
          item.requestID === requestId
            ? { ...item, status: "已取消" }
            : item
        )
      );
    } catch (err) {
      console.error("Lỗi khi hủy đơn thuốc:", err);
      toast.error("取消用藥申請失敗，請稍後再試。", {
        position: "top-center",
        autoClose: 2500,
        theme: "colored",
      });
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
      setCancelingRequestId(null);
    }
  };


  const openConfirmModal = (requestId) => {
    setCancelingRequestId(requestId);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setCancelingRequestId(null);
    setShowConfirmModal(false);
  };

  const fetchStudentList = useCallback(async () => {
    if (!parentId || parentId === 'null') {
      console.error("ParentId không hợp lệ:", parentId);
      setStudentList([]);
      setStudentId(null);
      localStorage.removeItem("studentId");
      return;
    }

    try {
      const res = await axios.get(
        `http://127.0.0.1:5080/api/Student/by-parent/${parentId}`
      );
      const data = res.data.data;
      setStudentList(data);
      
      if (data.length === 0) {
        setStudentId(null);
        localStorage.removeItem("studentId");
      } else {
        // Chỉ set studentId mặc định nếu chưa có
        const currentStudentId = localStorage.getItem("studentId");
        if (!currentStudentId || !data.some(s => s.studentId === currentStudentId)) {
          setStudentId(data[0].studentId);
          localStorage.setItem("studentId", data[0].studentId);
        }
      }
      
      // Reset toast flag nếu fetch thành công
      hasShownNoStudentToastRef.current = false;
    } catch (err) {
      // Xử lý error 404 (chưa liên kết học sinh) - chỉ hiển thị toast 1 lần
      if (err.response?.status === 404) {
        setStudentList([]);
        setStudentId(null);
        localStorage.removeItem("studentId");
        
        // Chỉ hiển thị toast lỗi 1 lần duy nhất
        if (!hasShownNoStudentToastRef.current) {
          toast.warn("此帳號尚未連結學生，請聯絡學校。", {
            position: "top-center",
            autoClose: 3000,
            theme: "colored"
          });
          hasShownNoStudentToastRef.current = true;
        }
        return;
      }
      
      // Các lỗi khác vẫn log như bình thường
      console.error("無法取得學生名單：", err);
      setStudentList([]);
    }
  }, [parentId]); // Chỉ depend vào parentId

  const fetchHistory = useCallback(async () => {
    if (!studentId || studentId === 'null') {
      console.error("StudentId không hợp lệ để lấy lịch sử:", studentId);
      setHistory([]);
      return;
    }

    try {
      // Fetch student name inline thay vì gọi fetchStudentName để tránh dependency
      const studentRes = await axios.get(
        `http://127.0.0.1:5080/api/Student/${studentId}`
      );
      const studentName = studentRes.data.data.fullName;
      setStudentName(studentName);
      
      if (!studentName) {
        setHistory([]);
        return;
      }
      
      const res = await axios.get(
        "http://127.0.0.1:5080/api/MedicationRequest/all"
      );
      // Sửa ở đây: lấy đúng mảng data
      const all = Array.isArray(res.data) ? res.data : res.data.data || [];
      const filtered = all.filter(
        (item) =>
          item.studentName?.toLowerCase().trim() === studentName?.toLowerCase().trim()
      );
      const sorted = filtered.sort(
        (a, b) => new Date(b.requestDate) - new Date(a.requestDate)
      );
      setHistory(sorted);
    } catch (err) {
      console.error("Lỗi khi lấy lịch sử thuốc:", err);
      setHistory([]);
      setStudentName("");
    }
  }, [studentId]); // Chỉ depend vào studentId

  // Chỉ fetch student list một lần khi component mount
  useEffect(() => {
    fetchStudentList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch history khi studentId thay đổi
  useEffect(() => {
    if (studentId) {
      fetchHistory();
    } else {
      setHistory([]);
      setStudentName("");
    }
  }, [studentId, fetchHistory]);

  // Reset toast flag khi component mount để có thể hiện toast lại nếu cần
  useEffect(() => {
    hasShownNoStudentToastRef.current = false;
  }, []);

  const getStatusInfo = (status) => {
    switch (status) {
      case "已核准":
        return { text: "已核准", className: styles.statusApproved };
      case "待審核":
        return { text: "待審核", className: styles.statusPending };
      case "已取消":
        return { text: "已取消", className: styles.statusCancelled };
      case "已拒絕":
        return { text: "已拒絕", className: styles.statusRejected };
      case "已完成":
        return { text: "已排程", className: styles.statusCompleted };
      default:
        return { text: status, className: styles.statusNormal };
    }
  };

  const filteredHistory = history.filter((item) =>
    `${item.medicationName} ${item.instructions}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const hasStudent = studentList && studentList.length > 0;

  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>
        <h2 className={styles.title}>Prescription |</h2>
        <div className={styles.marquee}>
          <span className={styles.marqueeText}>
            目前登入的家長帳號：{" "}
            {hasStudent ? (studentName || "...") : "..."}
          </span>
        </div>

        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <label style={{ fontWeight: 600, fontSize: "16px", color: "#1e3a8a" }}>選擇學生：</label>
          <select
            value={studentId || ""}
            onChange={(e) => {
              setStudentId(e.target.value);
              localStorage.setItem("studentId", e.target.value);
            }}
            className={styles.selectStudent}
            disabled={!hasStudent}
          >
            {hasStudent ? (
              studentList.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.fullName} - {student.className}
                </option>
              ))
            ) : (
              <option value="">尚未連結學生</option>
            )}
          </select>
        </div>

        {!hasStudent ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '60vh',
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            {/* Icon */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e0f7fa 0%, #f0f4ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              boxShadow: '0 8px 32px rgba(32, 178, 170, 0.15)'
            }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#20b2aa" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>

            {/* Heading */}
            <h2 style={{ 
              color: '#0284c7', 
              fontSize: '28px', 
              fontWeight: '700', 
              marginBottom: '16px',
              lineHeight: '1.3'
            }}>
              尚未連結學生
            </h2>

            {/* Description */}
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px', 
              lineHeight: '1.6',
              maxWidth: '500px',
              marginBottom: '32px'
            }}>
              此帳號尚未連結學生，請聯絡學校協助。
            </p>

            {/* Steps */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ 
                color: '#334155', 
                fontSize: '18px', 
                fontWeight: '600', 
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                如需使用用藥申請：
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#20b2aa',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    flexShrink: 0
                  }}>1</div>
                  <span style={{ color: '#475569', fontSize: '15px' }}>
                    聯絡學校健康中心
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#20b2aa',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    flexShrink: 0
                  }}>2</div>
                  <span style={{ color: '#475569', fontSize: '15px' }}>
                    提供學生與聯絡人資料
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#20b2aa',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    flexShrink: 0
                  }}>3</div>
                  <span style={{ color: '#475569', fontSize: '15px' }}>
                    由學校確認並完成連結
                  </span>
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div style={{
              marginTop: '24px',
              padding: '16px 24px',
              background: 'linear-gradient(135deg, #e0f7fa 0%, #f0f4ff 100%)',
              borderRadius: '12px',
              border: '1px solid #20b2aa'
            }}>
              <p style={{ 
                color: '#0284c7', 
                fontSize: '14px', 
                fontWeight: '500',
                margin: 0
              }}>
                完成連結後即可建立學生用藥申請。
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.mainSection}>
              <div className={styles.medicineInfo}>
                <div className={styles.medicineSectionTitle}>用藥資料</div>
                <div className={`${styles.box} ${styles.boxYellow}`}>
                  <h3><FiInfo style={{ marginRight: 8, color: "#f59e42" }} /> 藥物／疾病資訊</h3>
                  <textarea
                    placeholder="輸入藥物名稱或相關疾病資訊..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={styles.inputField}
                  ></textarea>
                </div>
                <div className={`${styles.box} ${styles.boxBlue}`}>
                  <h3><FiEdit style={{ marginRight: 8, color: "#3b82f6" }} /> 劑量</h3>
                  <input
                    type="text"
                    placeholder="例如：每日 3 次"
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    className={styles.inputField}
                  />
                </div>
                <div className={`${styles.box} ${styles.boxGreen}`}>
                  <h3><FiClipboard style={{ marginRight: 8, color: "#10b981" }} /> 用藥方式／備註</h3>
                  <textarea
                    placeholder="例如：餐後 30 分鐘服用"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={styles.inputField}
                  ></textarea>
                </div>

                <div className={styles.uploadSection}>
                  <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
                    {!files.length > 0 && (
                      <>
                        <p className={styles.uploadText}>上傳藥袋、處方或相關文件</p>
                        <p>PDF, DOC, JPG, PNG - 上限 10MB</p>
                      </>
                    )}
                    <input
                      id="file-upload"
                      type="file"
                      style={{ display: "none" }}
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      multiple
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
                  </label>

                  {files.length > 0 && (
                    <div className={styles.fileInfo}>
                      {files.map((file, idx) => (
                        <div key={idx} style={{ marginBottom: 10 }}>
                          <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          <button
                            onClick={() => {
                              const newFiles = files.filter((_, i) => i !== idx);
                              setFiles(newFiles);
                              setPreviewUrls(previewUrls.filter((_, i) => i !== idx));
                            }}
                            className={styles.removeFileBtn}
                            style={{ marginLeft: 8 }}
                          >
                            ❌
                          </button>
                          {previewUrls[idx] && (
                            <div style={{ marginTop: 6 }}>
                              <img
                                src={previewUrls[idx]}
                                alt="preview"
                                style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, border: "1px solid #e5e7eb" }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button className={styles.sendBtn} onClick={handleSend} disabled={loading}>
                  {loading ? "送出中..." : "送出"}
                </button>
              </div>

              <div className={styles.historySection}>
                <div className={styles.historyHeader}>
                  <span>用藥申請紀錄 {history.length > 0 && `(${history.length})`}</span>
                  <button
                    className={styles.reviewBtn}
                    onClick={() => setShowPopup(true)}
                  >
                    查看更多
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="🔍 依藥物名稱或備註搜尋..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchBox}
                />
                {filteredHistory.slice(0, 3).map((item, index) => {
                  const statusInfo = getStatusInfo(item.status);
                  return (
                    <div key={item.requestID} className={`${styles.historyItem} ${styles.fadeIn}`} ref={index === 0 ? historyTopRef : null}>
                      <div className={styles.medicationIconWrapper}>
                        <div className={styles.medicationIcon}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12,2a10,10,0,0,0-10,10,10,10,0,0,0,10,10h0a10,10,0,0,0,10-10,10,10,0,0,0-10-10Z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </div>
                      </div>
                      <div className={styles.medicationDetails}>
                        <strong>{item.medicationName}</strong>
                        <p>劑量: {item.dosage}</p>
                        <p>備註： {item.instructions || '無'}</p>
                        <p>申請日期： {new Date(item.requestDate).toLocaleDateString("zh-TW")}</p>
                        {item.imagePath && (
                          <p>
                            <ProtectedAttachmentLink path={item.imagePath}>查看附件</ProtectedAttachmentLink>
                          </p>
                        )}
                      </div>
                      <div className={styles.statusRow}>
                        <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                          {statusInfo.text}
                        </span>
                        {(item.status === "待審核" || item.status === "已核准") && (
                          <button
                            onClick={() => openConfirmModal(item.requestID)}
                            className={styles.cancelBtn}
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={historyEndRef} />
              </div>
            </div>

            {showPopup && (
              <div className={styles.popupOverlay}>
                <div className={styles.popupContent}>
                  <div className={styles.popupHeader}>
                    <span>用藥申請紀錄 ({filteredHistory.length})</span>
                    <button className={styles.closeBtn} onClick={() => setShowPopup(false)}>✖</button>
                  </div>
                  <input
                    type="text"
                    placeholder="🔍 依藥物名稱或備註搜尋..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchBox}
                    style={{ marginBottom: 18 }}
                  />
                  <div className={styles.popupBody}>
                    {filteredHistory.map((item) => {
                      const statusInfo = getStatusInfo(item.status);
                      return (
                        <div key={item.requestID} className={styles.historyItem}>
                           <div className={styles.medicationIconWrapper}>
                            <div className={styles.medicationIcon}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12,2a10,10,0,0,0-10,10,10,10,0,0,0,10,10h0a10,10,0,0,0,10-10,10,10,0,0,0-10-10Z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            </div>
                          </div>
                          <div className={styles.medicationDetails}>
                            <strong>{item.medicationName}</strong>
                            <p>劑量: {item.dosage}</p>
                            <p>備註： {item.instructions || '無'}</p>
                             <p>申請日期： {new Date(item.requestDate).toLocaleDateString("zh-TW")}</p>
                            {item.imagePath && (
                              <p>
                                <ProtectedAttachmentLink path={item.imagePath}>查看附件</ProtectedAttachmentLink>
                              </p>
                            )}
                          </div>
                          <div className={styles.statusRow}>
                            <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                              {statusInfo.text}
                            </span>
                            {(item.status === "待審核" || item.status === "已核准") && (
                              <button
                                onClick={() => openConfirmModal(item.requestID)}
                                className={styles.cancelBtn}
                              >
                                取消
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={showConfirmModal} onClose={closeConfirmModal} title="確認取消">
        <p>確定要取消這筆用藥申請嗎？</p>
        <div className={styles.confirmActions}>
          <button onClick={closeConfirmModal} className={`${styles.btn} ${styles.btnSecondary}`}>否</button>
          <button onClick={() => handleCancel(cancelingRequestId)} className={`${styles.btn} ${styles.btnDanger}`}>是，取消</button>
        </div>
      </Modal>
    </div>
  );
};

export default SendMedicine;