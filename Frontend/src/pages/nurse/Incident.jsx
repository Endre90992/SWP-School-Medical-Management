import React, { useState, useEffect } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import style from "../../assets/css/incidentPage.module.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
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
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [eventTypeFilter, setEventTypeFilter] = useState("Tất cả");
  const [dateFilter, setDateFilter] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    sent: 0,
    draft: 0,
    pending: 0,
  });
  const [distributionData, setDistributionData] = useState([]);
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
    { id: "1", level: "Nhẹ" },
    { id: "2", level: "Trung bình" },
    { id: "3", level: "Nặng" },
  ];

  // Thêm hàm kiểm tra token
  const getTokenOrRedirect = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      notifyError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!");
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
        console.error("❌ Lỗi lấy loại sự cố:", err);
        setEventTypes([]); // Ensure it's an empty array on error
        notifyError("Không thể tải danh sách loại sự cố. Vui lòng thử lại.");
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
        console.error("❌ Lỗi lấy danh sách sự cố:", err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  const getStaffName = (id, handledByName) => {
    if (handledByName && handledByName !== "") return handledByName;
    const user = users.find((u) => u.userId === id || u.userID === id);
    if (user) return user.fullName;
    if (id === localStorage.getItem("userId")) return "Bạn";
    return "Không rõ";
  };

  // Hàm gửi notification/email cho phụ huynh: luôn lấy parentId từ API nếu chưa có
  const sendNotificationToParent = async (studentId, event) => {
    const token = getTokenOrRedirect();
    if (!token) return false;
    try {
      // Lấy parentId từ event hoặc từ API nếu chưa có
      let parentId = event.parentId;
      let studentName = event.studentName;
      console.log('[DEBUG] Gửi thông báo cho studentId:', studentId, 'event:', event);
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
        notifyError("Không tìm thấy phụ huynh của học sinh này!");
        return false;
      }
      // Trong sendNotificationToParent, tạo message với fallback tránh undefined/null/Invalid Date
      const message = `Học sinh: ${studentName}\nLoại sự cố: ${event.eventType || "Không rõ"}\nThời gian: ${event.eventDate ? new Date(event.eventDate).toLocaleString() : "Không rõ"}\nMức độ: ${event.severityLevelName || "Không rõ"}\nMô tả: ${event.description || "Không có"}`;
      const subject = "Thông báo sự cố y tế học đường";
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
      console.log('[DEBUG] Gửi thông báo/email thành công cho parentId:', parentId);
      return true;
    } catch (err) {
      notifyError("Gửi thông báo hoặc email thất bại!");
      console.error("❌ Lỗi gửi thông báo:", err);
      if (err.response) {
        console.error('[DEBUG] Lỗi response:', err.response.data);
      }
      return false;
    }
  };

  const handleCreateEventType = () => {
    if (!newEventTypeName.trim()) {
      notifyError("Tên loại sự cố không được để trống!");
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
        notifySuccess("Tạo loại sự cố mới thành công!");
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
        console.error("❌ Lỗi tạo loại sự cố:", err);
        notifyError(
          "Lỗi khi tạo loại sự cố mới: " +
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
        
        // Tạo danh sách lớp từ dữ liệu học sinh
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
        console.error("❌ Lỗi lấy vật tư:", err);
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

  useEffect(() => {
    const filtered = events.filter((event) => {
      const matchType =
        eventTypeFilter === "Tất cả" || event.eventType === eventTypeFilter;
      const matchSearch = event.studentName
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchDate =
        !dateFilter ||
        new Date(event.eventDate).toISOString().split("T")[0] === dateFilter;
      return matchType && matchSearch && matchDate;
    });
    setFilteredEvents(filtered);
    updateStats(filtered);
    setCurrentPage(1);
  }, [search, eventTypeFilter, dateFilter, events, groupBy]);

  const updateStats = (data) => {
    const typeMap = {},
      dateMap = {};
    let sent = 0,
      draft = 0,
      pending = 0;

    data.forEach((event) => {
      typeMap[event.eventType] = (typeMap[event.eventType] || 0) + 1;
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

    setDistributionData(
      Object.entries(dateMap)
        .map(([key, value]) => ({ date: key, value }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );
    setSummary({ total: data.length, sent, draft, pending });
  };

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredEvents.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);

  const handleExportExcel = () => {
    if (filteredEvents.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(
      filteredEvents.map((e) => ({
        "Học sinh": e.studentName,
        "Loại sự cố": e.eventType,
        "Thời gian": new Date(e.eventDate).toLocaleString(),
        "Mức độ": e.severityLevelName,
        "Người xử lý": e.handledByName || "",
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sự cố y tế");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "su_co_y_te.xlsx");
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
      notifyError("Vui lòng chọn học sinh!");
      return;
    }
    if (
      !newEvent.eventTypeId ||
      isNaN(Number(newEvent.eventTypeId)) ||
      Number(newEvent.eventTypeId) === 0
    ) {
      notifyError("Vui lòng chọn loại sự cố!");
      return;
    }
    if (
      !newEvent.severityId ||
      isNaN(Number(newEvent.severityId)) ||
      Number(newEvent.severityId) === 0
    ) {
      notifyError("Vui lòng chọn mức độ!");
      return;
    }
    if (!newEvent.eventDate) {
      notifyError("Vui lòng chọn thời gian!");
      return;
    }
    if (!newEvent.description) {
      notifyError("Vui lòng nhập mô tả!");
      return;
    }
    if (!currentUserId) {
      notifyError("Vui lòng đăng nhập lại!");
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
      status: "Đã gửi",
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
      request: "Không có yêu cầu đặc biệt",
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
        console.log("✅ Tạo sự cố thành công:", res.data);
        const added = {
          ...res.data,
          handledByName: "Bạn",
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
          eventType: eventTypeObj ? eventTypeObj.name : "Không rõ",
          severityLevelName: severityObj ? severityObj.level : "Không rõ",
          description: payload.description || "Không có",
          eventDate: payload.eventDate || "",
          studentName: payload.studentName,
          parentId: payload.parentId,
        };
        sendNotificationToParent(notificationEvent.studentId, notificationEvent).then((ok) => {
          if (ok) {
            notifySuccess("Tạo sự cố và gửi thông báo thành công!");
          } else {
            notifyError("Tạo sự cố thành công nhưng gửi thông báo/email thất bại!");
          }
        });
      })
      .catch((err) => {
        const errorDetail =
          err.response?.data?.errors || err.response?.data || err.message;
        console.error("❌ Lỗi tạo sự cố:", errorDetail);
        notifyError("Lỗi khi tạo mới sự cố!");
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
        console.log("✅ Cập nhật sự cố thành công:", res.data);
        fetchEvents();
        setShowEditForm(false);
        setEditingEvent(null);
        notifySuccess("Cập nhật sự cố thành công!");
      })
      .catch((err) => {
        const errorDetail =
          err.response?.data?.errors || err.response?.data || err.message;
        console.error("❌ Lỗi cập nhật sự cố:", errorDetail);
        notifyError("Lỗi khi cập nhật sự cố!");
      });
  };

  const handleDelete = (id) => {
    toast.warn(
      <div>
        <div>Bạn có chắc chắn muốn xoá sự cố này?</div>
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
                  notifySuccess("Đã xoá sự cố!");
                })
                .catch(() => notifyError("Lỗi khi xoá sự cố!"));
            }}
          >
            Xoá
          </button>
          <button
            style={{ background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
            onClick={() => toast.dismiss()}
          >
            Huỷ
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
      notifyError("Vui lòng chọn ít nhất một học sinh!");
      return;
    }
    if (
      !bulkEvent.eventTypeId ||
      isNaN(Number(bulkEvent.eventTypeId)) ||
      Number(bulkEvent.eventTypeId) === 0
    ) {
      notifyError("Vui lòng chọn loại sự cố!");
      return;
    }
    if (
      !bulkEvent.severityId ||
      isNaN(Number(bulkEvent.severityId)) ||
      Number(bulkEvent.severityId) === 0
    ) {
      notifyError("Vui lòng chọn mức độ!");
      return;
    }
    if (!bulkEvent.eventDate) {
      notifyError("Vui lòng chọn thời gian!");
      return;
    }
    if (!bulkEvent.description) {
      notifyError("Vui lòng nhập mô tả!");
      return;
    }
    if (!currentUserId) {
      notifyError("Vui lòng đăng nhập lại!");
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

    // Tạo nhiều sự cố cùng lúc
    const promises = bulkEvent.selectedStudents.map((studentId) => {
      const studentObj = allStudents.find(s => Number(s.studentId) === Number(studentId));
      const payload = {
        studentId: Number(studentId),
        eventTypeId: Number(bulkEvent.eventTypeId),
        severityId: Number(bulkEvent.severityId),
        eventDate: bulkEvent.eventDate,
        description: bulkEvent.description,
        handledByUserId: currentUserId,
        status: "Đã gửi",
        location: bulkEvent.location,
        notes: bulkEvent.notes,
        suppliesUsed: suppliesPayload,
        request: "Không có yêu cầu đặc biệt",
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
            handledByName: "Bạn",
            notificationSent: false,
            parentId: event.parentId || studentObj?.parentId,
            studentName: event.studentName || studentObj?.fullName || "",
            parentName: event.parentName || studentObj?.parentName || "",
            className: event.className || studentObj?.className || "",
            eventType: event.eventType || event.data?.eventType || (eventTypes.find(et => et.id == (event.eventTypeId || event.data?.eventTypeId))?.name) || "Không rõ",
            severityLevelName: event.severityLevelName || event.data?.severityLevelName || (severityLevels.find(sl => sl.id == (event.severityId || event.data?.severityId))?.level) || "Không rõ",
            description: event.description || event.data?.description || "Không có",
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
        notifySuccess(`Đã tạo thành công ${responses.length} sự cố y tế!`);
        // Gửi thông báo tuần tự cho từng event, luôn truyền đúng studentId
        let hasError = false;
        for (const event of addedEvents) {
          const ok = await sendNotificationToParent(event.studentId, event);
          if (!ok) hasError = true;
        }
        if (hasError) {
          notifyError("Một số thông báo/email gửi thất bại. Vui lòng kiểm tra lại!");
        } else {
          notifySuccess("Đã gửi thông báo và email cho tất cả phụ huynh!");
        }
      })
      .catch((err) => {
        const errorDetail =
          err.response?.data?.errors || err.response?.data || err.message;
        console.error("❌ Lỗi tạo hàng loạt sự cố:", errorDetail);
        notifyError("Lỗi khi tạo hàng loạt sự cố!");
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

  // Hàm lấy dữ liệu cho BarChart: top 10 loại sự cố
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
        {(loading || modalLoading) && <LoadingOverlay text="Đang tải dữ liệu..." />}
        <div className={style.header}>
          <h2>Báo cáo sự cố y tế học đường</h2>
          <div className={style.headerButtons}>
            <button
              className={style.bulkAddButton}
              onClick={() => setShowBulkCreateForm(true)}
            >
              <Users size={16} /> Tạo hàng loạt
            </button>
            <button
              className={style.addButton}
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={16} /> Tạo sự cố mới
            </button>
          </div>
        </div>

        <div className={style.filters}>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
          >
            <option value="Tất cả">Tất cả</option>
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
              placeholder="Tìm học sinh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="day">Theo ngày</option>
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </select>
        </div>

        <div className={style.incidentTable}>
          <table>
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Loại sự cố</th>
                <th>Thời gian</th>
                <th>Mức độ</th>
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
                      <td>{new Date(event.eventDate).toLocaleString()}</td>
                      <td>
                        <span
                          className={
                            event.severityLevelName === "Nhẹ"
                              ? style.tagYellow
                              : event.severityLevelName === "Trung bình"
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
                          Xem chi tiết
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
            <h4>Thống kê theo loại</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={getBarChartData(filteredEvents)}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 13 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 13 }} />
                <Tooltip formatter={(value) => [`${value} sự cố`]} />
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
            <h4>Tóm tắt</h4>
            <p>
              Tổng sự cố: <strong>{summary.total}</strong>
            </p>
            <p>
              Đã gửi thông báo: <strong>{summary.sent}</strong>
            </p>
            <p>
              Đang chờ xử lý: <strong>{summary.pending}</strong>
            </p>
            <div className={style.links}>
              <button onClick={handleExportExcel}>Xuất dữ liệu Excel</button>
            </div>
          </div>

          <div className={style.chartCard}>
            <h4>
              Phân phối theo{" "}
              {groupBy === "day"
                ? "ngày"
                : groupBy === "week"
                ? "tuần"
                : "tháng"}
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
            <h3>Chi tiết sự cố</h3>
            <table className={style.detailTable}>
              <tbody>
                <tr>
                  <td>
                    <strong>Học sinh:</strong>
                  </td>
                  <td>{selectedEvent.studentName}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Phụ huynh:</strong>
                  </td>
                  <td>{selectedEvent.parentName}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Loại sự cố:</strong>
                  </td>
                  <td>{selectedEvent.eventType}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Mức độ:</strong>
                  </td>
                  <td>{selectedEvent.severityLevelName}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Thời gian:</strong>
                  </td>
                  <td>{new Date(selectedEvent.eventDate).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Địa điểm:</strong>
                  </td>
                  <td>{selectedEvent.location || "Không rõ"}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Mô tả:</strong>
                  </td>
                  <td>{selectedEvent.description}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Ghi chú:</strong>
                  </td>
                  <td>{selectedEvent.notes || "Không có"}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Người xử lý:</strong>
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
                  <h4 className={style.sectionTitle}>Vật tư đã sử dụng:</h4>
                </p>
                <table className={style.detailTable}>
                  <thead>
                    <tr>
                      <th>Tên vật tư</th>
                      <th>Số lượng</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEvent.suppliesUsed.map((supply, index) => (
                      <tr key={index}>
                        <td>{supply.supplyName}</td>
                        <td>
                          {supply.quantityUsed} {supply.unit || ""}
                        </td>
                        <td>{supply.note || "Không ghi chú"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {selectedMedicalHistory.length > 0 && (
              <>
                <p>
                  <h4 className={style.sectionTitle}>Tiền sử bệnh:</h4>
                </p>
                <table className={style.detailTable}>
                  <thead>
                    <tr>
                      <th>Bệnh</th>
                      <th>Ghi chú</th>
                      <th>Ngày chẩn đoán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMedicalHistory.map((mh) => (
                      <tr key={mh.historyId}>
                        <td>{mh.diseaseName}</td>
                        <td>{mh.note || "Không ghi chú"}</td>
                        <td>
                          {new Date(mh.diagnosedDate).toLocaleDateString()}
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
                Chỉnh sửa
              </button>
              <button
                className={style.deleteBtn}
                onClick={() => handleDelete(selectedEvent.eventId)}
              >
                Xoá
              </button>
              <button onClick={() => setSelectedEvent(null)}>Đóng</button>
              {selectedEvent && !selectedEvent.notificationSent && (
                <button
                  className={style.sendBtn}
                  onClick={() => setShowSendOption(true)}
                >
                  Gửi thông báo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showSendOption && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h4>Bạn muốn gửi thông báo?</h4>
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
                    notifyError("Không tìm thấy phụ huynh của học sinh này!");
                    return;
                  }
                  const message = `Học sinh: ${selectedEvent.studentName}\nLoại sự cố: ${selectedEvent.eventType}\nThời gian: ${selectedEvent.eventDate ? new Date(selectedEvent.eventDate).toLocaleString() : "Không rõ"}\nMức độ: ${selectedEvent.severityLevelName || "Không rõ"}\nMô tả: ${selectedEvent.description || "Không có"}`;
                  const subject = "Thông báo sự cố y tế học đường";
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
                  notifySuccess("Đã gửi thông báo và email cho phụ huynh!");
                  setShowSendOption(false);
                } catch {
                  notifyError("Gửi thông báo hoặc email thất bại!");
                }
              }}
            >
              Gửi thông báo
            </button>
            <button
              className={style.closeBtn}
              onClick={() => setShowSendOption(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
      {showCreateForm && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>Tạo sự cố mới</h3>
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
              <option value="">-- Chọn lớp --</option>
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
              placeholder={selectedClass ? "Tìm học sinh..." : "Chọn lớp trước"}
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
              <option value="">-- Loại sự cố --</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
              <option
                value="add_new_type"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                + Tạo loại mới...
              </option>
            </select>

            <select
              value={newEvent.severityId}
              onChange={(e) =>
                setNewEvent({ ...newEvent, severityId: e.target.value })
              }
            >
              <option value="">-- Mức độ --</option>
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
              placeholder="Địa điểm xảy ra sự cố"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent({ ...newEvent, location: e.target.value })
              }
            />

            <textarea
              placeholder="Mô tả"
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
            />

            <textarea
              placeholder="Ghi chú"
              value={newEvent.notes}
              onChange={(e) =>
                setNewEvent({ ...newEvent, notes: e.target.value })
              }
            />

            <h4 className={style.sectionTitle}>Vật tư đã sử dụng:</h4>
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
                  <option value="">-- Chọn vật tư --</option>
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
                  placeholder="Số lượng"
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
                  placeholder="Ghi chú"
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
              + Thêm vật tư
            </button>

            <div className={style.modalActions}>
              <button className={style.tagBlue} onClick={handleCreate}>
                Tạo
              </button>

              <button
                className={style.closeBtn}
                onClick={() => setShowCreateForm(false)}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditForm && editingEvent && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>Chỉnh sửa sự cố</h3>

            <label className={style.infoLabel}>
              Học sinh: <strong>{editingEvent.studentName}</strong>
            </label>
            <label className={style.infoLabel}>
              Loại sự cố: <strong>{editingEvent.eventType}</strong>
            </label>

            <select
              value={editingEvent.severityId}
              onChange={(e) =>
                setEditingEvent({ ...editingEvent, severityId: e.target.value })
              }
            >
              <option value="">-- Mức độ --</option>
              {severityLevels.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.level}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Địa điểm xảy ra sự cố"
              value={editingEvent.location}
              onChange={(e) =>
                setEditingEvent({ ...editingEvent, location: e.target.value })
              }
            />

            <textarea
              placeholder="Mô tả"
              value={editingEvent.description}
              onChange={(e) =>
                setEditingEvent({
                  ...editingEvent,
                  description: e.target.value,
                })
              }
            />

            <textarea
              placeholder="Ghi chú"
              value={editingEvent.notes}
              onChange={(e) =>
                setEditingEvent({ ...editingEvent, notes: e.target.value })
              }
            />

            <h4 className={style.sectionTitle}>Vật tư đã sử dụng:</h4>
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
                  <option value="">-- Chọn vật tư --</option>
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
                  placeholder="Số lượng"
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
                  placeholder="Ghi chú"
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
              + Thêm vật tư
            </button>

            <div className={style.modalActions}>
              <button className={style.tagBlue} onClick={handleUpdate}>
                Cập nhật
              </button>
              <button
                className={style.closeBtn}
                onClick={() => {
                  setShowEditForm(false);
                  setEditingEvent(null);
                }}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkCreateForm && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent}>
            <h3>Tạo sự cố hàng loạt</h3>
            <p className={style.bulkDescription}>
              Chọn nhiều học sinh có cùng triệu chứng để tạo sự cố cùng lúc
            </p>

            {/* Tab chọn phương thức */}
            <div className={style.tabContainer}>
              <button
                className={`${style.tabButton} ${!showAllStudents ? style.activeTab : ''}`}
                onClick={() => setShowAllStudents(false)}
              >
                Chọn theo lớp
              </button>
              <button
                className={`${style.tabButton} ${showAllStudents ? style.activeTab : ''}`}
                onClick={() => setShowAllStudents(true)}
              >
                Chọn từ tất cả học sinh
              </button>
            </div>

            {!showAllStudents ? (
              // Chế độ chọn theo lớp
              <div className={style.classSelectionMode}>
                <h4>Chọn lớp:</h4>
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
                            {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                          </button>
                          <button
                            className={style.viewStudentsBtn}
                            onClick={() => {
                              setSelectedClass(className);
                              setClassStudents(classStudents);
                            }}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hiển thị học sinh của lớp được chọn */}
                {selectedClass && (
                  <div className={style.selectedClassStudents}>
                    <h4>Học sinh lớp {selectedClass}:</h4>
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
                    placeholder="Tìm kiếm học sinh hoặc lớp..."
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
              <option value="">-- Loại sự cố --</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
              <option
                value="add_new_type"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                + Tạo loại mới...
              </option>
            </select>

            <select
              value={bulkEvent.severityId}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, severityId: e.target.value })
              }
            >
              <option value="">-- Mức độ --</option>
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
              placeholder="Địa điểm xảy ra sự cố"
              value={bulkEvent.location}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, location: e.target.value })
              }
            />

            <textarea
              placeholder="Mô tả chung cho tất cả học sinh"
              value={bulkEvent.description}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, description: e.target.value })
              }
            />

            <textarea
              placeholder="Ghi chú chung"
              value={bulkEvent.notes}
              onChange={(e) =>
                setBulkEvent({ ...bulkEvent, notes: e.target.value })
              }
            />

            <h4 className={style.sectionTitle}>Vật tư đã sử dụng (chung):</h4>
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
                  <option value="">-- Chọn vật tư --</option>
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
                  placeholder="Số lượng"
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
                  placeholder="Ghi chú"
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
              + Thêm vật tư
            </button>

            {bulkEvent.selectedStudents.length > 0 && (
              <div className={style.selectedStudents}>
                <h4>Học sinh đã chọn ({bulkEvent.selectedStudents.length}):</h4>
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
                Tạo cho {bulkEvent.selectedStudents.length} học sinh
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
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateEventTypeModal && (
        <div className={style.modalOverlay}>
          <div className={style.modalContent} style={{ maxWidth: "400px" }}>
            <h3>Tạo loại sự cố mới</h3>
            <input
              type="text"
              placeholder="Nhập tên loại sự cố..."
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
                Tạo
              </button>
              <button
                className={style.closeBtn}
                onClick={() => setShowCreateEventTypeModal(false)}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incident;
