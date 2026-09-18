import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import style from "../../assets/css/studentDetail.module.css";
import axios from "axios";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";

const API_BASE = "http://127.0.0.1:5080/api";

// --- Child Component for Basic Info ---
const StudentInfoSection = ({ student, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (student) {
            setFormData({
                full男e: student.full男e || "",
                dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "",
                class: student.class || "",
                gender男e: student.gender男e || "",
            });
        }
    }, [student]);

    if (!student) return null;

    const handleFormChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCancel = () => {
        setIsEditing(false);
        // Reset form data on cancel
        setFormData({
            full男e: student.full男e || "",
            dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "",
            class: student.class || "",
            gender男e: student.gender男e || "",
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        let genderId = null;
        if (formData.gender男e === '男') genderId = 1;
        else if (formData.gender男e === '女') genderId = 2;

        const payload = {
            full男e: formData.full男e,
            dateOfBirth: formData.dateOfBirth,
            className: formData.class,
            genderId: genderId,
            parentId: student.parentId,
        };

        try {
            await onSave(payload);
            setIsEditing(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={style.section}>
            <div className={style.sectionHeader}>
                <h4 className={style.sectionTitle}>基本資料</h4>
            </div>
            <form onSubmit={handleSave}>
                <div className={style.infoGrid}>
                    {/* Form Fields */}
                    <div>
                        <span className={style.label}>姓名：</span>
                        {isEditing ? <input type="text" name="full男e" value={formData.full男e} onChange={handleFormChange} className={style.inputField} /> : ` ${student.full男e}`}
                    </div>
                    <div>
                        <span className={style.label}>家長／聯絡人：</span> {student.parent男e}
                    </div>
                    <div>
                        <span className={style.label}>性別：</span>
                        {isEditing ? (
                            <select name="gender男e" value={formData.gender男e} onChange={handleFormChange} className={style.inputField}>
                                <option value="男">男</option>
                                <option value="女">女</option>
                            </select>
                        ) : ` ${student.gender男e}`}
                    </div>
                    <div>
                        <span className={style.label}>出生日期：</span>
                        {isEditing ? <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleFormChange} className={style.inputField} /> : ` ${new Date(student.dateOfBirth).toLocaleDateString('vi-VN')}`}
                    </div>
                    <div>
                        <span className={style.label}>班級：</span>
                        {isEditing ? <input type="text" name="class" value={formData.class} onChange={handleFormChange} className={style.inputField} /> : ` ${student.class}`}
                    </div>
                </div>
                {isEditing && (
                    <div className={style.actionRow}>
                        <button type="submit" className={style.saveBtn} disabled={submitting}>儲存</button>
                        <button type="button" className={style.cancelBtn} onClick={handleCancel}>取消</button>
                    </div>
                )}
            </form>
             {!isEditing && (
                <div className={style.actionRow}>
                    <button type="button" className={style.editBtn} onClick={() => setIsEditing(true)}>編輯</button>
                </div>
            )}
        </div>
    );
};

// --- Child Component for Health Profile ---
const HealthProfileSection = ({ healthProfile, studentId, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setFormData({
            height: healthProfile?.height || "",
            weight: healthProfile?.weight || "",
            chronicDiseases: healthProfile?.chronicDiseases || "",
            allergies: healthProfile?.allergies || "",
            generalNote: healthProfile?.generalNote || "",
        });
    }, [healthProfile]);

    const handleFormChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
             height: healthProfile?.height || "",
            weight: healthProfile?.weight || "",
            chronicDiseases: healthProfile?.chronicDiseases || "",
            allergies: healthProfile?.allergies || "",
            generalNote: healthProfile?.generalNote || "",
        });
    };
    
    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            studentId: studentId,
            height: formData.height ? Number(formData.height) : null,
            weight: formData.weight ? Number(formData.weight) : null,
            chronicDiseases: formData.chronicDiseases,
            allergies: formData.allergies,
            generalNote: formData.generalNote,
            isActive: true,
        };
        try {
            await onSave(payload);
            setIsEditing(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={style.section}>
            <div className={style.sectionHeader}>
                <h4 className={style.sectionTitle}>健康資料</h4>
            </div>
            {healthProfile ? (
                <form onSubmit={handleSave}>
                    <div className={style.infoGrid}>
                        {/* Form Fields */}
                        <div>
                            <span className={style.label}>身高：</span>
                            {isEditing ? <><input type="number" name="height" value={formData.height} onChange={handleFormChange} className={style.inputField} /> cm</> : ` ${healthProfile.height || '—'} cm`}
                        </div>
                        <div>
                            <span className={style.label}>體重：</span>
                            {isEditing ? <><input type="number" name="weight" value={formData.weight} onChange={handleFormChange} className={style.inputField} /> kg</> : ` ${healthProfile.weight || '—'} kg`}
                        </div>
                        <div className={style.fullWidth}>
                            <span className={style.label}>慢性疾病：</span>
                            {isEditing ? <input type="text" name="chronicDiseases" value={formData.chronicDiseases} onChange={handleFormChange} className={style.inputFieldFull} /> : ` ${healthProfile.chronicDiseases || '無'}`}
                        </div>
                        <div className={style.fullWidth}>
                            <span className={style.label}>過敏：</span>
                            {isEditing ? <input type="text" name="allergies" value={formData.allergies} onChange={handleFormChange} className={style.inputFieldFull} /> : ` ${healthProfile.allergies || '無'}`}
                        </div>
                        <div className={style.fullWidth}>
                            <span className={style.label}>健康備註：</span>
                            {isEditing ? <textarea name="generalNote" value={formData.generalNote} onChange={handleFormChange} className={style.textareaField} /> : ` ${healthProfile.generalNote || '無'}`}
                        </div>
                    </div>
                    {isEditing && (
                        <div className={style.actionRow}>
                            <button type="submit" className={style.saveBtn} disabled={submitting}>儲存變更</button>
                            <button type="button" className={style.cancelBtn} onClick={handleCancel}>取消</button>
                        </div>
                    )}
                </form>
            ) : (
                <p className={style.notice}>尚未建立健康資料，可由健康中心補登。</p>
            )}
             {!isEditing && healthProfile && (
                <div className={style.actionRow}>
                    <button type="button" className={style.editBtn} onClick={() => setIsEditing(true)}>編輯</button>
                </div>
            )}
        </div>
    );
};


