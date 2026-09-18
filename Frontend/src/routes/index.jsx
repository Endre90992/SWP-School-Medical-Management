import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoadingOverlay from "../components/LoadingOverlay";

const Login = lazy(() => import("../pages/auth/Login"));
const FirstLogin = lazy(() => import("../pages/auth/FirstLogin"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/auth/ResetPassword"));

const ManagerDashboard = lazy(() => import("../pages/manager/ManagerDashboard"));
const UsersList = lazy(() => import("../pages/manager/UsersList"));
const Blog = lazy(() => import("../pages/manager/Blog"));
const BlogCreate = lazy(() => import("../pages/manager/BlogCreate"));
const SendNotifications = lazy(() => import("../pages/manager/SendNotifications"));
const VaccinationCampaign = lazy(() => import("../pages/manager/VaccinationCampaign"));
const HealthCheckCampaign = lazy(() => import("../pages/manager/HealthCheckCampaign"));

const NurseDashboard = lazy(() => import("../pages/nurse/NurseDashboard"));
const StudentList = lazy(() => import("../pages/nurse/StudentList"));
const StudentDetail = lazy(() => import("../pages/nurse/StudentDetail"));
const MedicationHandle = lazy(() => import("../pages/nurse/MedicationHandle"));
const Incident = lazy(() => import("../pages/nurse/Incident"));
const MedicalSupplies = lazy(() => import("../pages/nurse/MedicalSupplies"));
const VaccinCampaign = lazy(() => import("../pages/nurse/VaccinCampaign"));
const CampaignDetail = lazy(() => import("../pages/nurse/CampaignDetail"));
const VaccinationResultPage = lazy(() => import("../pages/nurse/VaccinationResultPage"));
const HealthCheckList = lazy(() => import("../pages/nurse/HealthCheckList"));
const HealthCheckDetail = lazy(() => import("../pages/nurse/HealthCheckDetail"));
const HealthCheckRecord = lazy(() => import("../pages/nurse/HealthCheckRecord"));
const NurseReport = lazy(() => import("../pages/nurse/NurseReport"));
const ViewBlog = lazy(() => import("../pages/nurse/viewBlog"));

const ParentDashboard = lazy(() => import("../pages/parent/ParentDashboard"));
const HealthProfile = lazy(() => import("../pages/parent/HealthProfile"));
const SendMedicine = lazy(() => import("../pages/parent/SendMedicine"));
const ChildCareHistory = lazy(() => import("../pages/parent/ChildCareHistory"));
const NotificationAndReport = lazy(() => import("../pages/parent/NotificationAndReport"));

function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (roles?.length && !roles.includes(role)) {
    if (role === "Manager") return <Navigate to="/manager" replace />;
    if (role === "Nurse") return <Navigate to="/nurse" replace />;
    if (role === "Parent") return <Navigate to="/parent" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

const AppRouter = () => (
  <Suspense fallback={<LoadingOverlay text="頁面載入中..." />}>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/firstlogin" element={<ProtectedRoute><FirstLogin /></ProtectedRoute>} />

      <Route path="/manager" element={<ProtectedRoute roles={["Manager"]}><ManagerDashboard /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={["Manager"]}><UsersList /></ProtectedRoute>} />
      <Route path="/manager/blog" element={<ProtectedRoute roles={["Manager"]}><Blog /></ProtectedRoute>} />
      <Route path="/manager/blog/create" element={<ProtectedRoute roles={["Manager"]}><BlogCreate /></ProtectedRoute>} />
      <Route path="/sendnotifications" element={<ProtectedRoute roles={["Manager"]}><SendNotifications /></ProtectedRoute>} />
      <Route path="/vaccination-campaigns" element={<ProtectedRoute roles={["Manager", "Nurse"]}><VaccinationCampaign /></ProtectedRoute>} />
      <Route path="/health-check-campaign" element={<ProtectedRoute roles={["Manager", "Nurse"]}><HealthCheckCampaign /></ProtectedRoute>} />

      <Route path="/nurse" element={<ProtectedRoute roles={["Nurse", "Manager"]}><NurseDashboard /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute roles={["Nurse", "Manager"]}><StudentList /></ProtectedRoute>} />
      <Route path="/students/:id" element={<ProtectedRoute roles={["Nurse", "Manager"]}><StudentDetail /></ProtectedRoute>} />
      <Route path="/medicine" element={<ProtectedRoute roles={["Nurse", "Manager"]}><MedicationHandle /></ProtectedRoute>} />
      <Route path="/incidents" element={<ProtectedRoute roles={["Nurse", "Manager"]}><Incident /></ProtectedRoute>} />
      <Route path="/supplies" element={<ProtectedRoute roles={["Nurse", "Manager"]}><MedicalSupplies /></ProtectedRoute>} />
      <Route path="/vaccines" element={<ProtectedRoute roles={["Nurse", "Manager"]}><VaccinCampaign /></ProtectedRoute>} />
      <Route path="/vaccines/:id" element={<ProtectedRoute roles={["Nurse", "Manager"]}><CampaignDetail /></ProtectedRoute>} />
      <Route path="/vaccines/:id/result" element={<ProtectedRoute roles={["Nurse", "Manager"]}><VaccinationResultPage /></ProtectedRoute>} />
      <Route path="/health-check" element={<ProtectedRoute roles={["Nurse", "Manager"]}><HealthCheckList /></ProtectedRoute>} />
      <Route path="/healthcheck/:campaignId" element={<ProtectedRoute roles={["Nurse", "Manager"]}><HealthCheckDetail /></ProtectedRoute>} />
      <Route path="/health-record/:recordId" element={<ProtectedRoute roles={["Nurse", "Manager"]}><HealthCheckRecord /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute roles={["Nurse", "Manager"]}><NurseReport /></ProtectedRoute>} />
      <Route path="/viewBlog" element={<ProtectedRoute roles={["Nurse", "Manager"]}><ViewBlog /></ProtectedRoute>} />

      <Route path="/parent" element={<ProtectedRoute roles={["Parent", "Manager"]}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute roles={["Parent", "Manager"]}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/healthprofile" element={<ProtectedRoute roles={["Parent", "Manager"]}><HealthProfile /></ProtectedRoute>} />
      <Route path="/sendmedicine" element={<ProtectedRoute roles={["Parent", "Manager"]}><SendMedicine /></ProtectedRoute>} />
      <Route path="/hisofcare" element={<ProtectedRoute roles={["Parent", "Manager"]}><ChildCareHistory /></ProtectedRoute>} />
      <Route path="/notification" element={<ProtectedRoute roles={["Parent", "Manager"]}><NotificationAndReport /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

export default AppRouter;
