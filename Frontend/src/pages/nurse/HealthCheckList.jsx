import React, { useState, useEffect } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import { Search } from "lucide-react";
import style from "../../assets/css/HealthCheckList.module.css";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"; // Import PieChart components
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";
import HealthCheckTour from "../../utils/HealthCheckTour";
// API URL constants
const HEALTH_CHECK_CAMPAIGN_API = "http://127.0.0.1:5080/api/HealthCheckCampaign";

// Hàm gửi email cho phụ huynh
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
    throw new Error("Gửi email thất bại");
  }
};

// Hàm gửi thông báo và email cho tất cả phụ huynh của chiến dịch
const sendNotificationToAll = async (campaign) => {
  if (!campaign) return;
  let hasError = false;
  try {
    // Lấy danh sách học sinh tham gia chiến dịch
    const studentsRes = await axios.get(
      `http://127.0.0.1:5080/api/student/`
    );
    const students = studentsRes.data.data || [];
    await Promise.all(
      students.map(async (student) => {
        if (!student.parentId) return;
        // Gửi notification
        await axios.post(
          "http://127.0.0.1:5080/api/Notification/send",
          {
            receiverId: student.parentId,
            title: "健康檢查通知",
            message: `學生 ${student.fullName} 將參加健康檢查活動：${campaign.title}.\n說明：${campaign.description}.\n檢查日期：${campaign.date}`,
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
            `學生 ${student.fullName} 將參加健康檢查活動：${campaign.title}.\n說明：${campaign.description}.\n檢查日期：${campaign.date}`
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

const HealthCheckList = () => {
  // Bộ lọc thời gian và trạng thái
  // yearFilter: 0 = năm hiện tại, 1 = 最近 1 年, 2 = 最近 2 年, 3 = 最近 3 年
  const [yearFilter, setYearFilter] = useState(1);
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'latest', 'custom'
  const [campaigns, setCampaigns] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState(""); // Tìm kiếm theo tiêu đề
  const [filterStatus, setFilterStatus] = useState("全部狀態"); // Tìm kiếm theo trạng thái
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true); // Thêm trạng thái loading
  const itemsPerPage = 9;

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          HEALTH_CHECK_CAMPAIGN_API
        );
        console.log("API Response from HealthCheckList:", res.data); // Log the response
        const campaignsData = Array.isArray(res.data) ? res.data : res.data.data;
        if (Array.isArray(campaignsData)) {
          const transformed = campaignsData.map((item) => ({
            id: item.campaignId,
            title: item.title,
            date: item.date,
            description: item.description,
            createdByName: item.createdByName,
            statusName: item.statusName,
          }));
          // Sắp xếp theo ngày tạo giảm dần (mới nhất lên đầu)
          transformed.sort((a, b) => new Date(b.date) - new Date(a.date));
          setCampaigns(transformed);
        } else {
          setCampaigns([]);
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu chiến dịch:", error);
        setCampaigns([]); // Ensure campaigns is an array on error
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  // FILTER + PAGINATION
  const now = new Date();
  let fromDate, toDate;
  if (yearFilter === 0) {
    fromDate = new Date(now.getFullYear(), 0, 1);
    toDate = new Date(now.getFullYear(), 11, 31);
  } else {
    fromDate = new Date(now.getFullYear() - yearFilter, now.getMonth(), now.getDate());
    toDate = now;
  }
  let filteredCampaigns = [];
  if (quickFilter === 'all') {
    filteredCampaigns = campaigns.filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(searchKeyword.toLowerCase());
      return matchSearch;
    });
  } else if (quickFilter === 'latest') {
    const latest = campaigns.reduce((max, c) => new Date(c.date) > new Date(max.date) ? c : max, campaigns[0]);
    filteredCampaigns = latest ? [latest] : [];
  } else {
    filteredCampaigns = campaigns.filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(searchKeyword.toLowerCase());
      const campaignDate = new Date(c.date);
      const matchDate = campaignDate >= fromDate && campaignDate <= toDate;
      const matchStatus = filterStatus === "全部狀態" || c.statusName === filterStatus;
      return matchSearch && matchDate && matchStatus;
    });
  }
  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCampaigns = filteredCampaigns.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const statusMap = {
    "尚未開始": 1,
    "進行中": 2,
    "已完成": 3,
    "已取消": 4
  };

  const handleStatusChange = async (campaignId, newStatus) => {
    try {
      const apiStatus = statusMap[newStatus] || newStatus;
      const res = await axios.put(
        `${HEALTH_CHECK_CAMPAIGN_API}/${campaignId}`,
        { statusId: apiStatus }
      );
      console.log("PUT response:", res.data);

      if (res.status === 200) {
        notifySuccess("活動狀態更新成功。");
        const updatedCampaigns = campaigns.map((campaign) =>
          campaign.id === campaignId
            ? { ...campaign, statusName: newStatus }
            : campaign
        );
        setCampaigns(updatedCampaigns);

        // Nếu chuyển từ '尚未開始' sang '進行中', gửi thông báo cho phụ huynh
        if (newStatus === "進行中") {
          // Lấy thông tin campaign vừa cập nhật
          const campaign = updatedCampaigns.find(c => c.id === campaignId);
          if (campaign) {
            await sendNotificationToAll(campaign);
          }
        }
      }
    } catch (error) {
      if (error.response) {
        console.error("API error:", error.response.data);
        notifyError("更新狀態失敗：" + (error.response.data.message || ""));
      } else {
        console.error("Lỗi khi cập nhật trạng thái chiến dịch:", error);
        notifyError("更新狀態失敗。");
      }
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <HealthCheckTour/>
      <main style={{ flex: 1 }}>
        <div className={style.campaignPage}>
          {/* LOADING OVERLAY */}
          {loading && <LoadingOverlay text="資料載入中..." />}
          {/* HEADER */}
          <div className={style.pageHeader}>
            <div>
              <h1>
                <span className={style.textBlack}>健康檢查</span>
                <span className={style.textAccent}>管理</span>
              </h1>
            </div>
          </div>

          {/* FILTERS */}
          <div className={style.filterRow}>
            <div className={style.searchBox}>
              <Search size={16} />
              <input
                id="search-campaign"

                placeholder="搜尋健康檢查活動..."
                value={searchKeyword}
                onChange={e => { setSearchKeyword(e.target.value); setQuickFilter('custom'); setCurrentPage(1); }}
                className={style.inputSearch}
              />
            </div>
            <select
            id="filter-year"
              className={style.filterDropdown}
              value={yearFilter}
              onChange={e => { setYearFilter(Number(e.target.value)); setQuickFilter('custom'); setCurrentPage(1); }}
              style={{ marginRight: 8 }}
            >
              <option value={0}>本年度</option>
              <option value={1}>最近 1 年</option>
              <option value={2}>最近 2 年</option>
              <option value={3}>最近 3 年</option>
            </select>
            <select
            id="filter-status"
              className={style.filterDropdown}
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setQuickFilter('custom'); setCurrentPage(1); }}
              style={{ marginRight: 8 }}
            >
              <option>全部狀態</option>
              <option>進行中</option>
              <option>尚未開始</option>
              <option>已完成</option>
              <option>已取消</option>
            </select>
            <button id="btn-show-all" style={{ background: quickFilter === 'all' ? '#23b7b7' : '#eee', color: quickFilter === 'all' ? '#fff' : '#333', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 500, cursor: 'pointer', marginRight: 8 }} onClick={() => { setQuickFilter('all'); setCurrentPage(1); }}>顯示全部</button>
            <button id="btn-latest" style={{ background: quickFilter === 'latest' ? '#23b7b7' : '#eee', color: quickFilter === 'latest' ? '#fff' : '#333', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setQuickFilter('latest'); setCurrentPage(1); }}>最新建立的活動</button>
          </div>

          {/* TABLE */}
          <div className={style.cardGrid}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', width: '100%' }}>資料載入中...</div>
            ) : currentCampaigns.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', width: '100%' }}>目前沒有健康檢查活動。</div>
            ) : (
              currentCampaigns.map((c) => (
                <div key={c.id} id="card-0" className={style.campaignCard}>
                  <div className={style.cardHeader}>
                    <div className={style.cardTitle}>{c.title}</div>
                  </div>
                  <div className={style.cardBody}>
                    <div><b>日期：</b> {new Date(c.date).toLocaleDateString("zh-TW")}</div>
                    <div><b>說明：</b> {c.description}</div>
                    <div><b>建立者：</b> {c.createdByName}</div>
                  </div>
                  <div className={style.cardFooter}>
                    {c.statusName === "尚未開始" ? (
                      <span className={style.statusBadgeWaiting}>尚未開始</span>
                    ) : c.statusName === "進行中" ? (
                      <span className={style.statusBadgeActive}>進行中</span>
                    ) : c.statusName === "已完成" ? (
                      <span className={style.statusBadgeDone}>已完成</span>
                    ) : (
                      <span className={style.statusBadgeCancel}>已取消</span>
                    )}
                    {c.statusName === "尚未開始" && (
                      <button id="btn-starts" className={style.btnDetail} onClick={() => handleStatusChange(c.id, "進行中")}>開始</button>
                    )}
                    {(c.statusName === "進行中" || c.statusName === "已完成") && (
                      <Link to={`/healthcheck/${c.id}`}>
                        <button id="btn-detail-0" className={style.btnDetail}>查看詳細資料</button>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PAGINATION */}
          <div className={style.pagination}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={style.pageBtn}
            >
              «
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => handlePageChange(i + 1)}
                className={
                  currentPage === i + 1
                    ? `${style.activePage} ${style.pageBtn}`
                    : style.pageBtn
                }
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={style.pageBtn}
            >
              »
            </button>
          </div>
          <Notification />
        </div>
      </main>
    </div>
  );
};

export default HealthCheckList;