// --- Main Parent Component ---
const StudentDetail = () => {
  // Tất cả hook phải ở đầu function component
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [healthProfile, setHealthProfile] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); // luôn set loading true khi fetch
    try {
      const token = localStorage.getItem("token"); // đồng bộ key token
      const headers = { Authorization: `Bearer ${token}` };
      const studentPromise = axios.get(`${API_BASE}/Student/${id}`, { headers });
      const healthProfilePromise = axios.get(`${API_BASE}/health-profiles/student/${id}`, { headers });
      const medicalHistoryPromise = axios.get(`${API_BASE}/MedicalHistory/student/${id}`, { headers });
      const [studentRes, healthProfileRes, medicalHistoryRes] = await Promise.allSettled([
        studentPromise,
        healthProfilePromise,
        medicalHistoryPromise,
      ]);
      if (studentRes.status === "fulfilled") {
        setStudent(studentRes.value.data.data);
      } else {
        console.error("Lỗi tải thông tin詳細資料:", studentRes.reason);
        notifyError("無法載入學生資料。");
        navigate("/students");
        return;
      }
      if (healthProfileRes.status === "fulfilled" && healthProfileRes.value.data.data) {
        setHealthProfile(healthProfileRes.value.data.data);
      } else {
        setHealthProfile(null);
      }
      if (medicalHistoryRes.status === "fulfilled" && medicalHistoryRes.value.data.data) {
        setMedicalHistory(Array.isArray(medicalHistoryRes.value.data.data) ? medicalHistoryRes.value.data.data : []);
      } else {
        setMedicalHistory([]);
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
      notifyError("載入學生詳細資料時發生錯誤。");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveBasic = async (payload) => {
    setSubmitting(true);
    try {
        await axios.put(`${API_BASE}/Student/${student.studentId}`, payload);
        notifySuccess("學生基本資料更新成功。");
        await fetchData(); // Refetch all data
    } catch (error) {
        console.error("Lỗi cập nhật thông tin詳細資料:", error);
        notifyError("更新學生資料失敗：" + (error.response?.data?.message || ""));
        throw error; // Propagate error to child to stop submitting state
    } finally {
        setSubmitting(false);
    }
  };

  const handleSaveHealth = async (payload) => {
    setSubmitting(true);
    try {
        await axios.put(`${API_BASE}/health-profiles/student/${student.studentId}`, payload);
        notifySuccess("健康資料更新成功。");
        await fetchData(); // Refetch all data
    } catch (error) {
        console.error("Lỗi cập nhật hồ sơ sức khỏe:", error);
        notifyError("更新健康資料失敗：" + (error.response?.data?.message || ""));
        throw error; // Propagate error to child
    } finally {
        setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingOverlay text="學生資料載入中..." />;
  }

  if (!student) {
    return (
      <div className={style.layoutContainer}>
        <Sidebar />
        <main className={style.mainContent}>
          <p>找不到學生資料。</p>
          <button className={style.backBtn} onClick={() => navigate("/students")}>
            ← 返回學生名單
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={style.layoutContainer}>
      <Sidebar />
      <main className={style.mainContent}>
        {(submitting) && <LoadingOverlay text="更新中..." />}
        <Notification />

        <header className={style.dashboardHeaderBar}>
          <div className={style.titleGroup}>
            <h1>
              <span className={style.textBlack}>學生</span>
              <span className={style.textAccent}>詳細資料</span>
            </h1>
          </div>
        </header>

        <div className={style.cardBox}>
            <div className={style.studentHeader}>
                <div>
                    <h2 className={style.name}>{student.full男e}</h2>
                    <p className={style.subInfo}>
                      班級： {student.class || '—'} | 家長／聯絡人： {student.parent男e || '—'}
                    </p>
                </div>
            </div>

            <StudentInfoSection student={student} onSave={handleSaveBasic} />
            
            <HealthProfileSection 
              healthProfile={healthProfile}
              studentId={student.studentId}
              onSave={handleSaveHealth}
            />
            
            <div className={style.section}>
                <h4 className={style.sectionTitle}>既往病史</h4>
                {medicalHistory.length > 0 ? (
                    <table className={style.historyTable}>
                        <thead>
                            <tr>
                                <th>疾病名稱</th>
                                <th>備註</th>
                                <th>診斷日期</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medicalHistory.map((mh, idx) => (
                                <tr key={mh.historyId || idx}>
                                    <td>{mh.disease男e || '無'}</td>
                                    <td>{mh.note || '無'}</td>
                                    <td>{mh.diagnosedDate ? new Date(mh.diagnosedDate).toLocaleDateString('vi-VN') : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className={style.notice}>目前沒有既往病史紀錄。</p>
                )}
            </div>

        </div>

        <div className={style.backContainer}>
          <button className={style.backBtn} onClick={() => navigate("/students")}>
            ← 返回學生名單
          </button>
        </div>
      </main>
    </div>
  );
};

export default StudentDetail;
