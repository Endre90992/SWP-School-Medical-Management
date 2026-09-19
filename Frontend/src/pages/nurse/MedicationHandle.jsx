import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Sidebar from "../../components/sidebar/Sidebar";
import style from "../../assets/css/MedicationHandle.module.css";
import { Paperclip } from "lucide-react";
import clsx from "clsx";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import ProtectedImage from "../../components/ProtectedImage";

const MedicationHandle = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [givenRequests, setGivenRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [givenPage, setGivenPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 3;
  const [scheduledRequests, setScheduledRequests] = useState([]);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [lastActionMap, setLastActionMap] = useState({});
  const [imageModal, setImageModal] = useState({ open: false, path: "" });
  const [searchName, setSearchName] = useState("");

  // Lấy token và set header mặc định cho axios
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "http://127.0.0.1:5080/api/MedicationRequest/all"
      );
      const all = Array.isArray(res.data?.data) ? res.data.data : [];
      setPendingRequests(all.filter((item) => item.status === "待審核"));
      setApprovedRequests(all.filter((item) => item.status === "已核准"));
      setScheduledRequests(all.filter((item) => item.status === "已排程"));
      setGivenRequests(all.filter((item) => item.status === "已完成"));
      setRejectedRequests(all.filter((item) => item.status === "已拒絕"));
      return all;
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Helper: cập nhật lastActionMap
  const updateLastAction = (requestID) => {
    setLastActionMap((prev) => ({ ...prev, [requestID]: Date.now() }));
  };

  const handleConfirm = async (requestID, statusId = 2) => {
    const nurseID = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    if (!nurseID) {
      notifyError("找不到護理師登入資料，請重新登入。");
      return;
    }

    if (!requestID || isNaN(requestID) || nurseID.length < 10) {
      notifyError("用藥申請或護理師資料不完整。");
      return;
    }

    setSubmitting(true);
    const payload = {
      requestId: requestID,
      statusId,
      nurseId: nurseID,
    };

    try {
      await axios.post(
        "http://127.0.0.1:5080/api/MedicationRequest/handle",
        payload,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      updateLastAction(requestID);
      // ✅ Chỉ hiển thị thành công dựa trên kết quả POST
      notifySuccess(
        statusId === 2 ? "用藥申請已核准。" : "用藥申請已拒絕。"
      );

      // 🔄 Sau đó cập nhật danh sách (không kiểm tra trạng thái)
      await fetchRequests();
    } catch (error) {
      console.error("Chi tiết lỗi:", error.response?.data || error.message);
      notifyError("處理用藥申請失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  // Hàm cập nhật trạng thái sang '已排程'
  const handleSchedule = async (requestID) => {
    const token = localStorage.getItem("token");
    const nurseID = localStorage.getItem("userId");
    setSubmitting(true);
    const payload = { statusId: 4, nurseId: nurseID }; // 4: 已排程, gửi kèm nurseId
    try {
      await axios.put(
        `http://127.0.0.1:5080/api/MedicationRequest/${requestID}/status`,
        payload,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      updateLastAction(requestID);
      notifySuccess("用藥申請已排程！");
      await fetchRequests();
      setApprovedPage(1);
    } catch (error) {
      console.error("Chi tiết lỗi:", error.response?.data || error.message);
      notifyError("更新失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  // Hàm xác nhận đã uống thuốc từ bảng 'Lịch đã lên'
  const handleMarkAsGivenFromSchedule = async (requestID) => {
    const token = localStorage.getItem("token");
    setSubmitting(true);
    const payload = { statusId: 5 }; // 5: 已完成
    try {
      await axios.put(
        `http://127.0.0.1:5080/api/MedicationRequest/${requestID}/status`,
        payload,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      updateLastAction(requestID);
      notifySuccess("已更新為『已完成用藥』！");
      await fetchRequests();
      setScheduledPage(1);
    } catch (error) {
      console.error("Chi tiết lỗi:", error.response?.data || error.message);
      notifyError("更新失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  // Khi phân trang, sort các đơn theo lastActionMap (nếu có), đơn nào vừa thao tác sẽ lên đầu
  const sortByLastAction = (arr) => {
    return [...arr].sort((a, b) => {
      const tA = lastActionMap[a.requestID] || 0;
      const tB = lastActionMap[b.requestID] || 0;
      return tB - tA;
    });
  };

  // Sort theo updatedAt (mới nhất lên đầu) rồi phân trang cho bảng đã lên lịch
  const sortedGivenRequests = [...givenRequests].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  // Hàm lọc theo searchName (chỉ tên học sinh)
  const filterByStudentName = (arr) => {
    if (!searchName.trim()) return arr;
    const keyword = (searchName.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, ""));
    return arr.filter(item => {
      const student = (item.studentName || "").toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, "");
      return student.includes(keyword);
    });
  };

  const tabList = [
    { key: "pending", label: "待審核" },
    { key: "approved", label: "已核准" },
    { key: "scheduled", label: "已排程" },
    { key: "rejected", label: "拒絕" },
    { key: "given", label: "已給藥" },
  ];
  const [activeTab, setActiveTab] = useState("pending");

  // Memoized data for each tab
  // Removed unused tabData to fix compile error.

  const tabCount = useMemo(
    () => ({
      pending: pendingRequests.length,
      approved: approvedRequests.length,
      scheduled: scheduledRequests.length,
      rejected: rejectedRequests.length,
      given: givenRequests.length,
    }),
    [
      pendingRequests,
      approvedRequests,
      scheduledRequests,
      rejectedRequests,
      givenRequests,
    ]
  );

  // Badge màu cho trạng thái
  const statusBadge = (status) => {
    switch (status) {
      case "待審核":
        return <span className={style.badgePending}>待審核</span>;
      case "已核准":
        return <span className={style.badgeApproved}>已核准</span>;
      case "已排程":
        return <span className={style.badgeScheduled}>已排程</span>;
      case "已完成":
      case "已給藥":
        return <span className={style.badgeGiven}>已給藥</span>;
      case "已拒絕":
        return <span className={style.badgeRejected}>拒絕</span>;
      default:
        return <span>{status}</span>;
    }
  };

  // Card đơn thuốc
  const MedicationCard = ({ req, tableType }) => (
    <div className={style.medCard}>
      <div className={style.medCardHeader}>
        <div>
          <b>{req.studentName}</b>{" "}
          <span className={style.className}>{req.className || ""}</span>
        </div>
        <div>{statusBadge(req.status)}</div>
      </div>
      <div className={style.medCardBody}>
        <div>
          <b>藥物名稱：</b> {req.medicationName}
        </div>
        <div>
          <b>劑量：</b> {req.dosage}
        </div>
        <div>
          <b>用藥方式：</b> {req.instructions}
        </div>
        <div>
          <b></b>{" "}
          {req.imagePath ? (
            <ProtectedImage
              path={req.imagePath}
              alt="藥袋／藥品照片"
              className={style.miniImage}
              onClick={() =>
                setImageModal({
                  open: true,
                  path: req.imagePath,
                })
              }
              style={{ cursor: "pointer" }}
            />
          ) : (
            <span>-</span>
          )}
        </div>
        <div>
          <b>家長／聯絡人：</b> {req.parentName}{" "}
          {req.parentPhone ? `- ${req.parentPhone}` : ""}
        </div>
        <div>
          <b>申請時間：</b>{" "}
          {req.requestDate ? new Date(req.requestDate).toLocaleString() : "-"}
        </div>
        {req.status === "已拒絕" && req.rejectReason && (
          <div className={style.rejectReason}>
            <b>拒絕原因：</b> {req.rejectReason}
          </div>
        )}
        {req.status === "已給藥" && req.givenNote && (
          <div className={style.givenNote}>
            <b>備註：</b> {req.givenNote}
          </div>
        )}
      </div>
      <div className={style.medCardFooter}>
        <span className={style.nurseName}>{req.receivedByName || "-"}</span>
        <div className={style.actionBtns}>
          {tableType === "pending" && (
            <>
              <button
                className={style.confirmBtn}
                onClick={() => handleConfirm(req.requestID, 2)}
                disabled={submitting}
              >
                核准
              </button>
              <button
                className={style.rejectBtn}
                onClick={() => handleConfirm(req.requestID, 3)}
                disabled={submitting}
              >
                拒絕
              </button>
            </>
          )}
          {tableType === "approved" && (
            <button
              className={style.confirmBtn}
              onClick={() => handleSchedule(req.requestID)}
              disabled={submitting}
            >
              已排程
            </button>
          )}
          {tableType === "scheduled" && (
            <button
              className={style.confirmBtn}
              onClick={() => handleMarkAsGivenFromSchedule(req.requestID)}
              disabled={submitting}
            >
              已給藥
            </button>
          )}
          {/* Có thể thêm nút Chi tiết nếu muốn */}
        </div>
      </div>
    </div>
  );

  // Helper: lấy trang hiện tại và setPage cho từng tab
  const pageState = {
    pending: [currentPage, setCurrentPage],
    approved: [approvedPage, setApprovedPage],
    scheduled: [scheduledPage, setScheduledPage],
    rejected: [rejectedPage, setRejectedPage],
    given: [givenPage, setGivenPage],
  };
  const pageSize = itemsPerPage;
  const paginatedTabData = useMemo(
    () => ({
      pending: sortByLastAction(filterByStudentName(pendingRequests)).slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
      approved: sortByLastAction(filterByStudentName(approvedRequests)).slice(
        (approvedPage - 1) * pageSize,
        approvedPage * pageSize
      ),
      scheduled: sortByLastAction(filterByStudentName(scheduledRequests)).slice(
        (scheduledPage - 1) * pageSize,
        scheduledPage * pageSize
      ),
      rejected: sortByLastAction(filterByStudentName(rejectedRequests)).slice(
        (rejectedPage - 1) * pageSize,
        rejectedPage * pageSize
      ),
      given: sortByLastAction(filterByStudentName(sortedGivenRequests)).slice(
        (givenPage - 1) * pageSize,
        givenPage * pageSize
      ),
    }),
    [
      pendingRequests,
      approvedRequests,
      scheduledRequests,
      rejectedRequests,
      givenRequests,
      currentPage,
      approvedPage,
      scheduledPage,
      rejectedPage,
      givenPage,
      lastActionMap,
      searchName,
    ]
  );
  const totalPages = {
    pending: Math.ceil(pendingRequests.length / pageSize),
    approved: Math.ceil(approvedRequests.length / pageSize),
    scheduled: Math.ceil(scheduledRequests.length / pageSize),
    rejected: Math.ceil(rejectedRequests.length / pageSize),
    given: Math.ceil(givenRequests.length / pageSize),
  };

  // Component phân trang
  const Pagination = ({ total, current, setPage }) => {
    if (total <= 1) return null;
    return (
      <div className={style.pagination}>
        {[...Array(total)].map((_, i) => (
          <button
            key={i}
            className={clsx(style.pageButton, {
              [style.active]: current === i + 1,
            })}
            onClick={() => setPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={style.container}>
      <Sidebar />
      <div className={style.content}>
        {(loading || submitting) && (
          <div className={style.loadingOverlay}>
            <div className={style.customSpinner}>
              <div className={style.spinnerIcon}></div>
              <div className={style.spinnerText}>
                {loading ? "資料載入中..." : "處理中..."}
              </div>
            </div>
          </div>
        )}
        <Notification />
        {/* Tabs */}
        <div className={style.tabBar}>
          {tabList.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? style.activeTab : style.tabBtn}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}{" "}
              <span className={style.tabCount}>{tabCount[tab.key]}</span>
            </button>
          ))}
        </div>
        {/* Thanh tìm kiếm theo tên học sinh */}
        <div className={style.searchBarWrapper}>
          <input
            className={style.searchBar}
            type="text"
            placeholder="依學生姓名搜尋..."
            value={searchName}
            onChange={e => {
              setSearchName(e.target.value);
              // Reset về trang 1 khi search
              if (activeTab === "pending") setCurrentPage(1);
              if (activeTab === "approved") setApprovedPage(1);
              if (activeTab === "scheduled") setScheduledPage(1);
              if (activeTab === "rejected") setRejectedPage(1);
              if (activeTab === "given") setGivenPage(1);
            }}
          />
        </div>
        {/* Danh sách đơn dạng card */}
        <div className={style.cardList}>
          {paginatedTabData[activeTab].length === 0 ? (
            <div className={style.emptyMsg}>
              此分類目前沒有用藥申請
            </div>
          ) : (
            paginatedTabData[activeTab].map((req) => (
              <MedicationCard
                key={req.requestID}
                req={req}
                tableType={activeTab}
              />
            ))
          )}
        </div>
        {/* Phân trang */}
        <Pagination
          total={totalPages[activeTab]}
          current={pageState[activeTab][0]}
          setPage={pageState[activeTab][1]}
        />
      </div>
      {/* Modal xem ảnh thuốc */}
      {imageModal.open && (
        <div
          className={style.imageModalOverlay}
          onClick={() => setImageModal({ open: false, path: "" })}
        >
          <div
            className={style.imageModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <ProtectedImage
              path={imageModal.path}
              alt="藥袋／藥品照片"
              className={style.bigImage}
            />
            <button
              className={style.closeModalBtn}
              onClick={() => setImageModal({ open: false, path: "" })}
            >
              關閉
            </button>

          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationHandle;
