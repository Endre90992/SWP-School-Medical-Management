import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FileSpreadsheet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../../components/sidebar/Sidebar";
import Notification from "../../components/Notification";
import LoadingOverlay from "../../components/LoadingOverlay";
import { notifyError, notifySuccess } from "../../utils/notification";
import style from "../../assets/css/medicalSupplies.module.css";

const API_URL = "http://127.0.0.1:5080/api/MedicalSupplies";

const MedicalSupplies = () => {
  const [supplies, setSupplies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: "", quantity: "", unit: "", expiryDate: "" });
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const itemsPerPage = 5;

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSupplies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, { headers: authHeaders() });
      setSupplies(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error("無法載入醫療物資：", error);
      notifyError("無法載入醫療物資。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSupplies(); }, []);

  const filteredSupplies = useMemo(
    () => supplies.filter((s) => (s.name || "").toLowerCase().includes(searchText.toLowerCase())),
    [supplies, searchText]
  );

  const totalPages = Math.max(1, Math.ceil(filteredSupplies.length / itemsPerPage));
  const paginatedSupplies = filteredSupplies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const top5Supplies = [...supplies].sort((a, b) => Number(b.quantity) - Number(a.quantity)).slice(0, 5);

  const isNearExpiry = (dateStr) => {
    if (!dateStr) return false;
    const daysLeft = (new Date(dateStr) - new Date()) / 86400000;
    return daysLeft <= 30;
  };

  const handleSubmit = async () => {
    setModalLoading(true);
    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? "put" : "post";
      const payload = editingId ? { ...formData, supplyId: editingId } : formData;
      await axios[method](url, payload, { headers: authHeaders() });
      notifySuccess(editingId ? "醫療物資已更新。" : "醫療物資已新增。");
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: "", quantity: "", unit: "", expiryDate: "" });
      await fetchSupplies();
    } catch (error) {
      console.error("儲存醫療物資失敗：", error);
      notifyError("儲存醫療物資失敗。");
    } finally {
      setModalLoading(false);
    }
  };

  const handleExportExcel = () => {
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["名稱", "庫存數量", "單位", "有效期限"],
      ...filteredSupplies.map((item) => [
        item.name,
        item.quantity,
        item.unit,
        item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("zh-TW") : "",
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "醫療物資清單.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={style.wrapper}>
      <Sidebar />
      <div className={style.content}>
        {(loading || modalLoading) && <LoadingOverlay text="資料處理中..." />}
        <div className={style.header}>
          <h2 className={style.title}>醫療物資清單</h2>
          <div className={style.actions}>
            <input
              type="text"
              placeholder="搜尋物資..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              className={style.searchInput}
            />
            <button className={style.exportBtn} onClick={handleExportExcel}>
              <FileSpreadsheet size={18} style={{ marginRight: 6 }} />匯出 CSV（Excel 可開啟）
            </button>
            <button
              className={style.addButton}
              onClick={() => {
                setEditingId(null);
                setFormData({ name: "", quantity: "", unit: "", expiryDate: "" });
                setShowModal(true);
              }}
            >
              + 新增物資
            </button>
          </div>
        </div>

        <table className={style.table}>
          <thead>
            <tr>
              <th>物資名稱</th>
              <th>數量</th>
              <th>單位</th>
              <th>有效期限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && paginatedSupplies.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: "center" }}>目前沒有醫療物資資料</td></tr>
            ) : (
              paginatedSupplies.map((item) => (
                <tr key={item.supplyID ?? item.supplyId} className={style.tableRow}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td style={{ color: isNearExpiry(item.expiryDate) ? "red" : "#333", fontWeight: isNearExpiry(item.expiryDate) ? "bold" : "normal" }}>
                    {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td>
                    <button
                      className={style.editBtn}
                      onClick={() => {
                        setFormData({
                          name: item.name || "",
                          quantity: item.quantity ?? "",
                          unit: item.unit || "",
                          expiryDate: item.expiryDate?.slice?.(0, 10) || item.expiryDate || "",
                        });
                        setEditingId(item.supplyID ?? item.supplyId);
                        setShowModal(true);
                      }}
                    >
                      編輯
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className={style.pagination}>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={currentPage === i + 1 ? style.activePage : ""}>
                {i + 1}
              </button>
            ))}
          </div>
        )}

        <div className={style.chartBox}>
          <h3>庫存量較高的前 5 項物資</h3>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={top5Supplies}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantity" fill="#20b2aa" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {showModal && (
          <div className={style.modalOverlay}>
            <div className={style.modal}>
              <h3>{editingId ? "編輯醫療物資" : "新增醫療物資"}</h3>
              <input name="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="物資名稱" />
              <input name="quantity" type="number" min="0" value={formData.quantity} onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))} placeholder="數量" />
              <input name="unit" value={formData.unit} onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))} placeholder="單位，例如：片、包、瓶" />
              <input name="expiryDate" type="date" value={formData.expiryDate} onChange={(e) => setFormData((p) => ({ ...p, expiryDate: e.target.value }))} />
              <div className={style.modalActions}>
                <button onClick={handleSubmit}>{editingId ? "儲存變更" : "新增"}</button>
                <button onClick={() => setShowModal(false)}>取消</button>
              </div>
            </div>
          </div>
        )}
        <Notification />
      </div>
    </div>
  );
};

export default MedicalSupplies;
