import { Navigate, Route, Routes } from "react-router-dom";
import Homepage from "../pages/homepage/Homepage";
import Login from "../pages/auth/Login";
import FirstLogin from "../pages/auth/FirstLogin";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import BlogPublic from "../pages/homepage/BlogPublic";

import ManagerDashboard from "../pages/manager/ManagerDashboard";
import UsersList from "../pages/manager/UsersList";
import Blog from "../pages/manager/Blog";
import BlogCreate from "../pages/manager/BlogCreate";
import SendNotifications from "../pages/manager/SendNotifications";
import VaccinationCampaign from "../pages/manager/VaccinationCampaign";
import HealthCheckCampaign from "../pages/manager/HealthCheckCampaign";

import NurseDashboard from "../pages/nurse/NurseDashboard";
import StudentList from "../pages/nurse/StudentList";
import StudentDetail from "../pages/nurse/StudentDetail";
import MedicationHandle from "../pages/nurse/MedicationHandle";
import Incident from "../pages/nurse/Incident";
import MedicalSupplies from "../pages/nurse/MedicalSupplies";
import VaccinCampaign from "../pages/nurse/VaccinCampaign";
import CampaignDetail from "../pages/nurse/CampaignDetail";
import VaccinationResultPage from "../pages/nurse/VaccinationResultPage";
import HealthCheckList from "../pages/nurse/HealthCheckList";
import HealthCheckDetail from "../pages/nurse/HealthCheckDetail";
import HealthCheckRecord from "../pages/nurse/HealthCheckRecord";
import NurseReport from "../pages/nurse/NurseReport";
import ViewBlog from "../pages/nurse/viewBlog";

import ParentDashboard from "../pages/parent/ParentDashboard";
import HealthProfile from "../pages/parent/HealthProfile";
import SendMedicine from "../pages/parent/SendMedicine";
import ChildCareHistory from "../pages/parent/ChildCareHistory";
import NotificationAndReport from "../pages/parent/NotificationAndReport";

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
  <Routes>
    <Route path="/" element={<Homepage />} />
    <Route path="/login" element={<Login />} />
    <Route path="/blog" element={<BlogPublic />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route
      path="/firstlogin"
      element={
        <ProtectedRoute>
          <FirstLogin />
        </ProtectedRoute>
      }
    />

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
);

export default AppRouter;
