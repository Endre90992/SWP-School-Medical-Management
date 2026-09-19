using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Models.Response;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Service.Interface;

namespace SchoolMedicalManagement.Service.Implement
{
    public class MedicationRequestService : IMedicationRequestService
    {
        private readonly MedicationRequestRepository _medicationRequestRepository;

        public MedicationRequestService(MedicationRequestRepository medicationRequestRepository)
        {
            _medicationRequestRepository = medicationRequestRepository;
        }

        private const int PendingStatus = 1;
        private const int ApprovedStatus = 2;
        private const int RejectedStatus = 3;
        private const int ScheduledStatus = 4;
        private const int CompletedStatus = 5;
        private const int CancelledStatus = 6;

        private string GetStatusString(int? statusId)
        {
            return statusId switch
            {
                PendingStatus => "待審核",
                ApprovedStatus => "已核准",
                RejectedStatus => "已拒絕",
                ScheduledStatus => "已排程",
                CompletedStatus => "已完成",
                CancelledStatus => "已取消",
                _ => "未知狀態"
            };
        }

        private static string? GetAttachmentPath(MedicationRequest request)
        {
            return string.IsNullOrWhiteSpace(request.ImagePath)
                ? null
                : $"/api/MedicationRequest/{request.RequestId}/attachment";
        }


        public async Task<BaseResponse> GetPendingRequestsAsync()
        {
            var list = await _medicationRequestRepository.GetPendingRequestsAsync();
            var responseList = list.Select(r => new MedicationRequestResponse
            {   
                RequestID = r.RequestId,
                StudentName = r.Student?.FullName ?? "未填寫",
                ParentName = r.Parent?.FullName ?? "未填寫",
                MedicationName = r.MedicationName,
                Dosage = r.Dosage,
                Instructions = r.Instructions,
                Status = GetStatusString(r.Status.StatusId),
                ImagePath = GetAttachmentPath(r),
                ReceivedByName = r.ReceivedByNavigation?.FullName,
                RequestDate = r.RequestDate
            }).ToList();
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "已取得待審核用藥申請。",
                Data = responseList
            };
        }

