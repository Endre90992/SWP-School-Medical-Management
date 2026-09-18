import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import style from "../../assets/css/incidentPage.module.css";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Search, Plus, Users } from "lucide-react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);
import Select from "react-select";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import { toast } from "react-toastify";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useNavigate } from "react-router-dom";

// API URL constants
const MEDICAL_EVENT_API = "http://127.0.0.1:5080/api/MedicalEvent";
const MEDICAL_EVENT_TYPE_API = "http://127.0.0.1:5080/api/MedicalEventType";
const STUDENT_API = "http://127.0.0.1:5080/api/Student";
const USER_API = "http://127.0.0.1:5080/api/User";
const MEDICAL_SUPPLIES_API = "http://127.0.0.1:5080/api/MedicalSupplies";
const NOTIFICATION_API = "http://127.0.0.1:5080/api/Notification/send";

const COLORS = ["#F4C430", "#FF6B6B", "#4D96FF", "#9AE6B4", "#FFA500"];

const Incident = () => {
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState([]);
  const [eventTypeFilter, setEventTypeFilter] = useState("全部");
  const [dateFilter, setDateFilter] = useState("");
  const [groupBy, setGroupBy] = useState("day");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const itemsPerPage = 5;
  const [selectedMedicalHistory, setSelectedMedicalHistory] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBulkCreateForm, setShowBulkCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [students, setStudents] = useState([]);
  const [classList, setClassList] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [classStudents, setClassStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [searchStudent, setSearchStudent] = useState("");
  const [newEvent, setNewEvent] = useState({
    studentId: "",
    eventTypeId: "",
    severityId: "",
    eventDate: new Date().toISOString().slice(0, 16),
    description: "",
    handledByUserId: "",
    location: "",
    notes: "",
  });
  const [bulkEvent, setBulkEvent] = useState({
    selectedStudents: [],
    eventTypeId: "",
    severityId: "",
    eventDate: new Date().toISOString().slice(0, 16),
    description: "",
    location: "",
    notes: "",
  });
  const [supplies, setSupplies] = useState([]);
  const [suppliesUsed, setSuppliesUsed] = useState([]);
  const [bulkSuppliesUsed, setBulkSuppliesUsed] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true); // loading fetch list
  const [modalLoading, setModalLoading] = useState(false);
  const [showSendOption, setShowSendOption] = useState(false);
  const [eventTypes, setEventTypes] = useState([]);
  const [showCreateEventTypeModal, setShowCreateEventTypeModal] = useState(false);
  const [newEventTypeName, setNewEventTypeName] = useState("");
  const navigate = useNavigate();

  const severityLevels = [
    { id: "1", level: "輕度" },
    { id: "2", level: "中度" },
    { id: "3", level: "重度" },
  ];

  // Thêm hàm kiểm tra token
  const getTokenOrRedirect = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      notifyError("登入已逾時，請重新登入。");
      setTimeout(() => navigate("/login"), 1500);
      return null;
    }
    return token;
  };

  const fetchEventTypes = () => {
    const token = getTokenOrRedirect();
    if (!token) return;
    axios
      .get(MEDICAL_EVENT_TYPE_API, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const data = res.data;
        const types = Array.isArray(data)
          ? data
          : data && Array.isArray(data.data)
          ? data.data
          : [];

        if (Array.isArray(types)) {
          const mappedTypes = types.map((t) => ({
            id: t.eventTypeId || t.id,
            name: t.eventTypeName || t.name,
            ...t,
          }));
          setEventTypes(mappedTypes);
        }
      })
      .catch((err) => {
        console.error("❌ Lỗi lấy loại 筆傷病:", err);
        setEventTypes([]); // Ensure it's an empty array on error
        notifyError("無法載入傷病類型，請稍後再試。");
      });
  };

  const fetchEvents = () => {
    setLoading(true);
    const token = getTokenOrRedirect();
    if (!token) return;
    axios
      .get(MEDICAL_EVENT_API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        // Đúng với API trả về: { status, message, data: [...] }
        const eventList = Array.isArray(res.data?.data) ? res.data.data : [];
        setEvents(eventList.sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate)));
      })
      .catch((err) => {
        console.error("❌ Lỗi lấy danh sách 筆傷病:", err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  const getStaffName = (id, handledByName) => {
    if (handledByName && handledByName !== "") return handledByName;
    const user = users.find((u) => u.userId === id || u.userID === id);
    if (user) return user.fullName;
    if (id === localStorage.getItem("userId")) return "目前使用者";
    return "未填寫";
  };

  // Hàm gửi notification/email cho phụ huynh: luôn lấy parentId từ API nếu chưa có
  const sendNotificationToParent = async (studentId, event) => {
    const token = getTokenOrRedirect();
    if (!token) return false;
    try {
      // Lấy parentId từ event hoặc từ API nếu chưa có
      let parentId = event.parentId;
      let studentName = event.studentName;
      console.log('[DEBUG] 建立本機通知 cho studentId:', studentId, 'event:', event);
      if (!parentId) {
        const res = await axios.get(
          `${STUDENT_API}/${studentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('[DEBUG] Kết quả API lấy student:', res.data);
        parentId = res.data?.data?.parentId;
        studentName = res.data?.data?.fullName;
      }
      console.log('[DEBUG] parentId:', parentId, 'studentName:', studentName);
      if (!parentId) {
        notifyError("找不到此學生的家長／聯絡人。");
        return false;
      }
      // Trong sendNotificationToParent, tạo message với fallback tránh undefined/null/Invalid Date
      const message = `學生: ${studentName}\n傷病類型: ${event.eventType || "未填寫"}\n時間: ${event.eventDate ? new Date(event.eventDate).toLocaleString("zh-TW") : "未填寫"}\n嚴重程度: ${event.severityLevelName || "未填寫"}\n傷病描述: ${event.description || "無"}`;
      const subject = "校園傷病紀錄通知";
      await Promise.all([
        axios.post(
          NOTIFICATION_API,
          {
            receiverId: parentId,
            title: subject,
            message,
            typeId: 2,
            isRead: false,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.post(
          "http://127.0.0.1:5080/api/Email/send-by-userid",
          {
            userId: parentId,
            subject,
            body: message,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);
      setEvents((prev) =>
        prev.map((e) =>
          e.eventId === event.eventId ? { ...e, notificationSent: true } : e
        )
      );
      console.log('[DEBUG] 已建立本機家長通知：', parentId);
      return true;
    } catch (err) {
      notifyError("建立本機通知 hoặc email thất bại!");
      console.error("❌ 建立通知失敗：", err);
      if (err.response) {
        console.error('[DEBUG] Lỗi response:', err.response.data);
      }
      return false;
    }
  };

  const handleCreateEventType = () => {
    if (!newEventTypeName.trim()) {
      notifyError("傷病類型名稱不得空白。");
      return;
    }
    setModalLoading(true);
    const token = getTokenOrRedirect();
    if (!token) return;
    axios
      .post(
        MEDICAL_EVENT_TYPE_API,
        { eventTypeName: newEventTypeName },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      .then((res) => {
        notifySuccess("新增傷病類型成功！");
        setShowCreateEventTypeModal(false);
        setNewEventTypeName("");

        const newType = res.data?.data || res.data;
        // Fetch again to get the full updated list
        fetchEventTypes();

        if (newType && (newType.eventTypeId || newType.id)) {
          const newId = (newType.eventTypeId || newType.id).toString();
          if (showCreateForm) {
            setNewEvent((prev) => ({ ...prev, eventTypeId: newId }));
          }
          if (showBulkCreateForm) {
            setBulkEvent((prev) => ({ ...prev, eventTypeId: newId }));
          }
        }
      })
      .catch((err) => {
        console.error("❌ Lỗi tạo loại 筆傷病:", err);
        notifyError(
          "Lỗi khi tạo loại 筆傷病 mới: " +
            (err.response?.data?.message || err.message)
        );
      })
      .finally(() => {
        setModalLoading(false);
      });
  };

  useEffect(() => {
    const token = getTokenOrRedirect();
    if (!token) return;
    console.log("🔑 Token: [Sanitized] " + (token ? token.substring(0, 4) + "..." : "No token found"));
    console.log("👤 UserId:", localStorage.getItem("userId"));

    fetchEvents();
    fetchEventTypes();

    axios
      .get(STUDENT_API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        console.log("📥 Danh sách học sinh:", res.data);
        const studentData = Array.isArray(res.data.data) ? res.data.data : [];
        setStudents(studentData);
        setAllStudents(studentData);
        
        // 新增 danh sách lớp từ dữ liệu học sinh
        if (studentData.length > 0) {
          const uniqueClasses = Array.from(
            new Set(studentData.map((s) => s.className).filter(Boolean))
          );
          setClassList(uniqueClasses);
        }
      })
      .catch((err) => {
        console.error("❌ Lỗi lấy danh sách học sinh:", err);
        setStudents([]);
        setAllStudents([]);
      });

    axios
      .get(USER_API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setUsers(res.data);
      })
      .catch((err) => {
        console.error("❌ Lỗi lấy danh sách user:", err);
      });

    axios
      .get(MEDICAL_SUPPLIES_API, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setSupplies(Array.isArray(res.data.data) ? res.data.data : []);
      })
      .catch((err) => {
        console.error("❌ 取得醫療物資失敗：", err);
        setSupplies([]);
      });
  }, []);

  useEffect(() => {
    if (selectedEvent?.studentId) {
      const token = getTokenOrRedirect();
      if (!token) return;
      axios
        .get(`${STUDENT_API}/${selectedEvent.studentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((res) => {
          setSelectedMedicalHistory(res.data);
        })
        .catch((err) => {
          console.error("❌ Lỗi lấy tiền sử bệnh:", err);
          setSelectedMedicalHistory([]);
        });
    } else {
      setSelectedMedicalHistory([]);
    }
  }, [selectedEvent]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchType =
        eventTypeFilter === "全部" || event.eventType === eventTypeFilter;
      const matchSearch = event.studentName
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchDate =
        !dateFilter ||
        new Date(event.eventDate).toISOString().split("T")[0] === dateFilter;
      return matchType && matchSearch && matchDate;
    });
  }, [events, eventTypeFilter, search, dateFilter]);

  const { summary, distributionData } = useMemo(() => {
    const dateMap = {};
    let sent = 0;
    let draft = 0;
    let pending = 0;

    filteredEvents.forEach((event) => {
      const status = event.status?.toLowerCase() || "";
      if (status.includes("gửi")) sent++;
      else if (status.includes("nháp")) draft++;
      else pending++;

      const d = dayjs(event.eventDate);
      const groupKey =
        groupBy === "day"
          ? d.format("YYYY-MM-DD")
          : groupBy === "week"
          ? `${d.year()}-W${d.isoWeek()}`
          : d.format("YYYY-MM");
      dateMap[groupKey] = (dateMap[groupKey] || 0) + 1;
    });

    return {
      summary: { total: filteredEvents.length, sent, draft, pending },
      distributionData: Object.entries(dateMap)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [filteredEvents, groupBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, eventTypeFilter, dateFilter, groupBy]);

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredEvents.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);

  const handleExportExcel = async () => {
    if (filteredEvents.length === 0) return;

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      filteredEvents.map((e) => ({
        "學生": e.studentName,
        "傷病類型": e.eventType,
        "時間": new Date(e.eventDate).toLocaleString("zh-TW"),
        "嚴重程度": e.severityLevelName,
        "處理人員": e.handledByName || "",
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "傷病紀錄");
    XLSX.writeFile(wb, "學生傷病紀錄.xlsx");
  };

  const handleCreate = () => {
    const currentUserId = localStorage.getItem("userId");
    const token = getTokenOrRedirect();
    if (!token) return;

    // Kiểm tra các trường bắt buộc
    if (
      !newEvent.studentId ||
      isNaN(Number(newEvent.studentId)) ||
      Number(newEvent.studentId) === 0
    ) {
      notifyError("請選擇學生。");
      return;
    }
    if (
      !newEvent.eventTypeId ||
      isNaN(Number(newEvent.eventTypeId)) ||
      Number(newEvent.eventTypeId) === 0
    ) {
      notifyError("請選擇傷病類型。");
      return;
    }
    if (
      !newEvent.severityId ||
      isNaN(Number(newEvent.severityId)) ||
      Number(newEvent.severityId) === 0
    ) {
      notifyError("請選擇嚴重程度。");
      return;
    }
    if (!newEvent.eventDate) {
      notifyError("請選擇時間。");
      return;
    }
    if (!newEvent.description) {
      notifyError("請輸入傷病描述。");
      return;
    }
    if (!currentUserId) {
      notifyError("請重新登入。");
      return;
    }

    const studentObj = allStudents.find(s => Number(s.studentId) === Number(newEvent.studentId));
    const payload = {
      studentId: Number(newEvent.studentId),
      eventTypeId: Number(newEvent.eventTypeId),
      severityId: Number(newEvent.severityId),
      eventDate: newEvent.eventDate,
      description: newEvent.description,
      handledByUserId: currentUserId,
      status: "已建立",
      location: newEvent.location,
      notes: newEvent.notes,
      suppliesUsed: suppliesUsed
        .filter(
          (item) =>
            item.supplyID &&
            !isNaN(parseInt(item.supplyID, 10)) &&
            Number(item.quantityUsed) > 0
        )
        .map((item) => ({
          supplyID: parseInt(item.supplyID, 10),
          quantityUsed: Number(item.quantityUsed),
          note: item.note || "",
        })),
      request: "無特殊需求",
      parentId: studentObj?.parentId,
      studentName: studentObj?.fullName,
      parentName: studentObj?.parentName,
      className: studentObj?.className,
    };

    console.log("📤 Payload gửi API:", payload);
    console.log("🔑 Token:", token);

    axios
      .post(MEDICAL_EVENT_API, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        console.log("✅ 新增傷病紀錄成功：", res.data);
        const added = {
          ...res.data,
          handledByName: "目前使用者",
          notificationSent: false, // mặc định chưa gửi, sẽ cập nhật sau khi gửi
          parentId: payload.parentId,
          studentName: payload.studentName,
          parentName: payload.parentName,
          className: payload.className,
        };
        setEvents((prev) => [...prev, added]);
        setShowCreateForm(false);
        setNewEvent({
          studentId: "",
          eventTypeId: "",
          severityId: "",
          eventDate: new Date().toISOString().slice(0, 16),
          description: "",
          handledByUserId: "",
          location: "",
          notes: "",
        });
        setSuppliesUsed([]);
        fetchEvents();
        // Map lại các trường cho notification
        const eventTypeObj = eventTypes.find(et => et.id == payload.eventTypeId);
        const severityObj = severityLevels.find(sl => sl.id == payload.severityId);
        const notificationEvent = {
          ...added,
          eventType: eventTypeObj ? eventTypeObj.name : "未填寫",
          severityLevelName: severityObj ? severityObj.level : "未填寫",
          description: payload.description || "無",
          eventDate: payload.eventDate || "",
          studentName: payload.studentName,
          parentId: payload.parentId,
        };
        sendNotificationToParent(notificationEvent.studentId, notificationEvent).then((ok) => {
          if (ok) {
            notifySuccess("新增傷病紀錄並建立本機通知成功！");
          } else {
            notifyError("傷病紀錄已新增，但本機通知建立失敗。");
          }
        });
      })
      .catch((err) => {
        const errorDetail =
          err.response?.data?.errors || err.response?.data || err.message;
        console.error("❌ Lỗi tạo 筆傷病:", errorDetail);
        notifyError("新增傷病紀錄失敗。");
      });
  };

  const handleEdit = (event) => {
    const suppliesWithId = (event.suppliesUsed || []).map((used) => {
      const supplyData = supplies.find((s) => s.name === used.supplyName);
      return {
        ...used,
        supplyID: used.supplyID || supplyData?.supplyID,
      };
    });
    setEditingEvent({ ...event, suppliesUsed: suppliesWithId });
    setShowEditForm(true);
    setSelectedEvent(null); // Close detail view
  };

  const handleUpdate = () => {
    if (!editingEvent) return;
    const token = getTokenOrRedirect();
    if (!token) return;
    const payload = {
      ...editingEvent,
      severityId: Number(editingEvent.severityId),
      description: editingEvent.description,
      location: editingEvent.location,
      notes: editingEvent.notes,
      suppliesUsed: (editingEvent.suppliesUsed || [])
        .filter(
          (item) =>
            item.supplyID &&
            !isNaN(parseInt(item.supplyID, 10)) &&
            Number(item.quantityUsed) > 0
        )
        .map((item) => ({
          supplyID: parseInt(item.supplyID, 10),
          quantityUsed: Number(item.quantityUsed),
          note: item.note || "",
        })),
    };

    console.log("📤 Payload cập nhật:", payload);

    axios
      .put(`${MEDICAL_EVENT_API}/${editingEvent.eventId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        console.log("✅ 更新傷病紀錄成功：", res.data);
        fetchEvents();
        setShowEditForm(false);
        setEditingEvent(null);
        notifySuccess("更新傷病紀錄成功！");
      })
      .catch((err) => {
        const errorDetail =
          err.response?.data?.errors || err.response?.data || err.message;
        console.error("❌ Lỗi cập nhật 筆傷病:", errorDetail);
        notifyError("更新傷病紀錄失敗。");
      });
  };

  const handleDelete = (id) => {
    toast.warn(
      <div>
        <div>目前使用者 có chắc chắn muốn xoá 筆傷病 này?</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
            onClick={() => {
              toast.dismiss();
              axios
                .delete(`${MEDICAL_EVENT_API}/${id}`)
                .then(() => {
                  setEvents((prev) => prev.filter((e) => e.eventId !== id));
                  setSelectedEvent(null);
                  notifySuccess("傷病紀錄已刪除。");
                })
                .catch(() => notifyError("刪除傷病紀錄失敗。"));
            }}
          >
            刪除
          </button>
          <button
            style={{ background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
            onClick={() => toast.dismiss()}
          >
            取消
          </button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false, closeButton: false, position: "top-center" }
    );
  };

  const handleBulkCreate = () => {
    const currentUserId = localStorage.getItem("userId");
    const token = getTokenOrRedirect();
    if (!token) return;

    // Kiểm tra các trường bắt buộc
    if (
      !bulkEvent.selectedStudents ||
      bulkEvent.selectedStudents.length === 0
    ) {
      notifyError("請至少選擇一名學生。");
      return;
    }
    if (
      !bulkEvent.eventTypeId ||
      isNaN(Number(bulkEvent.eventTypeId)) ||
      Number(bulkEvent.eventTypeId) === 0
    ) {
      notifyError("請選擇傷病類型。");
      return;
    }
    if (
      !bulkEvent.severityId ||
      isNaN(Number(bulkEvent.severityId)) ||
      Number(bulkEvent.severityId) === 0
    ) {
      notifyError("請選擇嚴重程度。");
      return;
    }
    if (!bulkEvent.eventDate) {
      notifyError("請選擇時間。");
      return;
    }
    if (!bulkEvent.description) {
      notifyError("請輸入傷病描述。");
      return;
    }
    if (!currentUserId) {
      notifyError("請重新登入。");
      return;
    }

    const suppliesPayload = bulkSuppliesUsed
      .filter(
        (item) =>
          item.supplyID &&
          !isNaN(parseInt(item.supplyID, 10)) &&
          Number(item.quantityUsed) > 0
      )
      .map((item) => ({
        supplyID: parseInt(item.supplyID, 10),
        quantityUsed: Number(item.quantityUsed),
        note: item.note || "",
      }));

    // 新增 nhiều 筆傷病 cùng lúc
    const promises = bulkEvent.selectedStudents.map((studentId) => {
      const studentObj = allStudents.find(s => Number(s.studentId) === Number(studentId));
      const payload = {
        studentId: Number(studentId),
        eventTypeId: Number(bulkEvent.eventTypeId),
        severityId: Number(bulkEvent.severityId),
        eventDate: bulkEvent.eventDate,
        description: bulkEvent.description,
        handledByUserId: currentUserId,
        status: "已建立",
        location: bulkEvent.location,
        notes: bulkEvent.notes,
        suppliesUsed: suppliesPayload,
        request: "無特殊需求",
        parentId: studentObj?.parentId,
        studentName: studentObj?.fullName,
        parentName: studentObj?.parentName,
        className: studentObj?.className,
      };

      return axios.post(MEDICAL_EVENT_API, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    });

    Promise.all(promises)
      .then(async (responses) => {
        const addedEvents = responses.map((res) => {
          const event = res.data;
          const sid = event.studentId || event.data?.studentId;
          const studentObj = allStudents.find(s => Number(s.studentId) === Number(sid));
          return {
            ...event,
            studentId: sid,
            handledByName: "目前使用者",
            notificationSent: false,
            parentId: event.parentId || studentObj?.parentId,
            studentName: event.studentName || studentObj?.fullName || "",
            parentName: event.parentName || studentObj?.parentName || "",
            className: event.className || studentObj?.className || "",
            eventType: event.eventType || event.data?.eventType || (eventTypes.find(et => et.id == (event.eventTypeId || event.data?.eventTypeId))?.name) || "未填寫",
            severityLevelName: event.severityLevelName || event.data?.severityLevelName || (severityLevels.find(sl => sl.id == (event.severityId || event.data?.severityId))?.level) || "未填寫",
            description: event.description || event.data?.description || "無",
            eventDate: event.eventDate || event.data?.eventDate || "",
          };
        });
        setEvents((prev) => [...prev, ...addedEvents]);
        setShowBulkCreateForm(false);
        setBulkEvent({
          selectedStudents: [],
          eventTypeId: "",
          severityId: "",
          eventDate: new Date().toISOString().slice(0, 16),
          description: "",
          location: "",
          notes: "",
        });
        setBulkSuppliesUsed([]);
        setShowAllStudents(false);
        setSearchStudent("");
        fetchEvents();
        notifySuccess(`已成功建立 ${responses.length} 筆傷病紀錄！`);
        // 建立本機通知 週 tự cho từng event, luôn truyền đúng studentId
        let hasError = false;
        for (const event of addedEvents) {
          const ok = await sendNotificationToParent(event.studentId, event);
          if (!ok) hasError = true;
        }
        if (hasError) {
          notifyError("部分本機通知建立失敗，請確認。");
        } else {
          notifySuccess("已建立通知 và email cho tất cả phụ huynh!");
        }
      })
      .catch((err) => {
        const errorDetail =
          err.response?.data?.errors || err.response?.data || err.message;
        console.error("❌ Lỗi tạo hàng loạt 筆傷病:", errorDetail);
        notifyError("批次新增傷病紀錄失敗。");
      });
  };

  // Hàm helper để lấy học sinh theo lớp
  const getStudentsByClass = (className) => {
    return allStudents.filter(student => student.className === className);
  };

  // Hàm helper để chọn toàn bộ học sinh trong lớp
  const selectAllStudentsInClass = (className) => {
    const classStudents = getStudentsByClass(className);
    const currentSelected = new Set(bulkEvent.selectedStudents);
    
    classStudents.forEach(student => {
      currentSelected.add(student.studentId);
    });
    
    setBulkEvent({
      ...bulkEvent,
      selectedStudents: Array.from(currentSelected)
    });
  };

  // Hàm helper để bỏ chọn toàn bộ học sinh trong lớp
  const deselectAllStudentsInClass = (className) => {
    const classStudents = getStudentsByClass(className);
    const currentSelected = bulkEvent.selectedStudents.filter(
      studentId => !classStudents.some(student => student.studentId === studentId)
    );
    
    setBulkEvent({
      ...bulkEvent,
      selectedStudents: currentSelected
    });
  };

  // Hàm helper để lọc học sinh theo tìm kiếm
  const getFilteredStudents = () => {
    if (!searchStudent) return allStudents;
    return allStudents.filter(student => 
      student.fullName?.toLowerCase().includes(searchStudent.toLowerCase()) ||
      student.className?.toLowerCase().includes(searchStudent.toLowerCase())
    );
  };

  // Hàm lấy dữ liệu cho BarChart: top 10 loại 筆傷病
  const getBarChartData = (data) => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const typeMap = {};
    data.forEach((event) => {
      if (event.eventType) {
        typeMap[event.eventType] = (typeMap[event.eventType] || 0) + 1;
      }
    });
    const sorted = Object.entries(typeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return sorted.slice(0, 10);
  };

  // Skeleton loading rows
  const skeletonRows = Array.from({ length: itemsPerPage }, (_, i) => (
    <tr key={i} className={style.skeletonRow}>
      <td colSpan={5}>
        <div className={style.skeletonBox} style={{ height: 32, width: "100%" }} />
      </td>
    </tr>
  ));

  return (
    <div className={style.pageContainer}>
      <Notification />
      <Sidebar />
      <div className={style.contentArea}>
        {/* LOADING OVERLAY */}
        {(loading || modalLoading) && <LoadingOverlay text="資料載入中..." />}
        <div className={style.header}>
          <h2>學生傷病紀錄</h2>
          <div className={style.headerButtons}>
            <button
              className={style.bulkAddButton}
              onClick={() => setShowBulkCreateForm(true)}
            >
              <Users size={16} /> 批次新增
            </button>
            <button
              className={style.addButton}
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={16} /> 新增傷病紀錄
            </button>
          </div>
        </div>

        <div className={style.filters}>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
          >
            <option value="全部">全部</option>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.name}>
                {type.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <div className={style.searchBox}>
            <Search size={16} />
            <input
              type="text"
              placeholder="搜尋學生..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="day">依日期</option>
            <option value="week">依週</option>
            <option value="month">依月份</option>
          </select>
        </div>

        <div className={style.incidentTable}>
          <table>
            <thead>
              <tr>
                <th>學生</th>
                <th>傷病類型</th>
                <th>時間</th>
                <th>嚴重程度</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? skeletonRows
                : currentItems.map((event) => (
                    <tr key={event.eventId} className={style.tableRow}>
                      <td>{event.studentName}</td>
                      <td>
                        <span className={style.tagBlue}>{event.eventType}</span>
                      </td>
                      <td>{new Date(event.eventDate).toLocaleString("zh-TW")}</td>
                      <td>
                        <span
                          className={
                            event.severityLevelName === "輕度"
                              ? style.tagYellow
                              : event.severityLevelName === "中度"
                              ? style.tagOrange
                              : style.tagRed
                          }
                        >
                          {event.severityLevelName}
                        </span>
                      </td>

                      <td>
                        <button
                          className={style.viewDetail}
                          onClick={() => setSelectedEvent(event)}
                        >
                          查看詳細資料
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className={style.pagination}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            〈
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={currentPage === i + 1 ? style.activePage : ""}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            〉
          </button>
        </div>

        <div className={style.summarySection}>
          <div className={style.chartCard}>
            <h4>依傷病類型統計</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={getBarChartData(filteredEvents)}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 13 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 13 }} />
                <Tooltip formatter={(value) => [`${value} 筆傷病`]} />
                <Legend />
                <Bar dataKey="value" fill="#4D96FF">
                  {getBarChartData(filteredEvents).map((entry, index) => (
                    <Cell key={`cell-bar-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={style.summaryCard}>
            <h4>摘要</h4>
            <p>
              傷病總筆數: <strong>{summary.total}</strong>
            </p>
            <p>
              已建立通知: <strong>{summary.sent}</strong>
            </p>
            <p>
              待處理: <strong>{summary.pending}</strong>
            </p>
            <div className={style.links}>
              <button onClick={handleExportExcel}>匯出 Excel</button>
            </div>
          </div>

          <div className={style.chartCard}>
            <h4>
              趨勢：{" "}
              {groupBy === "day"
                ? "日"
                : groupBy === "week"
                ? "週"
                : "月"}
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4D96FF"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>傷病紀錄詳細資料</h3>
            <table className={style.detailTable}>
              <tbody>
                <tr>
                  <td>
                    <strong>學生:</strong>
                  </td>
                  <td>{selectedEvent.studentName}</td>
                </tr>
                <tr>
                  <td>
                    <strong>家長／聯絡人:</strong>
                  </td>
                  <td>{selectedEvent.parentName}</td>
                </tr>
                <tr>
                  <td>
                    <strong>傷病類型:</strong>
                  </td>
                  <td>{selectedEvent.eventType}</td>
                </tr>
                <tr>
                  <td>
                    <strong>嚴重程度:</strong>
                  </td>
                  <td>{selectedEvent.severityLevelName}</td>
                </tr>
                <tr>
                  <td>
                    <strong>時間:</strong>
                  </td>
                  <td>{new Date(selectedEvent.eventDate).toLocaleString("zh-TW")}</td>
                </tr>
                <tr>
                  <td>
                    <strong>發生地點:</strong>
                  </td>
                  <td>{selectedEvent.location || "未填寫"}</td>
                </tr>
                <tr>
                  <td>
                    <strong>傷病描述:</strong>
                  </td>
                  <td>{selectedEvent.description}</td>
                </tr>
                <tr>
                  <td>
                    <strong>備註:</strong>
                  </td>
                  <td>{selectedEvent.notes || "無"}</td>
                </tr>
                <tr>
                  <td>
                    <strong>處理人員:</strong>
                  </td>
                  <td>
                    {getStaffName(
                      selectedEvent.handledByUserId,
                      selectedEvent.handledByName
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {selectedEvent.suppliesUsed?.length > 0 && (
              <>
                <p>
                  <h4 className={style.sectionTitle}>已使用醫療物資:</h4>
                </p>
                <table className={style.detailTable}>
                  <thead>
                    <tr>
                      <th>物資名稱</th>
                      <th>數量</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEvent.suppliesUsed.map((supply, index) => (
                      <tr key={index}>
                        <td>{supply.supplyName}</td>
                        <td>
                          {supply.quantityUsed} {supply.unit || ""}
                        </td>
                        <td>{supply.note || "無備註"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {selectedMedicalHistory.length > 0 && (
              <>
                <p>
                  <h4 className={style.sectionTitle}>既往病史:</h4>
                </p>
                <table className={style.detailTable}>
                  <thead>
                    <tr>
                      <th>疾病</th>
                      <th>備註</th>
                      <th>診斷日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMedicalHistory.map((mh) => (
                      <tr key={mh.historyId}>
                        <td>{mh.diseaseName}</td>
                        <td>{mh.note || "無備註"}</td>
                        <td>
                          {new Date(mh.diagnosedDate).toLocaleDateString("zh-TW")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className={style.modalActions}>
              <button
                className={style.editBtn}
                onClick={() => handleEdit(selectedEvent)}
              >
                編輯
              </button>
              <button
                className={style.deleteBtn}
                onClick={() => handleDelete(selectedEvent.eventId)}
              >
                刪除
              </button>
              <button onClick={() => setSelectedEvent(null)}>關閉</button>
              {selectedEvent && !selectedEvent.notificationSent && (
                <button
                  className={style.sendBtn}
                  onClick={() => setShowSendOption(true)}
                >
                  建立本機通知
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showSendOption && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h4>是否建立家長通知？</h4>
            <button
              className={style.sendBtn}
              onClick={async () => {
                // Gửi notification và email đồng thời
                try {
                  const token = getTokenOrRedirect();
                  if (!token) return;
                  const res = await axios.get(
                    `${STUDENT_API}/${selectedEvent.studentId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const parentId = res.data?.data?.parentId;
                  if (!parentId) {
                    notifyError("找不到此學生的家長／聯絡人。");
                    return;
                  }
                  const message = `學生: ${selectedEvent.studentName}\n傷病類型: ${selectedEvent.eventType}\n時間: ${selectedEvent.eventDate ? new Date(selectedEvent.eventDate).toLocaleString("zh-TW") : "未填寫"}\n嚴重程度: ${selectedEvent.severityLevelName || "未填寫"}\n傷病描述: ${selectedEvent.description || "無"}`;
                  const subject = "校園傷病紀錄通知";
                  // Gửi notification và email song song
                  await Promise.all([
                    axios.post(
                      NOTIFICATION_API,
                      {
                        receiverId: parentId,
                        title: subject,
                        message,
                        typeId: 2,
                        isRead: false,
                      },
                      { headers: { Authorization: `Bearer ${token}` } }
                    ),
                    axios.post(
                      "http://127.0.0.1:5080/api/Email/send-by-userid",
                      {
                        userId: parentId,
                        subject,
                        body: message,
                      },
                      { headers: { Authorization: `Bearer ${token}` } }
                    ),
                  ]);
                  notifySuccess("已建立通知 và email cho phụ huynh!");
                  setShowSendOption(false);
                } catch {
                  notifyError("建立本機通知 hoặc email thất bại!");
                }
              }}
            >
              建立本機通知
            </button>
            <button
              className={style.closeBtn}
              onClick={() => setShowSendOption(false)}
            >
              關閉
            </button>
          </div>
        </div>
      )}
      {showCreateForm && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>新增傷病紀錄</h3>
            {/* Dropdown chọn lớp */}
            <select
              value={selectedClass}
              onClick={() => {
                if (classList.length === 0 && students.length > 0) {
                  const uniqueClasses = Array.from(
                    new Set(students.map((s) => s.className).filter(Boolean))
                  );
                  setClassList(uniqueClasses);
                }
              }}
              onChange={async (e) => {
                const className = e.target.value;
                setSelectedClass(className);
                setNewEvent({ ...newEvent, studentId: "" });
                if (className) {
                  try {
                    const token = getTokenOrRedirect();
                    if (!token) return;
                    const res = await axios.get(
                      `${STUDENT_API}/by-class/${encodeURIComponent(className)}`,
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    setClassStudents(
                      Array.isArray(res.data.data) ? res.data.data : []
                    );
                  } catch {
                    setClassStudents([]);
                  }
                } else {
                  setClassStudents([]);
                }
              }}
              style={{ marginBottom: 12 }}
            >
              <option value="">-- 選擇班級 --</option>
              {classList.map((cl) => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
            <Select
              options={
                Array.isArray(classStudents)
                  ? classStudents.filter(s => !!s.parentId).map((s) => ({
                      value: s.studentId,
                      label: s.fullName,
                    }))
                  : []
              }
              placeholder={selectedClass ? "搜尋學生..." : "請先選擇班級"}
              isDisabled={!selectedClass}
              value={
                classStudents.find((s) => s.studentId === newEvent.studentId)
                  ? {
                      value: newEvent.studentId,
                      label: classStudents.find(
                        (s) => s.studentId === newEvent.studentId
                      )?.fullName,
                    }
                  : null
              }
              onChange={(selectedOption) =>
                setNewEvent({ ...newEvent, studentId: selectedOption.value })
              }
            />

            <select
              value={newEvent.eventTypeId}
              onChange={(e) => {
                if (e.target.value === "add_new_type") {
                  setShowCreateEventTypeModal(true);
                } else {
                  setNewEvent({ ...newEvent, eventTypeId: e.target.value });
                }
              }}
            >
              <option value="">-- 傷病類型 --</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
              <option
                value="add_new_type"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                + 新增傷病類型...
              </option>
            </select>

            <select
              value={newEvent.severityId}
              onChange={(e) =>
                setNewEvent({ ...newEvent, severityId: e.target.value })
              }
            >
              <option value="">-- 嚴重程度 --</option>
              {severityLevels.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.level}
                </option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={newEvent.eventDate}
              onChange={(e) =>
                setNewEvent({ ...newEvent, eventDate: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="發生地點 xảy ra 筆傷病"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent({ ...newEvent, location: e.target.value })
              }
            />

            <textarea
              placeholder="傷病描述"
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
            />

            <textarea
              placeholder="備註"
              value={newEvent.notes}
              onChange={(e) =>
                setNewEvent({ ...newEvent, notes: e.target.value })
              }
            />

            <h4 className={style.sectionTitle}>已使用醫療物資:</h4>
            {suppliesUsed.map((s, index) => (
              <div
                key={index}
                style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
              >
                <select
                  value={s.supplyID}
                  onChange={(e) => {
                    const updated = [...suppliesUsed];
                    updated[index].supplyID = e.target.value;
                    setSuppliesUsed(updated);
                  }}
                >
                  <option value="">-- 選擇醫療物資 --</option>
                  {Array.isArray(supplies)
                    ? supplies.map((supply) => (
                        <option key={supply.supplyID} value={supply.supplyID}>
                          {supply.name}
                        </option>
                      ))
                    : null}
                </select>

                <input
                  type="number"
                  placeholder="數量"
                  value={s.quantityUsed}
                  onChange={(e) => {
                    const updated = [...suppliesUsed];
                    updated[index].quantityUsed = e.target.value;
                    setSuppliesUsed(updated);
                  }}
                  style={{ width: "80px" }}
                />

                <input
                  type="text"
                  placeholder="備註"
                  value={s.note}
                  onChange={(e) => {
                    const updated = [...suppliesUsed];
                    updated[index].note = e.target.value;
                    setSuppliesUsed(updated);
                  }}
                />

                <button
                  onClick={() => {
                    const updated = [...suppliesUsed];
                    updated.splice(index, 1);
                    setSuppliesUsed(updated);
                  }}
                >
                  ❌
                </button>
              </div>
            ))}

            <button
              onClick={() =>
                setSuppliesUsed([
                  ...suppliesUsed,
                  { supplyID: "", quantityUsed: 1, note: "" },
                ])
              }
              style={{ marginBottom: "10px" }}
            >
              + 新增物資
            </button>

            <div className={style.modalActions}>
              <button className={style.tagBlue} onClick={handleCreate}>
                新增
              </button>

              <button
                className={style.closeBtn}
                onClick={() => setShowCreateForm(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditForm && editingEvent && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>編輯 筆傷病</h3>

            <label className={style.infoLabel}>
              學生: <strong>{editingEvent.studentName}</strong>
            </label>
            <label className={style.infoLabel}>
              傷病類型: <strong>{editingEvent.eventType}</strong>
            </label>

            <select
              value={editingEvent.severityId}
              onChange={(e) =>
                setEditingEvent({ ...editingEvent, severityId: e.target.value })
              }
            >
              <option value="">-- 嚴重程度 --</option>
              {severityLevels.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.level}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="發生地點 xảy ra 筆傷病"
              value={editingEvent.location}
              onChange={(e) =>
                setEditingEvent({ ...editingEvent, location: e.target.value })
              }
            />

            <textarea
              placeholder="傷病描述"
              value={editingEvent.description}
              onChange={(e) =>
                setEditingEvent({
                  ...editingEvent,
                  description: e.target.value,
                })
              }
            />

            <textarea
              placeholder="備註"
              value={editingEvent.notes}
              onChange={(e) =>
                setEditingEvent({ ...editingEvent, notes: e.target.value })
              }
            />

            <h4 className={style.sectionTitle}>已使用醫療物資:</h4>
            {(editingEvent.suppliesUsed || []).map((s, index) => (
              <div
                key={index}
                style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
              >
                <select
                  value={s.supplyID}
                  onChange={(e) => {
                    const updated = [...editingEvent.suppliesUsed];
                    updated[index].supplyID = e.target.value;
                    setEditingEvent({
                      ...editingEvent,
                      suppliesUsed: updated,
                    });
                  }}
                >
                  <option value="">-- 選擇醫療物資 --</option>
                  {Array.isArray(supplies)
                    ? supplies.map((supply) => (
                        <option key={supply.supplyID} value={supply.supplyID}>
                          {supply.name}
                        </option>
                      ))
                    : null}
                </select>

                <input
                  type="number"
                  placeholder="數量"
                  value={s.quantityUsed}
                  onChange={(e) => {
                    const updated = [...editingEvent.suppliesUsed];
                    updated[index].quantityUsed = e.target.value;
                    setEditingEvent({
                      ...editingEvent,
                      suppliesUsed: updated,
                    });
                  }}
                  style={{ width: "80px" }}
                />

                <input
                  type="text"
                  placeholder="備註"
                  value={s.note}
                  onChange={(e) => {
                    const updated = [...editingEvent.suppliesUsed];
                    updated[index].note = e.target.value;
                    setEditingEvent({
                      ...editingEvent,
                      suppliesUsed: updated,
                    });
                  }}
                />

                <button
                  onClick={() => {
                    const updated = [...editingEvent.suppliesUsed];
                    updated.splice(index, 1);
                    setEditingEvent({
                      ...editingEvent,
                      suppliesUsed: updated,
                    });
                  }}
                >
                  ❌
                </button>
              </div>
            ))}

            <button
              onClick={() =>
                setEditingEvent({
                  ...editingEvent,
                  suppliesUsed: [
                    ...(editingEvent.suppliesUsed || []),
                    { supplyID: "", quantityUsed: 1, note: "" },
                  ],
                })
              }
              style={{ marginBottom: "10px" }}
            >
              + 新增物資
            </button>

            <div className={style.modalActions}>
              <button className={style.tagBlue} onClick={handleUpdate}>
                更新
              </button>
              <button
                className={style.closeBtn}
                onClick={() => {
                  setShowEditForm(false);
                  setEditingEvent(null);
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkCreateForm && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>新增 筆傷病 hàng loạt</h3>
            <p className={style.bulkDescription}>
              可一次為多名學生建立相同類型的傷病紀錄
            </p>

            {/* Tab chọn phương thức */}
            <div className={style.tabContainer}>
              <button
                className={`${style.tabButton} ${!showAllStudents ? style.activeTab : ''}`}
                onClick={() => setShowAllStudents(false)}
              >
                依班級選擇
              </button>
              <button
                className={`${style.tabButton} ${showAllStudents ? style.activeTab : ''}`}
                onClick={() => setShowAllStudents(true)}
              >
                從全部學生選擇
              </button>
            </div>

            {!showAllStudents ? (
              // Chế độ chọn theo lớp
              <div className={style.classSelectionMode}>
                <h4>選擇班級：</h4>
                <div className={style.classGrid}>
                  {classList.map((className) => {
                    const classStudents = getStudentsByClass(className);
                    const selectedInClass = classStudents.filter(student => 
                      bulkEvent.selectedStudents.includes(student.studentId)
                    );
                    const isAllSelected = classStudents.length > 0 && 
                      selectedInClass.length === classStudents.length;
                    
                    return (
                      <div key={className} className={style.classCard}>
                        <div className={style.classHeader}>
                          <h5>{className}</h5>
                          <span className={style.studentCount}>
                            {selectedInClass.length}/{classStudents.length} học sinh
                          </span>
                        </div>
                        <div className={style.classActions}>
                          <button
                            className={`${style.selectAllBtn} ${isAllSelected ? style.selected : ''}`}
                            onClick={() => {
                              if (isAllSelected) {
                                deselectAllStudentsInClass(className);
                              } else {
                                selectAllStudentsInClass(className);
                              }
                            }}
                          >
                            {isAllSelected ? '全部取消' : '全部選取'}
                          </button>
                          <button
                            className={style.viewStudentsBtn}
                            onClick={() => {
                              setSelectedClass(className);
                              setClassStudents(classStudents);
                            }}
                          >
                            查看詳細資料
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hiển thị học sinh của lớp được chọn */}
                {selectedClass && (
                  <div className={style.selectedClassStudents}>
                    <h4>學生 lớp {selectedClass}:</h4>
                    <div className={style.studentCheckboxList}>
                      {classStudents.filter(s => !!s.parentId).map((student) => (
                        <label key={student.studentId} className={style.studentCheckbox}>
                          <input
                            type="checkbox"
                            checked={bulkEvent.selectedStudents.includes(student.studentId)}
                            onChange={(e) => {
                              const currentSelected = new Set(bulkEvent.selectedStudents);
                              if (e.target.checked) {
                                currentSelected.add(student.studentId);
                              } else {
                                currentSelected.delete(student.studentId);
                              }
                              setBulkEvent({
                                ...bulkEvent,
                                selectedStudents: Array.from(currentSelected)
                              });
                            }}
                          />
                          <span>{student.fullName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Chế độ chọn từ tất cả học sinh
              <div className={style.allStudentsMode}>
                <div className={style.searchContainer}>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="搜尋學生或班級..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                  />
                </div>
                
                <div className={style.studentSelectionArea}>
                  <div className={style.studentCheckboxList}>
                    {getFilteredStudents().filter(s => !!s.parentId).map((student) => (
                      <label key={student.studentId} className={style.studentCheckbox}>
                        <input
                          type="checkbox"
                          checked={bulkEvent.selectedStudents.includes(student.studentId)}
                          onChange={(e) => {
                            const currentSelected = new Set(bulkEvent.selectedStudents);
                            if (e.target.checked) {
                              currentSelected.add(student.studentId);
                            } else {
                              currentSelected.delete(student.studentId);
                            }
                            setBulkEvent({
                              ...bulkEvent,
                              selectedStudents: Array.from(currentSelected)
                            });
                          }}
                        />
                        <span className={style.studentName}>{student.fullName}</span>
                        <span className={style.studentClass}>{student.className}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <select
              value={bulkEvent.eventTypeId}
              onChange={(e) => {
                if (e.target.value === "add_new_type") {
                  setShowCreateEventTypeModal(true);
                } else {
                  setBulkEvent({ ...bulkEvent, eventTypeId: e.target.value });
                }
              }}
            >
              <option value="">-- 傷病類型 --</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
              <option
                value="add_new_type"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                + 新增傷病類型...
              </option>
            </select>

            <select
              value={bulkEvent.severityId}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, severityId: e.target.value })
              }
            >
              <option value="">-- 嚴重程度 --</option>
              {severityLevels.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.level}
                </option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={bulkEvent.eventDate}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, eventDate: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="發生地點 xảy ra 筆傷病"
              value={bulkEvent.location}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, location: e.target.value })
              }
            />

            <textarea
              placeholder="傷病描述 chung cho tất cả học sinh"
              value={bulkEvent.description}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, description: e.target.value })
              }
            />

            <textarea
              placeholder="備註 chung"
              value={bulkEvent.notes}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, notes: e.target.value })
              }
            />

            <h4 className={style.sectionTitle}>已使用醫療物資 (chung):</h4>
            {bulkSuppliesUsed.map((s, index) => (
              <div
                key={index}
                style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
              >
                <select
                  value={s.supplyID}
                  onChange={(e) => {
                    const updated = [...bulkSuppliesUsed];
                    updated[index].supplyID = e.target.value;
                    setBulkSuppliesUsed(updated);
                  }}
                >
                  <option value="">-- 選擇醫療物資 --</option>
                  {Array.isArray(supplies)
                    ? supplies.map((supply) => (
                        <option key={supply.supplyID} value={supply.supplyID}>
                          {supply.name}
                        </option>
                      ))
                    : null}
                </select>

                <input
                  type="number"
                  placeholder="數量"
                  value={s.quantityUsed}
                  onChange={(e) => {
                    const updated = [...bulkSuppliesUsed];
                    updated[index].quantityUsed = e.target.value;
                    setBulkSuppliesUsed(updated);
                  }}
                  style={{ width: "80px" }}
                />

                <input
                  type="text"
                  placeholder="備註"
                  value={s.note}
                  onChange={(e) => {
                    const updated = [...bulkSuppliesUsed];
                    updated[index].note = e.target.value;
                    setBulkSuppliesUsed(updated);
                  }}
                />

                <button
                  onClick={() => {
                    const updated = [...bulkSuppliesUsed];
                    updated.splice(index, 1);
                    setBulkSuppliesUsed(updated);
                  }}
                >
                  ❌
                </button>
              </div>
            ))}

            <button
              onClick={() =>
                setBulkSuppliesUsed([
                  ...bulkSuppliesUsed,
                  { supplyID: "", quantityUsed: 1, note: "" },
                ])
              }
              style={{ marginBottom: "10px" }}
            >
              + 新增物資
            </button>

            {bulkEvent.selectedStudents.length > 0 && (
              <div className={style.selectedStudents}>
                <h4>已選學生（{bulkEvent.selectedStudents.length}）：</h4>
                <div className={style.studentList}>
                  {bulkEvent.selectedStudents.map((studentId) => {
                    const studentObj = allStudents.find(
                      (s) => Number(s.studentId) === Number(studentId)
                    );
                    return (
                      <span key={studentId} className={style.studentTag}>
                        {studentObj?.fullName || studentId}
                        {studentObj?.className && (
                          <span className={style.classTag}> ({studentObj.className})</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={style.modalActions}>
              <button className={style.sendBtn} onClick={handleBulkCreate}>
                新增 cho {bulkEvent.selectedStudents.length} học sinh
              </button>
              <button
                className={style.closeBtn}
                onClick={() => {
                  setShowBulkCreateForm(false);
                  setSelectedClass("");
                  setClassStudents([]);
                  setShowAllStudents(false);
                  setSearchStudent("");
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateEventTypeModal && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent} style={{ maxWidth: "400px" }}>
            <h3>新增 loại 筆傷病 mới</h3>
            <input
              type="text"
              placeholder="請輸入傷病類型名稱..."
              value={newEventTypeName}
              onChange={(e) => setNewEventTypeName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                boxSizing: "border-box",
                marginBottom: "12px",
              }}
            />
            <div className={style.modalActions}>
              <button className={style.tagBlue} onClick={handleCreateEventType}>
                新增
              </button>
              <button
                className={style.closeBtn}
                onClick={() => setShowCreateEventTypeModal(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incident;
