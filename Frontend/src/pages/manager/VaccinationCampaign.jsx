import React, { useEffect, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import style from "../../components/sb-Manager/MainLayout.module.css";
import campaignStyle from "../../assets/css/VaccinationCampaign.module.css";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Spin,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { Edit2, Trash2, Plus } from "lucide-react";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";

const VACCINATION_CAMPAIGN_API =
  "http://127.0.0.1:5080/api/VaccinationCampaign/campaigns";

// 儲存變更 lại các trạng thái phù hợp với backend
const statusOptions = [
  { value: 1, label: "尚未開始" },
  { value: 2, label: "進行中" },
  { value: 3, label: "已完成" },
  { value: 4, label: "已取消" },
];

const getCurrentUserId = () => localStorage.getItem("userId") || "";

const VaccinationCampaign = () => {
  const [quickFilter, setQuickFilter] = useState("all"); // 'all', 'latest', 'custom'
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const campaignsPerPage = 8;
  // Bộ lọc thời gian và trạng thái
  // yearFilter: 0 = năm hiện tại, 1 = 最近 1 年, 2 = 最近 2 年, 3 = 最近 3 年
  const [yearFilter, setYearFilter] = useState(1);
  const [statusFilter, setStatusFilter] = useState(0); // 0: tất cả

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await axios.get(VACCINATION_CAMPAIGN_API);
      // API trả về { status, message, data: [...] }
      setCampaigns(res.data.data || []);
    } catch {
      notifyError("無法載入接種活動清單。");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Chỉ hiển thị các chiến dịch chưa bị huỷ (statusId !== 4)
  const activeCampaigns = campaigns.filter((c) => c.statusId !== 4);

  // Lọc và phân trang
  // Tính mốc thời gian
  const now = dayjs();
  let fromDate, toDate;
  if (yearFilter === 0) {
    // 本年度
    fromDate = now.startOf("year");
    toDate = now.endOf("year");
  } else {
    fromDate = now.subtract(yearFilter, "year").startOf("day");
    toDate = now;
  }
  // Lọc theo search, thời gian, trạng thái
  let filteredCampaigns = [];
  if (quickFilter === "all") {
    filteredCampaigns = activeCampaigns.filter((c) => {
      const matchSearch =
        c.vaccineName.toLowerCase().includes(searchText.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchText.toLowerCase());
      return matchSearch;
    });
  } else if (quickFilter === "latest") {
    // 最新建立的活動: lấy campaign có id lớn nhất
    const latest = activeCampaigns.reduce(
      (max, c) => (Number(c.campaignId) > Number(max.campaignId) ? c : max),
      activeCampaigns[0]
    );
    filteredCampaigns = latest ? [latest] : [];
  } else {
    filteredCampaigns = activeCampaigns.filter((c) => {
      const matchSearch =
        c.vaccineName.toLowerCase().includes(searchText.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchText.toLowerCase());
      const campaignDate = dayjs(c.date);
      const matchDate =
        campaignDate.isAfter(fromDate) && campaignDate.isBefore(toDate);
      const matchStatus = statusFilter === 0 || c.statusId === statusFilter;
      return matchSearch && matchDate && matchStatus;
    });
  }
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * campaignsPerPage,
    currentPage * campaignsPerPage
  );

  // CRUD Handlers
  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ createdBy: getCurrentUserId() });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      date: record.date ? dayjs(record.date) : null,
      statusId: record.statusId,
      createdBy: record.createdBy,
    });
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (editing) {
        const putData = {
          vaccineName: values.vaccineName,
          date: values.date
            ? dayjs(values.date).format("YYYY-MM-DD")
            : undefined,
          description: values.description,
          createdBy: getCurrentUserId(),
          statusId: Number(values.statusId),
          campaignId: editing.campaignId,
        };
        await axios.put(VACCINATION_CAMPAIGN_API, putData);
        notifySuccess("接種活動已更新。");
      } else {
        const postData = {
          vaccineName: values.vaccineName,
          date: values.date
            ? dayjs(values.date).format("YYYY-MM-DD")
            : undefined,
          description: values.description,
          createdBy: getCurrentUserId(),
          statusId: 1, // Luôn là "尚未開始"
        };
        await axios.post(VACCINATION_CAMPAIGN_API, postData);
        notifySuccess("接種活動已新增。");
      }
      setModalOpen(false);
      fetchCampaigns();
    } catch {
      // Validation error
    } finally {
      setLoading(false);
    }
  };

  // Hàm deactivate (chuyển statusId thành 4 - 已取消)
  const handleDeactivate = async (id) => {
    Modal.confirm({
      title: "確定要取消這個接種活動嗎？",
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        setLoading(true);
        try {
          await axios.put(`${VACCINATION_CAMPAIGN_API}/${id}/deactivate`, {}); // backend sẽ chuyển statusId thành 4
          notifySuccess("已取消 chiến dịch!");
          fetchCampaigns();
        } catch {
          notifyError("取消接種活動失敗。");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Hàm activate (chuyển statusId thành 2 - 進行中)
  const handleActivate = async (id) => {
    Modal.confirm({
      title: "確定要重新啟用這個接種活動嗎？",
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        setLoading(true);
        try {
          await axios.put(`${VACCINATION_CAMPAIGN_API}/${id}/activate`, {}); // backend sẽ chuyển statusId thành 2
          notifySuccess("接種活動已重新啟用。");
          fetchCampaigns();
        } catch {
          notifyError("重新啟用失敗。");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div className={style.layoutContainer}>
      <Sidebar />
      <main className={style.layoutContent}>
        <header className={campaignStyle.dashboardHeaderBar}>
          <div className={campaignStyle.titleGroup}>
            <h1>
              <span className={campaignStyle.textBlack}>預防接種</span>
              <span className={campaignStyle.textAccent}>
                {" "}
                活動清單
              </span>
            </h1>
          </div>
        </header>
        <div className={campaignStyle.header}>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <input
              type="text"
              placeholder="搜尋接種活動..."
              className={campaignStyle.searchBar}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setQuickFilter("custom");
              }}
              onFocus={(e) => (e.target.style.borderColor = "#1890ff")}
              onBlur={(e) => (e.target.style.borderColor = "#23b7b7")}
            />
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(Number(e.target.value));
                setQuickFilter("custom");
              }}
              style={{
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 16,
                background: "#f9fefe",
                marginRight: 8,
              }}
            >
              <option value={0}>本年度</option>
              <option value={1}>最近 1 年</option>
              <option value={2}>最近 2 年</option>
              <option value={3}>最近 3 年</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(Number(e.target.value));
                setQuickFilter("custom");
              }}
              style={{
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 16,
                background: "#f9fefe",
                marginRight: 8,
              }}
            >
              <option value={0}>全部狀態</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button className={campaignStyle.addBtn} onClick={handleCreate}>
              <Plus size={16} style={{ marginRight: 6, marginBottom: -2 }} />{" "}
              新增接種活動
            </button>
            <button
              className={campaignStyle.addBtn}
              style={{
                background: quickFilter === "all" ? "#23b7b7" : "#eee",
                color: quickFilter === "all" ? "#fff" : "#333",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={() => setQuickFilter("all")}
            >
              顯示全部
            </button>
            <button
              className={campaignStyle.addBtn}
              style={{
                background: quickFilter === "latest" ? "#23b7b7" : "#eee",
                color: quickFilter === "latest" ? "#fff" : "#333",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={() => setQuickFilter("latest")}
            >
              最新建立的活動
            </button>
          </div>
        </div>
        <table className={campaignStyle.studentTable}>
          <thead>
            <tr>
              <th>STT</th>
              <th>疫苗名稱</th>
              <th>接種日期</th>
              <th>說明</th>
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
                    <td key={cidx}>
                      <div className={campaignStyle.skeletonCell}></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedCampaigns.length > 0 ? (
              paginatedCampaigns.map((c, idx) => (
                <tr key={c.campaignId}>
                  <td>{(currentPage - 1) * campaignsPerPage + idx + 1}</td>
                  <td>{c.vaccineName}</td>
                  <td>{c.date}</td>
                  <td>{c.description}</td>
                  <td>{c.createdByName}</td>
                  <td>{c.statusName}</td>
                  <td>
                    <div className={campaignStyle.actionGroup}>
                      <button
                        className={campaignStyle.editBtn}
                        onClick={() => handleEdit(c)}
                      >
                        <Edit2 size={16} /> 編輯
                      </button>
                      {c.statusId === 2 && (
                        <button
                          className={campaignStyle.deleteBtn}
                          onClick={() => handleDeactivate(c.campaignId)}
                        >
                          <Trash2 size={16} /> 取消
                        </button>
                      )}
                      {c.statusId === 3 && (
                        <button
                          className={campaignStyle.editBtn}
                          onClick={() => handleActivate(c.campaignId)}
                        >
                          <Plus size={16} /> 重新啟用
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center" }}>
                  目前沒有接種活動資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={campaignStyle.pagination}>
          {[
            ...Array(Math.ceil(filteredCampaigns.length / campaignsPerPage)),
          ].map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index + 1)}
              className={
                currentPage === index + 1 ? campaignStyle.activePage : ""
              }
            >
              {index + 1}
            </button>
          ))}
        </div>
        <Modal
          title={editing ? "編輯接種活動" : "新增接種活動 mới"}
          open={modalOpen}
          onOk={handleModalOk}
          onCancel={() => setModalOpen(false)}
          okText={editing ? "儲存變更" : "新增"}
          cancelText="取消"
          className={campaignStyle.modalForm}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="vaccineName"
              label="疫苗名稱"
              rules={[
                { required: true, message: "請輸入疫苗名稱" },
                {
                  whitespace: true,
                  message: "疫苗名稱 không được để trống!",
                },
              ]}
            >
              <Input autoComplete="off" className={campaignStyle.input} />
            </Form.Item>
            <Form.Item
              name="date"
              label="接種日期"
              rules={[{ required: true, message: "請選擇日期" }]}
            >
            <DatePicker
                style={{ width: "100%" }}
                format="YYYY-MM-DD"
                className={campaignStyle.input}
              />
            </Form.Item>
            <Form.Item
              name="description"
              label="說明"
              rules={[{ required: true, message: "請輸入活動說明" }]}
            >
              <Input.TextArea rows={3} className={campaignStyle.input} />
            </Form.Item>
            <Form.Item name="createdBy" style={{ display: "none" }}>
              <Input />
            </Form.Item>
            {editing && (
              <Form.Item
                name="statusId"
                label="狀態"
                rules={[{ required: true, message: "請選擇狀態" }]}
              >
                <Select
                  value={form.getFieldValue("statusId")}
                  getPopupContainer={(trigger) => trigger.parentNode}
                  disabled={editing && editing.statusId === 4}
                  className={
                    campaignStyle.input + " " + campaignStyle.selectCustom
                  }
                  dropdownStyle={{
                    borderRadius: 12,
                    boxShadow: "0 4px 24px #23b7b71a",
                    padding: 0,
                  }}
                  size="large"
                  placeholder="請選擇狀態 chiến dịch"
                  style={{
                    borderRadius: 12,
                    fontSize: 16,
                    background: "#f9fefe",
                    minHeight: 44,
                    boxShadow: "0 2px 12px #23b7b71a",
                    transition: "border-color 0.2s",
                  }}
                  notFoundContent={
                    <span style={{ color: "#888" }}>無狀態資料</span>
                  }
                >
                  {statusOptions
                    .filter((opt) => opt.value !== 1 || editing.statusId === 1)
                    .map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>
            )}
          </Form>
        </Modal>
        {loading && <LoadingOverlay text="資料載入中..." />}
        <Notification />
      </main>
    </div>
  );
};

export default VaccinationCampaign;
