import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import blogStyle from "../../assets/css/Blog.module.css";
import style from "../../assets/css/homepage.module.css";
import logo from "../../assets/icon/eduhealth.jpg";
import UserMenu from "../../components/UserMenu";

const API_URL = "http://127.0.0.1:5080/api/BlogPost";
const PAGE_SIZE = 5;

const BlogPublic = () => {
  const [blogs, setBlogs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBlogs = async () => {
      setLoading(true);
      try {
        const res = await axios.get(API_URL);
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];
        setBlogs(
          list
            .filter((blog) => blog.isActive !== false)
            .sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate))
        );
      } catch (error) {
        console.error("無法載入健康資訊：", error);
        setBlogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBlogs();
  }, []);

  const filtered = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return blogs;
    return blogs.filter((blog) =>
      [blog.title, blog.content, blog.authorName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [blogs, searchText]);

  useEffect(() => setCurrentPage(1), [searchText]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div style={{ background: "#f8fafb", minHeight: "100vh" }}>
      <header className={style.navbar}>
        <div className={style.logo}>
          <img src={logo} alt="EduHealth" className={style.logoImg} />
        </div>
        <nav className={style.navLinks}>
          <a href="/" className={style.navLink} onClick={(event) => { event.preventDefault(); navigate("/"); }}>
            首頁
          </a>
          <a href="/blog" className={style.navLink} onClick={(event) => event.preventDefault()}>
            健康資訊
          </a>
          {localStorage.getItem("token") ? (
            <UserMenu />
          ) : (
            <button className={style.loginBtn} onClick={() => navigate("/login")}>
              登入
            </button>
          )}
        </nav>
      </header>

      <div className={blogStyle.headerBlog} style={{ marginTop: 0, borderRadius: 0 }}>
        <div className={blogStyle.headerContent} style={{ margin: "0 auto", textAlign: "center" }}>
          <h1 className={blogStyle.titleBlog} style={{ fontSize: "2.5rem" }}>
            校園健康資訊
          </h1>
          <p className={blogStyle.descBlog} style={{ fontSize: "1.15rem" }}>
            本頁內容儲存在本機資料庫，不會從外部網站載入。
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 48px" }}>
        <div style={{ display: "flex", justifyContent: "center", margin: "32px 0 18px" }}>
          <div style={{ position: "relative", width: "min(100%, 420px)" }}>
            <SearchOutlined
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#20b2aa",
                fontSize: 20,
                zIndex: 2,
              }}
            />
            <input
              className={blogStyle.blogSearch}
              style={{ paddingLeft: 38, width: "100%" }}
              placeholder="搜尋健康資訊..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>

        <div className={blogStyle.blogListSection}>
          {loading && (
            <div style={{ textAlign: "center", color: "#888", margin: "32px 0" }}>
              資料載入中...
            </div>
          )}

          {!loading && pageItems.length === 0 && (
            <div style={{ textAlign: "center", color: "#888", margin: "32px 0" }}>
              目前沒有符合條件的健康資訊。
            </div>
          )}

          {pageItems.map((blog) => {
            const isExpanded = Boolean(expanded[blog.postId]);
            const content = String(blog.content || "");
            return (
              <article className={blogStyle.blogCard} key={blog.postId}>
                <div className={blogStyle.blogCardContent}>
                  <div className={blogStyle.blogMetaRow}>
                    <span className={blogStyle.blogAuthor}>
                      {blog.authorName || "健康中心"}
                    </span>
                    <span className={blogStyle.blogDate} style={{ marginLeft: 16 }}>
                      {blog.postedDate
                        ? new Date(blog.postedDate).toLocaleDateString("zh-TW")
                        : ""}
                    </span>
                  </div>
                  <h2 className={blogStyle.blogTitle}>{blog.title}</h2>
                  <div className={blogStyle.blogDesc} style={{ whiteSpace: "pre-wrap" }}>
                    {isExpanded || content.length <= 180
                      ? content
                      : content.slice(0, 180) + "..."}
                  </div>
                  {content.length > 180 && (
                    <div style={{ textAlign: "right", marginTop: 8 }}>
                      <button
                        className={blogStyle.blogDetailLink}
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [blog.postId]: !isExpanded,
                          }))
                        }
                      >
                        {isExpanded ? "收合" : "閱讀全文"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {totalPages > 1 && (
            <div style={{ textAlign: "center", margin: "24px 0" }}>
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index + 1}
                  onClick={() => setCurrentPage(index + 1)}
                  style={{
                    margin: "0 4px",
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid #20b2aa",
                    background: currentPage === index + 1 ? "#20b2aa" : "#fff",
                    color: currentPage === index + 1 ? "#fff" : "#20b2aa",
                    cursor: "pointer",
                  }}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogPublic;
