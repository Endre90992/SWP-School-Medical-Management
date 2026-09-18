import React, { useState, useEffect } from "react";
import Sidebar from "../../components/sb-Manager/Sidebar";
import style from "../../components/sb-Manager/MainLayout.module.css";
import blogStyle from "../../assets/css/Blog.module.css";
import axios from "axios";

import { message, Spin } from "antd";

import { Spin } from "antd";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";

import { useNavigate } from "react-router-dom";


function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const apiUrl = "http://127.0.0.1:5080/api/BlogPost";

const BlogCreate = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || !role) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const id = getQueryParam('id');
    if (id && id !== 'undefined') {
      setEditId(id);
      setLoading(true);
      axios.get(`${apiUrl}/${id}`)
        .then(res => {
          const blog = res.data;
          setTitle(blog.title);
          setContent(blog.content);
        })
        .catch(() => notifyError('無法載入文章資料。'))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const authorId = localStorage.getItem('userId') || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const postedDate = new Date().toISOString().slice(0, 10);
    try {
      if (editId && editId !== 'undefined') {
        await axios.put(`${apiUrl}/${editId}`, {
          title,
          content,
          isActive: true
        });
        notifySuccess('文章更新成功。');
      } else {
        await axios.post(apiUrl, {
          title,
          content,
          authorId,
          postedDate,
          isActive: true
        });
        notifySuccess('文章新增成功。');
      }

    } catch {
      notifyError('儲存文章失敗。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={style.layoutContainer}>
      <Sidebar />
      <main className={style.layoutContent}>
        <header className={blogStyle.dashboardHeaderBar}>
          <div className={blogStyle.titleGroup}>
            <h1>
              <span className={blogStyle.textBlack}>{editId ? "編輯" : "新增"}</span>
              <span className={blogStyle.textAccent}>健康資訊</span>
            </h1>
          </div>
          <button
            type="button"
            className={blogStyle.backBtn}

          >
            ← 返回健康資訊管理
          </button>
        </header>
        {loading && <LoadingOverlay text="資料載入中..." />}
        <Spin spinning={loading} tip={editId ? "儲存中..." : "建立中..."}>
        <form className={blogStyle.blogForm} onSubmit={handleSubmit}>
          <div className={blogStyle.formGroup}>
            <label>文章標題</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className={blogStyle.input}
            />
          </div>
          <div className={blogStyle.formGroup}>
            <label>內容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              required
              rows={8}
              className={blogStyle.input}
            />
          </div>
          <button type="submit" className={blogStyle.createBtn} style={{marginTop: 16}} disabled={loading}>
            {loading ? (editId ? '儲存中...' : '建立中...') : (editId ? "儲存變更" : "新增 bài viết")}
          </button>
        </form>
        </Spin>
        <Notification />
      </main>
    </div>
  );
};

export default BlogCreate;
