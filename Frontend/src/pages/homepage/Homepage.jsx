import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import style from "../../assets/css/homepage.module.css";
import logo from "../../assets/icon/eduhealth.jpg";
import nurseLogo from "../../assets/icon/nurse.png";
import healthLogo from "../../assets/icon/healthcheck.png";
import statisticLogo from "../../assets/icon/statistic.png";
import reportLogo from "../../assets/icon/report.png";
import notifyLogo from "../../assets/icon/notify.png";
import vacxinLogo from "../../assets/icon/vacxin.png";
import school1 from "../../assets/img/school1.jpeg";
import school2 from "../../assets/img/school2.jpeg";
import school3 from "../../assets/img/school3.jpeg";
import UserMenu from "../../components/UserMenu";

const Homepage = () => {
  const navigate = useNavigate();
  const featuresRef = useRef(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [role, setRole] = useState("");
  const heroImages = [school1, school2, school3];

  useEffect(() => {
    const timer = window.setInterval(
      () => setSlideIdx((index) => (index + 1) % heroImages.length),
      5000
    );
    return () => window.clearInterval(timer);
  }, [heroImages.length]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      setRole(
        decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
          localStorage.getItem("role") ||
          ""
      );
    } catch {
      setRole(localStorage.getItem("role") || "");
    }
  }, []);

  const openDashboard = () => {
    if (role === "Manager") navigate("/manager");
    else if (role === "Nurse") navigate("/nurse");
    else if (role === "Parent") navigate("/parent");
    else navigate("/login");
  };

  const features = [
    { icon: notifyLogo, title: "傷病紀錄", text: "快速登錄學生傷病、處置、地點、嚴重程度與後續紀錄。" },
    { icon: reportLogo, title: "學生健康資料", text: "集中查看過敏、慢性疾病、既往病史與歷次健康紀錄。" },
    { icon: healthLogo, title: "健康檢查", text: "管理身高、體重、BMI、視力、口腔與健康檢查結果。" },
    { icon: vacxinLogo, title: "預防接種", text: "管理接種活動、意願、結果與後續追蹤。" },
    { icon: nurseLogo, title: "健康中心作業", text: "依班級與學生快速查詢，支援日常護理工作流程。" },
    { icon: statisticLogo, title: "統計與匯出", text: "產生健康中心統計資料，並可匯出 Excel 或 PDF。" },
  ];

  return (
    <>
      <header className={style.navbar}>
        <div className={style.logo}>
          <img src={logo} alt="EduHealth" className={style.logoImg} />
        </div>
        <nav className={style.navLinks}>
          <a href="#top" className={style.navLink}>首頁</a>
          <a
            href="#features"
            className={style.navLink}
            onClick={(event) => {
              event.preventDefault();
              featuresRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            功能
          </a>
          <a href="/blog" className={style.navLink} onClick={(event) => { event.preventDefault(); navigate("/blog"); }}>
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

      <section id="top" className={style.hero}>
        <div className={style.heroBgSlideshow}>
          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt=""
              className={
                style.heroBgImg +
                (index === slideIdx ? ` ${style.activeBg}` : ` ${style.inactiveBg}`)
              }
            />
          ))}
          <div className={style.slideDotsBg}>
            {heroImages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`切換至背景圖片 ${index + 1}`}
                className={index === slideIdx ? style.dotActive : style.dot}
                onClick={() => setSlideIdx(index)}
              />
            ))}
          </div>
        </div>

        <div className={style.heroTextOverlay}>
          <h1>
            EduHealth Local TW
            <br />
            <span className={style.highlight}>校園健康中心管理系統</span>
          </h1>
          <p className={style.heroDesc}>
            為學校健康中心調整的繁體中文單機版。學生健康、傷病、用藥、
            預防接種與健康檢查資料都保留在本機電腦，不依賴雲端服務。
          </p>
          <div className={style.heroButtons}>
            <button className={style.primaryBtn} onClick={openDashboard}>
              {localStorage.getItem("token") ? "進入健康中心" : "登入系統"}
            </button>
            <button
              className={style.outlineBtn}
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              查看功能
            </button>
          </div>
        </div>
      </section>

      <section id="features" className={style.features} ref={featuresRef}>
        <h2>健康中心核心功能</h2>
        <p className={style.description}>
          以護理師日常作業為核心，減少不必要的雲端與公開網站功能。
        </p>
        <div className={style.featureRows}>
          <div className={style.featureRow}>
            {features.slice(0, 3).map((feature) => (
              <div key={feature.title} className={style.featureBox + " " + style.boxHover}>
                <img src={feature.icon} alt="" className={style.iconAnim} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
          <div className={style.featureRow}>
            {features.slice(3).map((feature) => (
              <div key={feature.title} className={style.featureBox + " " + style.boxHover}>
                <img src={feature.icon} alt="" className={style.iconAnim} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={style.cta}>
        <h2>單機離線使用</h2>
        <p>
          後端只監聽 127.0.0.1；電子郵件與雲端 Redis 已停用。
          建議搭配 Windows 登入密碼、BitLocker 與加密備份使用。
        </p>
        <div className={style.ctaButtons}>
          <button className={style.primaryBtn} onClick={openDashboard}>
            進入系統
          </button>
        </div>
      </section>

      <footer className={style.footer}>
        <div className={style.footerBottom}>
          <p>EduHealth Local TW｜本機離線版｜學生健康資料請依校內規範妥善保管</p>
        </div>
      </footer>
    </>
  );
};

export default Homepage;
