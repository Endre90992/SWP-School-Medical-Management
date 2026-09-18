using Microsoft.AspNetCore.Http;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Response;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Service.Interface;

namespace SchoolMedicalManagement.Service.Implement
{
    public class DashboardService : IDashboardService
    {
        private readonly StudentRepository _studentRepository;
        private readonly UserRepository _userRepository;
        private readonly MedicalEventRepository _medicalEventRepository;
        private readonly MedicationRequestRepository _medicationRequestRepository;
        private readonly VaccinationCampaignRepository _vaccinationCampaignRepository;
        private readonly HealthCheckCampaignRepository _healthCheckCampaignRepository;
        private readonly NotificationRepository _notificationRepository;

        public DashboardService(
            StudentRepository studentRepository,
            UserRepository userRepository,
            MedicalEventRepository medicalEventRepository,
            MedicationRequestRepository medicationRequestRepository,
            VaccinationCampaignRepository vaccinationCampaignRepository,
            HealthCheckCampaignRepository healthCheckCampaignRepository,
            NotificationRepository notificationRepository)
        {
            _studentRepository = studentRepository;
            _userRepository = userRepository;
            _medicalEventRepository = medicalEventRepository;
            _medicationRequestRepository = medicationRequestRepository;
            _vaccinationCampaignRepository = vaccinationCampaignRepository;
            _healthCheckCampaignRepository = healthCheckCampaignRepository;
            _notificationRepository = notificationRepository;
        }

