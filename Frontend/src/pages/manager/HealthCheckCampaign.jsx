import React, { useEffect, useState } from "react";
import axios from "axios";
import campaignStyle from "../../assets/css/HealthCheckCampaign.module.css";
import Sidebar from "../../components/sidebar/Sidebar";
import { Modal, Form as AntForm, Input, DatePicker } from "antd";
import dayjs from "dayjs";
import { Plus, Edit2, Trash2 } from "lucide-react";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";
import { ExclamationCircleOutlined } from "@ant-design/icons";
// import { Modal } from "antd";

const API_BASE = "/api";
const PAGE_SIZE = 10;
const statusOptions = [
  { value: 1, label: "尚未開始" },
  { value: 2, label: "進行中" },
  { value: 3, label: "已完成" },
  { value: 4, label: "已取消" },
];

const HealthCheckCampaign = () => {
  // Bộ lọc thời gian và trạng thái
  // yearFilter: 0 = năm hiện tại, 1 = 最近 1 年, 2 = 最近 2 年, 3 = 最近 3 年
  const [yearFilter, setYearFilter] = useState(1);
  const [statusFilter, setStatusFilter] = useState(0); // 0: tất cả
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'latest', 'custom'
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pendingCampaign, setPendingCampaign] = useState(null);
  const [formAntd] = AntForm.useForm();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      // Chuyển hướng về trang đăng nhập nếu không có token
      window.location.href = "/login";
      return;
    }
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/HealthCheckCampaign`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      console.log("API Response Data:", res.data);
      console.log("Type of API Response Data:", typeof res.data);

      let campaignData = res.data;
      if (typeof campaignData === "string") {
        try {
          campaignData = JSON.parse(campaignData);
        } catch (e) {
          console.error("Failed to parse response data:", e);
          setCampaigns([]);
          setLoading(false);
          return;
        }
      }

      if (
        campaignData &&
        campaignData["$values"] &&
        Array.isArray(campaignData["$values"])
      ) {
        campaignData = campaignData["$values"];
      }

      if (Array.isArray(campaignData)) {
        setCampaigns(campaignData);
      } else if (campaignData && Array.isArray(campaignData.data)) {
        setCampaigns(campaignData.data);
      } else {
        console.warn("API response is not a recognized array format:", campaignData);
        setCampaigns([]);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        notifyError("登入已逾時，請重新登入。");
        localStorage.removeItem("token");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
      } else {
        notifyError("無法載入健康檢查活動。");
      }
      setCampaigns([]);
    }
    setLoading(false);
  };

  const openModal = (campaign = null) => {
    setPendingCampaign(campaign);
    setShowModal(true);
  };

  useEffect(() => {
    if (showModal) {
      if (pendingCampaign) {
        formAntd.setFieldsValue({
          title: pendingCampaign.title || "",
          description: pendingCampaign.description || "",
          date: pendingCampaign.date ? dayjs(pendingCampaign.date) : null,
          statusId: pendingCampaign.statusId || 1,
        });
      } else {
        formAntd.resetFields();
      }
    }
    // eslint-disable-next-line
  }, [showModal, pendingCampaign]);

  const getCurrentUserId = () => localStorage.getItem("userId") || "";

  const handleSubmit = async () => {
    try {
      const values = await formAntd.validateFields();
      let dateValue = values.date;
      if (!dateValue) {
        formAntd.setFields([{ name: "date", errors: ["請選擇日期。"] }]);
        return;
      }
      if (typeof dateValue === "string") {
        dateValue = dayjs(dateValue);
      }
      if (!dayjs(dateValue).isValid()) {
        formAntd.setFields([{ name: "date", errors: ["日期無效。"] }]);
        return;
      }
      let payload = {
        title: values.title,
        description: values.description,
        date: dayjs(dateValue).format("YYYY-MM-DD"),
        createdBy: getCurrentUserId(),
        statusId: Number(values.statusId),
      };
      if (pendingCampaign) {
        await axios.put(
          `${API_BASE}/HealthCheckCampaign/${pendingCampaign.campaignId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        notifySuccess("更新成功。");
      } else {
        await axios.post(`${API_BASE}/HealthCheckCampaign`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        notifySuccess("新增成功。");
      }
      setShowModal(false);
      fetchCampaigns();
    } catch {
      // Không cần message.error ở đây vì AntD Form đã hiển thị lỗi
    }
  };

  const handleDelete = async (id) => {
  Modal.confirm({
    title: "確定要刪除此健康檢查活動嗎？",
    icon: <ExclamationCircleOutlined />,
    okText: "刪除",
    cancelText: "取消",
    async onOk() {
      try {
        await axios.delete(`${API_BASE}/HealthCheckCampaign/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        notifySuccess("刪除成功。");
        fetchCampaigns();
      } catch {
        notifyError("刪除失敗。");
      }
    },
  });
};

  // Search + Pagination logic
  // Tính mốc thời gian
  const now = dayjs();
  let fromDate, toDate;
  if (yearFilter === 0) {
    fromDate = now.startOf('year');
    toDate = now.endOf('year');
  } else {
    fromDate = now.subtract(yearFilter, 'year').startOf('day');
    toDate = now;
  }
  let filteredCampaigns = [];
  if (quickFilter === 'all') {
    filteredCampaigns = campaigns.filter((c) => {
      const matchSearch = c.title?.toLowerCase().includes(searchText.toLowerCase()) || c.description?.toLowerCase().includes(searchText.toLowerCase());
      return matchSearch;
    });
  } else if (quickFilter === 'latest') {
    const latest = campaigns.reduce((max, c) => dayjs(c.date).isAfter(dayjs(max.date)) ? c : max, campaigns[0]);
    filteredCampaigns = latest ? [latest] : [];
  } else {
    filteredCampaigns = campaigns.filter((c) => {
      const matchSearch = c.title?.toLowerCase().includes(searchText.toLowerCase()) || c.description?.toLowerCase().includes(searchText.toLowerCase());
      const campaignDate = dayjs(c.date);
      const matchDate = campaignDate.isAfter(fromDate) && campaignDate.isBefore(toDate);
      const matchStatus = statusFilter === 0 || c.statusId === statusFilter;
      return matchSearch && matchDate && matchStatus;
    });
  }
  const totalPage = Math.ceil(filteredCampaigns.length / PAGE_SIZE);
  const pagedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className={campaignStyle.layoutContainer}>
      <Sidebar />
      <main className={campaignStyle.layoutContent}>
        <header className={campaignStyle.dashboardHeaderBar}>
          <div className={campaignStyle.titleGroup}>
            <h1>
              <span className={campaignStyle.textBlack}>健康檢查</span>
              <span className={campaignStyle.textAccent}>
                {" "}
                活動清單
              </span>
            </h1>
          </div>
        </header>
        <div className={campaignStyle.header}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="搜尋健康檢查活動..."
              className={campaignStyle.searchBar}
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setQuickFilter('custom'); setCurrentPage(1); }}
              style={{
                border: '2px solid #23b7b7',
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 16,
                outline: 'none',
                boxShadow: '0 2px 12px #23b7b71a',
                background: '#f9fefe',
                transition: 'border-color 0.2s',
                marginRight: 8,
                width: 220,
                maxWidth: '100%',
              }}
              onFocus={e => e.target.style.borderColor = '#1890ff'}
              onBlur={e => e.target.style.borderColor = '#23b7b7'}
            />
            <select value={yearFilter} onChange={e => { setYearFilter(Number(e.target.value)); setQuickFilter('custom'); setCurrentPage(1); }} style={{ border: '2px solid #23b7b7', borderRadius: 12, padding: '8px 12px', fontSize: 16, background: '#f9fefe', marginRight: 8 }}>
              <option value={0}>本年度</option>
              <option value={1}>最近 1 年</option>
              <option value={2}>最近 2 年</option>
              <option value={3}>最近 3 年</option>
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(Number(e.target.value)); setQuickFilter('custom'); setCurrentPage(1); }} style={{ border: '2px solid #23b7b7', borderRadius: 12, padding: '8px 12px', fontSize: 16, background: '#f9fefe', marginRight: 8 }}>
              <option value={0}>全部狀態</option>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button className={campaignStyle.addBtn} onClick={() => openModal()}>
              <Plus size={16} style={{ marginRight: 6, marginBottom: -2 }} /> 新增健康檢查活動
            </button>
            <button className={campaignStyle.addBtn} style={{ background: quickFilter === 'all' ? '#23b7b7' : '#eee', color: quickFilter === 'all' ? '#fff' : '#333', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setQuickFilter('all'); setCurrentPage(1); }}>顯示全部</button>
            <button className={campaignStyle.addBtn} style={{ background: quickFilter === 'latest' ? '#23b7b7' : '#eee', color: quickFilter === 'latest' ? '#fff' : '#333', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setQuickFilter('latest'); setCurrentPage(1); }}>最新建立的活動</button>
          </div>
        </div>
        <div className={campaignStyle.table}>
          <table className={campaignStyle.studentTable}>
            <thead>
              <tr>
                <th>STT</th>
                <th>活動名稱</th>
                <th>說明</th>
                <th>檢查日期</th>
                <th>建立者</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className={campaignStyle.skeletonRow}>
                    {Array.from({ length: 7 }).map((_, cidx) => (
                      <td key={cidx}><div className={campaignStyle.skeletonCell}></div></td>
                    ))}
                  </tr>
                ))
              ) : pagedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    目前沒有資料
                  </td>
                </tr>
              ) : (
                pagedCampaigns.map((c, idx) => (
                  <tr key={c.campaignId}>
                    <td>{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>{c.title}</td>
                    <td>{c.description}</td>
                    <td>{c.date ? dayjs(c.date).format("YYYY-MM-DD") : ""}</td>
                    <td>{c.createdByName}</td>
                    <td>{c.statusName}</td>
                    <td>
                      <div className={campaignStyle.actionGroup}>
                        <button
                          className={campaignStyle.editBtn}
                          onClick={() => openModal(c)}
                        >
                          <Edit2 size={16} style={{ marginRight: 4 }} /> 編輯
                        </button>
                        <button
                          className={campaignStyle.deleteBtn}
                          onClick={() => handleDelete(c.campaignId)}
                        >
                          <Trash2 size={16} style={{ marginRight: 4 }} /> 刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination ngoài table */}
        <div className={campaignStyle.pagination}>
          {totalPage > 1 ? (
            Array.from({ length: totalPage }, (_, i) => (
              <button
                key={i}
                className={
                  i + 1 === currentPage ? campaignStyle.activePage : ""
                }
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))
          ) : (
            <button className={campaignStyle.activePage}>1</button>
          )}
        </div>
        <Modal
          open={showModal}
          title={pendingCampaign ? "編輯健康檢查活動" : "新增健康檢查活動"}
          onCancel={() => {
            setShowModal(false);
            setPendingCampaign(null);
          }}
          onOk={handleSubmit}
          okText={pendingCampaign ? "儲存" : "新增"}
          cancelText="取消"
          className={campaignStyle.modalForm}
        >
          <AntForm
            form={formAntd}
            layout="vertical"
            preserve={false}
            initialValues={{}}
          >
            <AntForm.Item
              name="title"
              label="活動名稱"
              rules={[{ required: true, message: "請輸入活動名稱。" }]}
            >
              <Input className={campaignStyle.input} />
            </AntForm.Item>
            <AntForm.Item
              name="description"
              label="說明"
              rules={[{ required: true, message: "請輸入活動說明。" }]}
            >
              <Input.TextArea rows={3} className={campaignStyle.input} />
            </AntForm.Item>
            <AntForm.Item
              name="date"
              label="檢查日期"
              rules={[{ required: true, message: "請選擇日期。" }]}
            >
              <DatePicker
                style={{ width: "100%" }}
                format="YYYY-MM-DD"
                disabledDate={(current) =>
                  current && current < dayjs().startOf("day")
                }
                className={campaignStyle.input}
              />
            </AntForm.Item>
            {/* Bỏ dòng chọn trạng thái khi tạo mới chiến dịch */}
            {pendingCampaign && (
              <AntForm.Item
                name="statusId"
                label="狀態"
                rules={[
                  { required: true, message: "請選擇狀態。" },
                ]}
              >
                <select
                  className={campaignStyle.input}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    minHeight: 44,
                    fontSize: 16,
                  }}
                  value={formAntd.getFieldValue("statusId")}
                  onChange={(e) =>
                    formAntd.setFieldsValue({
                      statusId: Number(e.target.value),
                    })
                  }
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </AntForm.Item>
            )}
          </AntForm>
        </Modal>
        {loading && <LoadingOverlay text="資料載入中..." />}
        <Notification />
      </main>
    </div>
  );
};

export default HealthCheckCampaign;
