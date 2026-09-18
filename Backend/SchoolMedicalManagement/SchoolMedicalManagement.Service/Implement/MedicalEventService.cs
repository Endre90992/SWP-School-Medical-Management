using Microsoft.AspNetCore.Http;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Models.Response;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Service.Interface;
using System.Text;

public class MedicalEventService : IMedicalEventService
{
    private readonly MedicalEventRepository _medicalEventRepository;
    private readonly MedicalHistoryRepository _medicalHistoryRepository;

    public MedicalEventService(MedicalEventRepository medicalEventRepository, MedicalHistoryRepository medicalHistoryResponse)
    {
        _medicalEventRepository = medicalEventRepository;
        _medicalHistoryRepository = medicalHistoryResponse;
    }

    // =============================
    // TẠO MỚI SỰ KIỆN Y TẾ
    // =============================
    public async Task<BaseResponse?> CreateMedicalEvent(CreateMedicalEventRequest request)
    {
        var supplyRequests = NormalizeSupplyRequests(request.SuppliesUsed);
        var suppliesById = new Dictionary<int, MedicalSupply>();

        if (supplyRequests.Count > 0)
        {
            var supplyIds = supplyRequests.Select(x => x.SupplyId).ToList();
            var supplies = await _medicalEventRepository.GetSuppliesByIdsAsync(supplyIds);
            suppliesById = supplies.ToDictionary(s => s.SupplyId);

            if (suppliesById.Count != supplyIds.Distinct().Count())
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status400BadRequest.ToString(),
                    Message = "部分醫療物資不存在，請重新整理後再試。",
                    Data = null
                };
            }

            foreach (var item in supplyRequests)
            {
                var supply = suppliesById[item.SupplyId];
                if ((supply.Quantity ?? 0) < item.QuantityUsed)
                {
                    return new BaseResponse
                    {
                        Status = StatusCodes.Status400BadRequest.ToString(),
                        Message = $"醫療物資「{supply.Name}」庫存不足。",
                        Data = null
                    };
                }
            }

            var histories = await _medicalHistoryRepository
                .GetAllByStudentIdMedicalHistory(request.StudentId);