        public async Task<BaseResponse?> GetDashboardOverviewAsync()
        {
            try
            {
                // 所有統計都交由資料庫端 Count / GroupBy / LIMIT 執行，
                // 避免將完整傷病與用藥資料表載入記憶體後再統計。
                var totalStudents = await _studentRepository.GetTotalStudentsCount();
                var totalUsers = await GetUserCountsByRoleAsync();

                var totalMedicalEvents = await _medicalEventRepository.GetActiveMedicalEventsCountAsync();
                var recentMedicalEvents = await _medicalEventRepository.GetRecentMedicalEventsAsync(5);

                var totalMedicationRequests = await _medicationRequestRepository.GetActiveRequestsCountAsync();
                var pendingMedicationRequests = await _medicationRequestRepository.GetPendingRequestsCountAsync();
                var recentMedicationRequests = await _medicationRequestRepository.GetRecentRequestsAsync(5);

                var vaccinationStatusCounts = await _vaccinationCampaignRepository.GetStatusCountsAsync();
                var totalVaccinationCampaigns = vaccinationStatusCounts.Values.Sum();

                var healthStatusCounts = await _healthCheckCampaignRepository.GetStatusCountsAsync();
                var totalHealthCheckCampaigns = healthStatusCounts.Values.Sum();

                var overview = new DashboardOverviewResponse
                {
                    TotalStudents = totalStudents,
                    TotalUsers = totalUsers,
                    TotalMedicalEvents = totalMedicalEvents,
                    TotalMedicationRequests = totalMedicationRequests,
                    PendingMedicationRequests = pendingMedicationRequests,
                    TotalVaccinationCampaigns = totalVaccinationCampaigns,
                    ActiveVaccinationCampaigns = vaccinationStatusCounts.GetValueOrDefault(2),
                    NotStartedVaccinationCampaigns = vaccinationStatusCounts.GetValueOrDefault(1),
                    CompletedVaccinationCampaigns = vaccinationStatusCounts.GetValueOrDefault(3),
                    CancelledVaccinationCampaigns = vaccinationStatusCounts.GetValueOrDefault(4),
                    TotalHealthCheckCampaigns = totalHealthCheckCampaigns,
                    ActiveHealthCheckCampaigns = healthStatusCounts.GetValueOrDefault(2),
                    RecentMedicalEvents = recentMedicalEvents,
                    RecentMedicationRequests = recentMedicationRequests
                };

                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "取得健康中心總覽資料成功。",
                    Data = overview
                };
            }
            catch
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "取得健康中心總覽資料時發生錯誤。",
                    Data = null
                };
            }
        }

        private async Task<UserCountResponse> GetUserCountsByRoleAsync()
        {
            var counts = await _userRepository.GetActiveUserCountsByRoleAsync();
            return new UserCountResponse
            {
                Admin = counts.GetValueOrDefault(1),
                Nurse = counts.GetValueOrDefault(2),
                Parent = counts.GetValueOrDefault(3),
                Total = counts.Values.Sum()
            };
        }

        public async Task<BaseResponse?> GetVaccinationCampaignStatisticsAsync()
        {
            try
            {
                var counts = await _vaccinationCampaignRepository.GetStatusCountsAsync();
                var statistics = new
                {
                    TotalCampaigns = counts.Values.Sum(),
                    NotStartedCampaigns = counts.GetValueOrDefault(1),
                    ActiveCampaigns = counts.GetValueOrDefault(2),
                    CompletedCampaigns = counts.GetValueOrDefault(3),
                    CancelledCampaigns = counts.GetValueOrDefault(4)
                };

                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "取得預防接種統計成功。",
                    Data = statistics
                };
            }
            catch
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "取得預防接種統計時發生錯誤。",
                    Data = null
                };
            }
        }

        public async Task<BaseResponse?> GetHealthStatisticsAsync()
        {
            try
            {
                var counts = await _healthCheckCampaignRepository.GetStatusCountsAsync();
                var data = new
                {
                    TotalHealthCheckCampaigns = counts.Values.Sum(),
                    ActiveHealthCheckCampaigns = counts.GetValueOrDefault(2)
                };

                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "取得健康檢查統計成功。",
                    Data = data
                };
            }
            catch
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "取得健康檢查統計時發生錯誤。",
                    Data = null
                };
            }
        }

        public async Task<BaseResponse?> GetMedicalEventsStatisticsAsync()
        {
            try
            {
                var data = new
                {
                    TotalMedicalEvents = await _medicalEventRepository.GetActiveMedicalEventsCountAsync(),
                    RecentMedicalEvents = await _medicalEventRepository.GetRecentMedicalEventsAsync(5)
                };

                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "取得傷病統計成功。",
                    Data = data
                };
            }
            catch
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "取得傷病統計時發生錯誤。",
                    Data = null
                };
            }
        }

        public async Task<BaseResponse?> GetMedicationStatisticsAsync()
        {
            try
            {
                var data = new
                {
                    TotalMedicationRequests = await _medicationRequestRepository.GetActiveRequestsCountAsync(),
                    PendingMedicationRequests = await _medicationRequestRepository.GetPendingRequestsCountAsync(),
                    RecentMedicationRequests = await _medicationRequestRepository.GetRecentRequestsAsync(5)
                };

                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "取得用藥統計成功。",
                    Data = data
                };
            }
            catch
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "取得用藥統計時發生錯誤。",
                    Data = null
                };
            }
        }

        public async Task<BaseResponse?> GetParentDashboardOverviewAsync(Guid parentId)
        {
            try
            {
                var parent = await _userRepository.GetUserById(parentId);
                if (parent == null || parent.RoleId != 3)
                {
                    return new BaseResponse
                    {
                        Status = StatusCodes.Status404NotFound.ToString(),
                        Message = "找不到家長資料。",
                        Data = null
                    };
                }

                var children = await _studentRepository.GetStudentsByParentId(parentId);
                var childrenIds = children.Select(s => s.StudentId).ToList();

                var recentMedicalEvents = childrenIds.Count == 0
                    ? new List<RecentMedicalEventResponse>()
                    : await _medicalEventRepository.GetRecentMedicalEventsByStudentIdsAsync(childrenIds, 5);

                var recentMedicationRequests = childrenIds.Count == 0
                    ? new List<RecentMedicationRequestResponse>()
                    : await _medicationRequestRepository.GetRecentRequestsByStudentIdsAsync(childrenIds, 5);

                var recentNotifications = await GetRecentNotificationsAsync(parentId, 3);

                var parentDashboard = new ParentDashboardOverviewResponse
                {
                    TotalChildren = children.Count,
                    Children = CreateBasicChildrenOverview(children),
                    RecentMedicalEvents = recentMedicalEvents,
                    RecentMedicationRequests = recentMedicationRequests,
                    RecentNotifications = recentNotifications
                };

                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "取得家長總覽資料成功。",
                    Data = parentDashboard
                };
            }
            catch
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "取得家長總覽資料時發生錯誤。",
                    Data = null
                };
            }
        }

        private static List<ChildOverviewResponse> CreateBasicChildrenOverview(List<Student> children)
        {
            return children.Select(child => new ChildOverviewResponse
            {
                StudentId = child.StudentId,
                StudentName = child.FullName ?? string.Empty,
                Class = child.Class ?? string.Empty,
                DateOfBirth = child.DateOfBirth,
                Gender = child.Gender?.GenderName ?? string.Empty
            }).ToList();
        }

        private async Task<List<RecentNotificationResponse>> GetRecentNotificationsAsync(Guid parentId, int count)
        {
            var notifications = await _notificationRepository.GetRecentNotificationsByUserIdAsync(parentId, count);
            return notifications.Select(n => new RecentNotificationResponse
            {
                NotificationId = n.NotificationId,
                Title = n.Title,
                Message = n.Message,
                CreatedDate = n.SentDate ?? DateTime.MinValue,
                IsRead = n.IsRead ?? false
            }).ToList();
        }
    }
}