        public async Task<BaseResponse> HandleMedicationRequest(UpdateMedicationRequestStatus request)
        {
            var entity = await _medicationRequestRepository.GetByIdMedical(request.RequestID);
            if (entity == null)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status404NotFound.ToString(),
                    Message = "找不到指定的用藥申請。",
                    Data = null
                };
            }

            // ✅ Lưu trạng thái cũ để log
            var oldStatusId = entity.StatusId;
            
            entity.StatusId = request.StatusID;
            entity.ReceivedBy = request.NurseID;

            var response = await _medicationRequestRepository.UpdateStatusAsync(entity);

            if (response)
            {
                // ✅ Load lại entity với đầy đủ thông tin sau khi update
                var updatedEntity = await _medicationRequestRepository.GetByIdMedical(request.RequestID);
                
                return new BaseResponse
                {
                    Status = StatusCodes.Status200OK.ToString(),
                    Message = "用藥申請狀態已更新。",
                    Data = new MedicationRequestResponse
                    {
                        RequestID = updatedEntity.RequestId,
                        StudentName = updatedEntity.Student?.FullName ?? "未填寫",
                        ParentName = updatedEntity.Parent?.FullName ?? "未填寫",
                        MedicationName = updatedEntity.MedicationName,
                        Dosage = updatedEntity.Dosage,
                        Instructions = updatedEntity.Instructions,
                        Status = GetStatusString(updatedEntity.StatusId), // ✅ Sử dụng StatusId thay vì Status.StatusId
                        RequestDate = updatedEntity.RequestDate,
                        ImagePath = GetAttachmentPath(updatedEntity),
                        ReceivedByName = updatedEntity.ReceivedByNavigation?.FullName // Thông tin y tá đã duyệt
                    }
                };
            }
            else
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status500InternalServerError.ToString(),
                    Message = "更新用藥申請狀態失敗。",
                    Data = null
                };
            }
        }



        // ✅ Đã thêm imagePath
        public async Task<BaseResponse> CreateMedicationRequestAsync(CreateMedicationRequest request, Guid parentId, string? imagePath)
        {
            var newRequest = new MedicationRequest
            {
                StudentId = request.StudentID,
                ParentId = parentId,
                MedicationName = request.MedicationName,
                Dosage = request.Dosage,
                Instructions = request.Instructions,
                RequestDate = DateTime.Now,
                StatusId = PendingStatus,
                IsActive = true,
                ImagePath = imagePath,
            };

            // ✅ Tạo đơn thuốc và lấy RequestId được tạo
            var createdRequestId = await _medicationRequestRepository.CreateMedicalRequestAsync(newRequest);

            // ✅ Load lại thông tin đầy đủ từ database bằng RequestId vừa tạo
            var createdRequest = await _medicationRequestRepository.GetByIdMedical(createdRequestId);

            if (createdRequest == null)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status404NotFound.ToString(),
                    Message = "找不到剛建立的用藥申請。",
                    Data = null
                };
            }
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "用藥申請建立成功。",
                Data = new MedicationRequestResponse
                {
                    RequestID = createdRequest.RequestId,
                    StudentName = createdRequest.Student?.FullName ?? "未填寫",
                    ParentName = createdRequest.Parent?.FullName ?? "未填寫",
                    MedicationName = createdRequest.MedicationName,
                    Dosage = createdRequest.Dosage,
                    Instructions = createdRequest.Instructions,
                    Status = GetStatusString(PendingStatus),
                    RequestDate = createdRequest.RequestDate,
                    ImagePath = GetAttachmentPath(createdRequest)
                }
            };
        }

        public async Task<BaseResponse> GetAllMedicalRequest()
        {
            var list = await _medicationRequestRepository.GetAllRequestsAsync();
            var responseList = list.Select(item => new MedicationRequestResponse
            {
                RequestID = item.RequestId,
                StudentName = item.Student?.FullName ?? "未填寫",
                ParentName = item.Parent?.FullName ?? "未填寫",
                MedicationName = item.MedicationName,
                Dosage = item.Dosage,
                Instructions = item.Instructions,
                Status = GetStatusString(item.Status.StatusId),
                ImagePath = GetAttachmentPath(item),
                ReceivedByName = item.ReceivedByNavigation?.FullName,
                RequestDate = item.RequestDate
            }).ToList();
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "已取得全部用藥申請。",
                Data = responseList
            };
        }

        public async Task<BaseResponse> GetMedicalRequestByStudentId(string studentid)
        {
            var response = await _medicationRequestRepository.GetRequestByStudentIdAsync(studentid);

            if(response == null)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status404NotFound.ToString(),
                    Message = "找不到此學生的用藥申請",
                    Data = null
                };
            }
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "已取得用藥申請資料",
                Data = new MedicationRequestResponse
                {
                    RequestID = response.RequestId,
                    StudentName = response.Student?.FullName ?? "未填寫",
                    ParentName = response.Parent?.FullName ?? "未填寫",
                    MedicationName = response.MedicationName,
                    Dosage = response.Dosage,
                    Instructions = response.Instructions,
                    Status = GetStatusString(response.Status.StatusId),
                    ImagePath = GetAttachmentPath(response),
                    ReceivedByName = response.ReceivedByNavigation?.FullName,
                    RequestDate = response.RequestDate
                }
            };
        }

        public async Task<BaseResponse> GetRequestsByParentIdAsync(Guid parentId)
        {
            var requests = await _medicationRequestRepository.GetRequestsByParentIdAsync(parentId);
            var responseList = requests.Select(r => new MedicationRequestResponse
            {
                RequestID = r.RequestId,
                StudentName = r.Student?.FullName ?? "未填寫",
                ParentName = r.Parent?.FullName ?? "未填寫",
                MedicationName = r.MedicationName,
                Dosage = r.Dosage,
                Instructions = r.Instructions,
                Status = GetStatusString(r.Status.StatusId),
                ImagePath = GetAttachmentPath(r),
                ReceivedByName = r.ReceivedByNavigation?.FullName,
                RequestDate = r.RequestDate
            }).ToList();
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "已取得家長的用藥申請。",
                Data = responseList
            };
        }

        public async Task<BaseResponse> GetRequestByIdAsync(int requestId)
        {
            var request = await _medicationRequestRepository.GetByIdMedical(requestId);

            if (request == null)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status404NotFound.ToString(),
                    Message = "找不到用藥申請",
                    Data = null
                };
            }

            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "已取得用藥申請資料",
                Data = new MedicationRequestResponse
                {
                    RequestID = request.RequestId,
                    StudentName = request.Student?.FullName ?? "未填寫",
                    ParentName = request.Parent?.FullName ?? "未填寫",
                    MedicationName = request.MedicationName,
                    Dosage = request.Dosage,
                    Instructions = request.Instructions,
                    Status = GetStatusString(request.Status.StatusId),
                    ImagePath = GetAttachmentPath(request),
                    ReceivedByName = request.ReceivedByNavigation?.FullName,
                    RequestDate = request.RequestDate
                }
            };
        }

        public async Task<BaseResponse> UpdateMedicationRequestStatusAsync(int requestId, UpdateMedicationStatusDto dto)
        {
            var request = await _medicationRequestRepository.GetByIdAsync(requestId);
            if (request == null)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status404NotFound.ToString(),
                    Message = "找不到用藥申請.",
                    Data = null
                };
            }
            request.StatusId = dto.StatusId;
            await _medicationRequestRepository.UpdateAsync(request);
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "狀態更新成功。",
                Data = null
            };
        }

        // ✅ Lấy danh sách đơn thuốc theo Id trạng thái
        public async Task<BaseResponse> GetRequestsByStatusIdAsync(int statusId)
        {
            var list = await _medicationRequestRepository.GetRequestsByStatusIdAsync(statusId);
            var data = list.Select(r => new MedicationRequestResponse
            {
                RequestID = r.RequestId,
                StudentName = r.Student?.FullName ?? "未填寫",
                ParentName = r.Parent?.FullName ?? "未填寫",
                MedicationName = r.MedicationName,
                Dosage = r.Dosage,
                Instructions = r.Instructions,
                Status = GetStatusString(r.Status.StatusId),
                ImagePath = GetAttachmentPath(r),
                ReceivedByName = r.ReceivedByNavigation?.FullName,
                RequestDate = r.RequestDate
            }).ToList();
            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "已取得指定狀態的用藥申請。",
                Data = data
            };
        }
    }
}
