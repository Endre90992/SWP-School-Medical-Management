import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Notification from "../../components/Notification";
import LoadingOverlay from "../../components/LoadingOverlay";
import style from "../../assets/css/studentList.module.css";

const API_URL = "http://127.0.0.1:5080/api/Student";

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: "studentId", direction: "ascending" });
  const studentsPerPage = 13;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(API_URL, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setStudents(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch (error) {
        console.error("無法載入學生資料：", error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const classOptions = useMemo(
    () => [...new Set(students.map((s) => s.className).filter(Boolean))].sort(),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    let result = students.filter((student) => {
      if (classFilter && student.className !== classFilter) return false;
      if (!keyword) return true;
      return [student.fullName, student.studentId, student.className, student.parentName]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });

    return [...result].sort((a, b) => {
      let aValue = a[sortConfig.key] ?? "";
      let bValue = b[sortConfig.key] ?? "";
      if (sortConfig.key === "studentId") {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }
      if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [students, searchTerm, classFilter, sortConfig]);

  useEffect(() => setCurrentPage(1), [searchTerm, classFilter]);

  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  };

  const sortIndicator = (key) =>
    sortConfig.key === key
      ? sortConfig.direction === "ascending"
        ? " ▲"
        : " ▼"
      : "";

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage));
  const start = (currentPage - 1) * studentsPerPage;
  const currentStudents = filteredStudents.slice(start, start + studentsPerPage);

  return (
    <div className={style.layoutContainer}>
      <Sidebar />
      <main className={style.layoutContent}>
        <header className={style.dashboardHeaderBar}>
          <div className={style.titleGroup}>
            <h1>
              <span className={style.textBlack}>學生</span>
              <span className={style.textAccent}> 名單</span>
            </h1>
          </div>
        </header>

        <div className={style.header} style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            type="text"
            placeholder="搜尋姓名、學生編號、班級或家長..."
            className={style.searchBar}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: 280, maxWidth: 380 }}
          />
          <select
            className={style.classFilter}
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">全部班級</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </div>

        <table className={style.studentTable}>
          <thead>
            <tr>
              <th>序號</th>
              <th onClick={() => requestSort("studentId")} className={style.sortableHeader}>
                學生編號{sortIndicator("studentId")}
              </th>
              <th onClick={() => requestSort("fullName")} className={style.sortableHeader}>
                姓名{sortIndicator("fullName")}
              </th>
              <th onClick={() => requestSort("className")} className={style.sortableHeader}>
                班級{sortIndicator("className")}
              </th>
              <th>家長／聯絡人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, row) => (
                <tr key={row} className={style.skeletonRow}>
                  {Array.from({ length: 6 }).map((__, col) => (
                    <td key={col}><div className={style.skeletonCell} /></td>
                  ))}
                </tr>
              ))
            ) : currentStudents.length ? (
              currentStudents.map((student, index) => (
                <tr key={student.studentId} className={style.studentRow}>
                  <td>{start + index + 1}</td>
                  <td>{student.studentId}</td>
                  <td>{student.fullName}</td>
                  <td>{student.className || "—"}</td>
                  <td>{student.parentName || "—"}</td>
                  <td>
                    <button className={style.btn} onClick={() => navigate(`/students/${student.studentId}`)}>
                      查看詳細資料
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" style={{ textAlign: "center" }}>目前沒有符合條件的學生資料</td></tr>
            )}
          </tbody>
        </table>

        {loading && <LoadingOverlay text="資料載入中..." />}

        {totalPages > 1 && (
          <div className={style.pagination}>
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index + 1}
                onClick={() => setCurrentPage(index + 1)}
                className={currentPage === index + 1 ? style.activePage : ""}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
      </main>
      <Notification />
    </div>
  );
};

export default StudentList;