            var allergies = FindAllergicSupplies(histories, suppliesById.Values);
            if (allergies.Count > 0)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status400BadRequest.ToString(),
                    Message = $"學生可能對下列醫療物資有過敏紀錄：{string.Join(", ", allergies)}",
                    Data = null
                };
            }
        }

        var newEvent = new MedicalEvent
        {
            StudentId = request.StudentId,
            EventTypeId = request.EventTypeId,
            EventDate = request.EventDate,
            Description = request.Description,
            HandledBy = request.HandledByUserId,
            SeverityId = request.SeverityId,
            Location = request.Location,
            Notes = request.Notes,
            IsActive = true
        };

        MedicalEvent? createdEvent;
        if (supplyRequests.Count > 0)
        {
            var handleRecords = new List<HandleRecord>();

            foreach (var item in supplyRequests)
            {
                var supply = suppliesById[item.SupplyId];
                supply.Quantity = (supply.Quantity ?? 0) - item.QuantityUsed;

                handleRecords.Add(new HandleRecord
                {
                    SupplyId = item.SupplyId,
                    QuantityUsed = item.QuantityUsed,
                    Note = item.Note
                });
            }

            createdEvent = await _medicalEventRepository
                .CreateMedicalEventWithSuppliesAsync(newEvent, handleRecords);
        }
        else
        {
            createdEvent = await _medicalEventRepository.CreateMedicalEvent(newEvent);
        }

        if (createdEvent == null)
        {
            return new BaseResponse
            {
                Status = StatusCodes.Status500InternalServerError.ToString(),
                Message = "建立傷病紀錄失敗。",
                Data = null
            };
        }

        return new BaseResponse
        {
            Status = StatusCodes.Status200OK.ToString(),
            Message = "傷病紀錄建立成功。",
            Data = new CreateMedicalEventResponse
            {
                EventId = createdEvent.EventId,
                StudentId = createdEvent.Student?.StudentId ?? request.StudentId,
                StudentName = createdEvent.Student?.FullName,
                ParentName = createdEvent.Student?.Parent?.FullName,
                EventType = createdEvent.EventType?.EventTypeName,
                EventDate = createdEvent.EventDate,
                Description = createdEvent.Description,
                HandledById = createdEvent.HandledBy,
                HandledByName = createdEvent.HandledByNavigation?.FullName,
                SeverityLevelName = createdEvent.Severity?.SeverityName,
                Location = createdEvent.Location,
                Notes = createdEvent.Notes,
                SuppliesUsed = createdEvent.HandleRecords.Select(hr => new SupplyUserResponse
                {
                    SupplyId = hr.SupplyId,
                    SupplyName = hr.Supply?.Name ?? string.Empty,
                    QuantityUsed = hr.QuantityUsed,
                    Unit = hr.Supply?.Unit ?? string.Empty,
                    Note = hr.Note
                }).ToList()
            }
        };
    }

    // =============================
    // LẤY CHI TIẾT 1 SỰ KIỆN
    // =============================
    public async Task<BaseResponse?> GetByIdMedicalEvent(int id)
    {
        var getid = await _medicalEventRepository.GetMedicalEventById(id);
        if (getid == null)
        {
            return new BaseResponse
            {
                Status = StatusCodes.Status404NotFound.ToString(),
                Message = "Không tìm thấy sự kiện y tế.",
                Data = null
            };
        }
        // kiểm tra xem StudentId có tồn tại không trước khi gọi method:
        var histories = new List<MedicalHistory>();
        if (getid.StudentId.HasValue)
        {
            histories = await _medicalHistoryRepository.GetAllByStudentIdMedicalHistory(getid.StudentId.Value);
        }

        return new BaseResponse
        {
            Status = StatusCodes.Status200OK.ToString(),
            Message = "Lấy sự kiện y tế thành công.",
            Data = new CreateMedicalEventResponse
            {
                EventId = getid.EventId,
                StudentId = getid.Student?.StudentId ?? 0,
                StudentName = getid.Student?.FullName ?? "(Không rõ)",
                ParentName = getid.Student?.Parent?.FullName ?? "(Không rõ)",
                EventType = getid.EventType?.EventTypeName ?? "(Không rõ)",
                EventDate = getid.EventDate,
                Description = getid.Description ?? string.Empty,
                HandledById = getid.HandledBy,
                HandledByName = getid.HandledByNavigation?.FullName ?? "(Không rõ)",
                SeverityLevelName = getid.Severity?.SeverityName ?? "(Không rõ)",
                Location = getid.Location ?? string.Empty,
                Notes = getid.Notes ?? string.Empty,
                SuppliesUsed = getid.HandleRecords?.Select(hr => new SupplyUserResponse
                {
                    SupplyId = hr.SupplyId,
                    SupplyName = hr.Supply?.Name ?? "(Không rõ)",
                    QuantityUsed = hr.QuantityUsed,
                    Unit = hr.Supply?.Unit ?? "(Không rõ)",
                    Note = hr.Note
                }).ToList() ?? new List<SupplyUserResponse>(),

                MedicalHistory = histories.Select(h => new MedicalHistoryResponse
                {
                    HistoryId = h.HistoryId,
                    StudentId = h.StudentId,
                    StudentName = h.Student?.FullName ?? "(Không rõ)",
                    DiseaseName = h.DiseaseName ?? "(Không rõ)",
                    DiagnosedDate = h.DiagnosedDate,
                    Note = h.Note ?? string.Empty
                }).ToList() 
            }
        };
    }

    // =============================
    // LẤY TẤT CẢ SỰ KIỆN Y TẾ
    // =============================
    public async Task<BaseResponse> GetAllMedicalEvent()
    {
        var listevent = await _medicalEventRepository.GetAllMedicalEvents();
        var responseList = listevent.Select(e => new CreateMedicalEventResponse
        {
            EventId = e.EventId,    
            StudentId = e.Student?.StudentId ?? 0,
            StudentName = e.Student?.FullName ?? "(Không rõ)",
            ParentName = e.Student?.Parent?.FullName ?? "(Không rõ)",
            EventType = e.EventType?.EventTypeName ?? "(Không rõ)",
            EventDate = e.EventDate,
            Description = e.Description ?? string.Empty,
            Notes = e.Notes ?? string.Empty,
            Location = e.Location ?? string.Empty,
            SeverityLevelName = e.Severity?.SeverityName ?? "(Không rõ)",
            HandledById = e.HandledBy,
            HandledByName = e.HandledByNavigation?.FullName ?? "(Không rõ)",
            SuppliesUsed = e.HandleRecords?.Select(hr => new SupplyUserResponse
            {
                SupplyId = hr.SupplyId,
                SupplyName = hr.Supply?.Name ?? "(Không rõ)",
                QuantityUsed = hr.QuantityUsed,
                Unit = hr.Supply?.Unit ?? "(Không rõ)",
                Note = hr.Note
            }).ToList() ?? new List<SupplyUserResponse>(),

            MedicalHistory = new List<MedicalHistoryResponse>() // optional: để rõ ràng
        }).ToList();
        return new BaseResponse
        {
            Status = StatusCodes.Status200OK.ToString(),
            Message = "Lấy danh sách sự kiện y tế thành công.",
            Data = responseList
        };
    }

    // =============================
    // CẬP NHẬT SỰ KIỆN Y TẾ
    // =============================
    public async Task<BaseResponse?> UpdateMedicalEvent(int id, CreateMedicalEventRequest request)
    {
        var existingEvent = await _medicalEventRepository.GetMedicalEventById(id);
        if (existingEvent == null)
        {
            return new BaseResponse
            {
                Status = StatusCodes.Status404NotFound.ToString(),
                Message = "找不到傷病紀錄。",
                Data = null
            };
        }

        existingEvent.StudentId = request.StudentId == 0 ? existingEvent.StudentId : request.StudentId;
        existingEvent.EventTypeId = request.EventTypeId == 0 ? existingEvent.EventTypeId : request.EventTypeId;
        existingEvent.EventDate = request.EventDate == default ? existingEvent.EventDate : request.EventDate;
        existingEvent.Description = string.IsNullOrEmpty(request.Description) ? existingEvent.Description : request.Description;
        existingEvent.HandledBy = request.HandledByUserId == Guid.Empty ? existingEvent.HandledBy : request.HandledByUserId;
        existingEvent.Notes = string.IsNullOrEmpty(request.Notes) ? existingEvent.Notes : request.Notes;
        existingEvent.Location = string.IsNullOrEmpty(request.Location) ? existingEvent.Location : request.Location;
        existingEvent.SeverityId = request.SeverityId == 0 ? existingEvent.SeverityId : request.SeverityId;

        MedicalEvent? updatedEvent;
        var supplyRequests = NormalizeSupplyRequests(request.SuppliesUsed);

        // 與原功能一致：只有 request 有傳入物資時才重建物資使用紀錄；
        // 空清單不會自動清除既有物資。
        if (supplyRequests.Count > 0)
        {
            var oldRecords = existingEvent.HandleRecords.ToList();
            var oldQuantityBySupply = oldRecords
                .GroupBy(r => r.SupplyId)
                .ToDictionary(g => g.Key, g => g.Sum(r => r.QuantityUsed ?? 0));

            var affectedSupplyIds = oldQuantityBySupply.Keys
                .Concat(supplyRequests.Select(x => x.SupplyId))
                .Distinct()
                .ToList();

            var supplies = await _medicalEventRepository.GetSuppliesByIdsAsync(affectedSupplyIds);
            var suppliesById = supplies.ToDictionary(s => s.SupplyId);

            if (suppliesById.Count != affectedSupplyIds.Count)
            {
                return new BaseResponse
                {
                    Status = StatusCodes.Status400BadRequest.ToString(),
                    Message = "部分醫療物資不存在，請重新整理後再試。",
                    Data = null
                };
            }

            // 先在記憶體回補原事件曾使用的庫存，再驗證新的使用量。
            foreach (var (supplyId, oldQuantity) in oldQuantityBySupply)
            {
                var supply = suppliesById[supplyId];
                supply.Quantity = (supply.Quantity ?? 0) + oldQuantity;
            }

            foreach (var item in supplyRequests)
            {
                var supply = suppliesById[item.SupplyId];
                if ((supply.Quantity ?? 0) < item.QuantityUsed)
                {
                    return new BaseResponse
                    {
                        Status = StatusCodes.Status400BadRequest.ToString(),
                        Message = $"醫療物資「{supply.Name}」庫存不足。",
                        Data = null
                    };
                }
            }

            var studentId = existingEvent.StudentId.GetValueOrDefault();
            if (studentId != 0)
            {
                var histories = await _medicalHistoryRepository
                    .GetAllByStudentIdMedicalHistory(studentId);
                var selectedSupplies = supplyRequests
                    .Select(x => suppliesById[x.SupplyId])
                    .ToList();

                var allergies = FindAllergicSupplies(histories, selectedSupplies);
                if (allergies.Count > 0)
                {
                    return new BaseResponse
                    {
                        Status = StatusCodes.Status400BadRequest.ToString(),
                        Message = $"學生可能對下列醫療物資有過敏紀錄：{string.Join(", ", allergies)}",
                        Data = null
                    };
                }
            }

            var newRecords = new List<HandleRecord>();
            foreach (var item in supplyRequests)
            {
                var supply = suppliesById[item.SupplyId];
                supply.Quantity = (supply.Quantity ?? 0) - item.QuantityUsed;

                newRecords.Add(new HandleRecord
                {
                    EventId = existingEvent.EventId,
                    SupplyId = item.SupplyId,
                    QuantityUsed = item.QuantityUsed,
                    Note = item.Note
                });
            }

            updatedEvent = await _medicalEventRepository.UpdateMedicalEventWithSuppliesAsync(
                existingEvent,
                oldRecords,
                newRecords);
        }
        else
        {
            updatedEvent = await _medicalEventRepository.UpdateMedicalEvent(existingEvent);
        }

        if (updatedEvent == null)
        {
            return new BaseResponse
            {
                Status = StatusCodes.Status500InternalServerError.ToString(),
                Message = "更新傷病紀錄失敗。",
                Data = null
            };
        }

        return new BaseResponse
        {
            Status = StatusCodes.Status200OK.ToString(),
            Message = "傷病紀錄更新成功。",
            Data = new CreateMedicalEventResponse
            {
                EventId = updatedEvent.EventId,
                StudentId = updatedEvent.Student?.StudentId ?? 0,
                StudentName = updatedEvent.Student?.FullName ?? string.Empty,
                ParentName = updatedEvent.Student?.Parent?.FullName ?? string.Empty,
                EventType = updatedEvent.EventType?.EventTypeName ?? string.Empty,
                EventDate = updatedEvent.EventDate,
                Description = updatedEvent.Description ?? string.Empty,
                HandledById = updatedEvent.HandledBy,
                HandledByName = updatedEvent.HandledByNavigation?.FullName ?? string.Empty,
                SeverityLevelName = updatedEvent.Severity?.SeverityName ?? string.Empty,
                Location = updatedEvent.Location ?? string.Empty,
                Notes = updatedEvent.Notes ?? string.Empty,
                SuppliesUsed = updatedEvent.HandleRecords.Select(r => new SupplyUserResponse
                {
                    SupplyId = r.SupplyId,
                    SupplyName = r.Supply?.Name ?? string.Empty,
                    QuantityUsed = r.QuantityUsed,
                    Unit = r.Supply?.Unit ?? string.Empty,
                    Note = r.Note
                }).ToList()
            }
        };
    }

    private static List<HandleRecordRequest> NormalizeSupplyRequests(List<HandleRecordRequest>? requests)
    {
        if (requests == null || requests.Count == 0)
            return new List<HandleRecordRequest>();

        return requests
            .Where(r => r.SupplyId > 0 && r.QuantityUsed > 0)
            .GroupBy(r => r.SupplyId)
            .Select(g => new HandleRecordRequest
            {
                SupplyId = g.Key,
                QuantityUsed = g.Sum(x => x.QuantityUsed),
                Note = string.Join("；", g.Select(x => x.Note).Where(x => !string.IsNullOrWhiteSpace(x)))
            })
            .ToList();
    }

    private static List<string> FindAllergicSupplies(
        IEnumerable<MedicalHistory> histories,
        IEnumerable<MedicalSupply> supplies)
    {
        var supplyList = supplies.ToList();
        var matches = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var allergyMarkers = new[] { "dị ứng", "過敏", "过敏" };
        var noteMarkers = new[] { "dị ứng với", "dị ứng", "過敏於", "過敏", "过敏于", "过敏", "không dùng", "không được sử dụng" };
        var commonAllergens = new[] { "paracetamol", "aspirin", "ibuprofen", "penicillin", "amoxicillin" };

        foreach (var history in histories)
        {
            var disease = history.DiseaseName ?? string.Empty;
            var note = history.Note ?? string.Empty;
            var combined = $"{disease} {note}";

            if (!allergyMarkers.Any(marker =>
                combined.Contains(marker, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            string allergyName = string.Empty;

            foreach (var marker in allergyMarkers)
            {
                var index = disease.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (index >= 0 && index + marker.Length < disease.Length)
                {
                    allergyName = disease[(index + marker.Length)..].Trim();
                    break;
                }
            }

            if (string.IsNullOrWhiteSpace(allergyName))
            {
                foreach (var marker in noteMarkers)
                {
                    var index = note.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                    if (index >= 0 && index + marker.Length < note.Length)
                    {
                        allergyName = note[(index + marker.Length)..]
                            .Trim()
                            .Split(',', '，', ';', '；')[0]
                            .Trim();
                        break;
                    }
                }
            }

            foreach (var supply in supplyList)
            {
                if (string.IsNullOrWhiteSpace(supply.Name))
                    continue;

                if (!string.IsNullOrWhiteSpace(allergyName) &&
                    supply.Name.Contains(allergyName, StringComparison.OrdinalIgnoreCase))
                {
                    matches.Add($"{supply.Name} (ID: {supply.SupplyId})");
                    continue;
                }

                foreach (var allergen in commonAllergens)
                {
                    if (supply.Name.Contains(allergen, StringComparison.OrdinalIgnoreCase) &&
                        combined.Contains(allergen, StringComparison.OrdinalIgnoreCase))
                    {
                        matches.Add($"{supply.Name} (ID: {supply.SupplyId})");
                        break;
                    }
                }
            }
        }

        return matches.ToList();
    }

    // =============================
    // XÓA MỀM SỰ KIỆN Y TẾ
    // =============================
    public async Task<BaseResponse> DeleteMedicalEvent(int eventId)
    {
        var affected = await _medicalEventRepository.DeleteMedicalEvent(eventId);
        if (affected <= 0)
        {
            return new BaseResponse { Status = StatusCodes.Status404NotFound.ToString(), Message = "Không tìm thấy sự kiện y tế để xóa.", Data = null };
        }
        return new BaseResponse { Status = StatusCodes.Status200OK.ToString(), Message = "Xóa sự kiện y tế thành công.", Data = null };
    }

    public async Task<BaseResponse?> GetMedicalEventsByStudentId(int studentId)
    {
        var events = await _medicalEventRepository.GetMedicalEventByStudentID(studentId);
        if (events == null)
        {
            return new BaseResponse
            {
                Status = StatusCodes.Status404NotFound.ToString(),
                Message = "Không tìm thấy sự kiện y tế cho học sinh này.",
                Data = null
            };
        }
        var histories = new List<MedicalHistory>();
        if (events.StudentId.HasValue)
        {
            histories = await _medicalHistoryRepository.GetAllByStudentIdMedicalHistory(events.StudentId.Value);
        }

        return new BaseResponse
        {
            Status = StatusCodes.Status200OK.ToString(),
            Message = "Lấy sự kiện y tế thành công.",
            Data = new CreateMedicalEventResponse
            {
                EventId = events.EventId,
                StudentId = events.Student?.StudentId ?? 0,
                StudentName = events.Student?.FullName ?? "(Không rõ)",
                ParentName = events.Student?.Parent?.FullName ?? "(Không rõ)",
                EventType = events.EventType?.EventTypeName ?? "(Không rõ)",
                EventDate = events.EventDate,
                Description = events.Description ?? string.Empty,
                HandledById = events.HandledBy,
                HandledByName = events.HandledByNavigation?.FullName ?? "(Không rõ)",
                SeverityLevelName = events.Severity?.SeverityName ?? "(Không rõ)",
                Location = events.Location ?? string.Empty,
                Notes = events.Notes ?? string.Empty,
                SuppliesUsed = events.HandleRecords?.Select(hr => new SupplyUserResponse
                {
                    SupplyId = hr.SupplyId,
                    SupplyName = hr.Supply?.Name ?? "(Không rõ)",
                    QuantityUsed = hr.QuantityUsed,
                    Unit = hr.Supply?.Unit ?? "(Không rõ)",
                    Note = hr.Note
                }).ToList() ?? new List<SupplyUserResponse>(),

                MedicalHistory = histories.Select(h => new MedicalHistoryResponse
                {
                    HistoryId = h.HistoryId,
                    StudentId = h.StudentId,
                    StudentName = h.Student?.FullName ?? "(Không rõ)",
                    DiseaseName = h.DiseaseName ?? "(Không rõ)",
                    DiagnosedDate = h.DiagnosedDate,
                    Note = h.Note ?? string.Empty
                }).ToList()
            }
        };
    }
}
