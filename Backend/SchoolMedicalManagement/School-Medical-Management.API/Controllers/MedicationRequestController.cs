using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Models.Response;
using SchoolMedicalManagement.Service.Interface;
using System.Security.Claims;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MedicationRequestController : ControllerBase
    {
        private readonly IMedicationRequestService _medicationRequestService;
        private readonly SwpEduHealV5Context _db;

        public MedicationRequestController(
            IMedicationRequestService medicationRequestService,
            SwpEduHealV5Context db)
        {
            _medicationRequestService = medicationRequestService;
            _db = db;
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingRequests()
        {
            var response = await _medicationRequestService.GetPendingRequestsAsync();
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpPost("handle")]
        public async Task<IActionResult> HandleMedicationRequest([FromBody] UpdateMedicationRequestStatus request)
        {
            if (request == null || request.RequestID <= 0 ||
                (request.StatusID != 2 && request.StatusID != 3) ||
                request.NurseID == Guid.Empty)
            {
                return BadRequest("用藥申請資料不完整。");
            }

            if (!TryGetCurrentUserId(out var currentUserId) || request.NurseID != currentUserId)
                return Forbid();

            var result = await _medicationRequestService.HandleMedicationRequest(request);
            return StatusCode(int.Parse(result.Status ?? "200"), result);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpPost("create")]
        [RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<IActionResult> CreateMedicationRequest(
            [FromForm] CreateMedicationRequest request,
            [FromQuery] Guid parentId)
        {
            if (request == null || request.StudentID <= 0 ||
                string.IsNullOrWhiteSpace(request.MedicationName) ||
                string.IsNullOrWhiteSpace(request.Dosage) ||
                string.IsNullOrWhiteSpace(request.Instructions))
            {
                return BadRequest("用藥申請資料不完整。");
            }

            if (User.IsInRole("Parent"))
            {
                if (!TryGetCurrentUserId(out var currentParentId) || currentParentId != parentId)
                    return Forbid();
            }

            var studentBelongsToParent = await _db.Students
                .AsNoTracking()
                .AnyAsync(student =>
                    student.StudentId == request.StudentID &&
                    student.ParentId == parentId &&
                    student.IsActive != false);

            if (!studentBelongsToParent)
                return BadRequest("學生與家長資料不一致，無法建立用藥申請。");

            try
            {
                string? imagePath = null;
                if (request.ImageFile != null && request.ImageFile.Length > 0)
                {
                    const long maxImageBytes = 5 * 1024 * 1024;
                    if (request.ImageFile.Length > maxImageBytes)
                        return BadRequest("藥袋／藥品照片不可超過 5 MB。");

                    var contentType = request.ImageFile.ContentType?.ToLowerInvariant();
                    var extension = contentType switch
                    {
                        "image/jpeg" => ".jpg",
                        "image/png" => ".png",
                        _ => null
                    };

                    if (extension == null)
                        return BadRequest("只允許上傳 JPG 或 PNG 圖片。");

                    await using var input = request.ImageFile.OpenReadStream();
                    if (!await HasValidImageSignatureAsync(input, contentType))
                        return BadRequest("圖片內容與檔案格式不符，已拒絕上傳。");

                    input.Position = 0;
                    var fileName = $"{Guid.NewGuid():N}{extension}";
                    var uploadDirectory = LocalStoragePaths.MedicationUploadsDirectory;
                    Directory.CreateDirectory(uploadDirectory);

                    var savePath = Path.Combine(uploadDirectory, fileName);
                    await using (var stream = new FileStream(
                        savePath,
                        FileMode.CreateNew,
                        FileAccess.Write,
                        FileShare.None,
                        81920,
                        FileOptions.Asynchronous | FileOptions.WriteThrough))
                    {
                        await input.CopyToAsync(stream);
                    }

                    // DB 僅保存內部檔名資訊；實際讀取一律經過受保護的 attachment API。
                    imagePath = $"/uploads/medication/{fileName}";
                }

                var response = await _medicationRequestService
                    .CreateMedicationRequestAsync(request, parentId, imagePath);

                return StatusCode(int.Parse(response.Status), response);
            }
            catch (Exception)
            {
                // 不把內部例外細節回傳給用戶端。
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new BaseResponse
                    {
                        Status = "500",
                        Message = "建立用藥申請時發生錯誤。",
                        Data = null
                    });
            }
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAllMedicalRequests()
        {
            var response = await _medicationRequestService.GetAllMedicalRequest();
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet("student/{studentId}")]
        public async Task<IActionResult> GetMedicalRequestByStudent(string studentId)
        {
            try
            {
                var response = await _medicationRequestService.GetMedicalRequestByStudentId(studentId);
                return StatusCode(int.Parse(response.Status), response);
            }
            catch (Exception)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "取得學生用藥申請時發生錯誤。");
            }
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("parent/{parentId:guid}")]
        public async Task<IActionResult> GetRequestsByParent(Guid parentId)
        {
            if (User.IsInRole("Parent") &&
                (!TryGetCurrentUserId(out var currentParentId) || currentParentId != parentId))
            {
                return Forbid();
            }

            var response = await _medicationRequestService.GetRequestsByParentIdAsync(parentId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("{requestId:int}")]
        public async Task<IActionResult> GetRequestById(int requestId)
        {
            if (!await CanAccessRequestAsync(requestId))
                return Forbid();

            try
            {
                var response = await _medicationRequestService.GetRequestByIdAsync(requestId);
                return StatusCode(int.Parse(response.Status), response);
            }
            catch (Exception)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "取得用藥申請時發生錯誤。");
            }
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("{requestId:int}/attachment")]
        public async Task<IActionResult> GetAttachment(int requestId)
        {
            if (!await CanAccessRequestAsync(requestId))
                return Forbid();

            var attachment = await _db.MedicationRequests
                .AsNoTracking()
                .Where(request => request.RequestId == requestId && request.IsActive != false)
                .Select(request => request.ImagePath)
                .SingleOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(attachment))
                return NotFound();

            var fileName = Path.GetFileName(attachment);
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            var contentType = extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                _ => null
            };

            if (contentType == null)
                return NotFound();

            var filePath = Path.Combine(LocalStoragePaths.MedicationUploadsDirectory, fileName);
            if (!System.IO.File.Exists(filePath))
                return NotFound();

            Response.Headers["Cache-Control"] = "no-store, max-age=0";
            Response.Headers["Pragma"] = "no-cache";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return PhysicalFile(filePath, contentType, enableRangeProcessing: false);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpPut("{requestId:int}/status")]
        public async Task<IActionResult> UpdateMedicationRequestStatus(
            int requestId,
            [FromBody] UpdateMedicationStatusDto dto)
        {
            if (dto == null || dto.StatusId <= 0)
                return BadRequest("狀態不正確。");

            var current = await _db.MedicationRequests
                .AsNoTracking()
                .Where(request => request.RequestId == requestId && request.IsActive != false)
                .Select(request => new
                {
                    request.ParentId,
                    request.StatusId
                })
                .SingleOrDefaultAsync();

            if (current == null)
                return NotFound();

            if (User.IsInRole("Parent"))
            {
                if (!TryGetCurrentUserId(out var currentParentId) ||
                    current.ParentId != currentParentId)
                {
                    return Forbid();
                }

                // 家長只能取消自己的待審核／已核准申請。
                if (dto.StatusId != 6 || (current.StatusId != 1 && current.StatusId != 2))
                    return Forbid();
            }
            else if (!IsStaff())
            {
                return Forbid();
            }
            else if (dto.StatusId is < 1 or > 6)
            {
                return BadRequest("狀態不正確。");
            }

            var response = await _medicationRequestService
                .UpdateMedicationRequestStatusAsync(requestId, dto);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet("status/{statusId:int}")]
        public async Task<IActionResult> GetRequestsByStatusId(int statusId)
        {
            var response = await _medicationRequestService.GetRequestsByStatusIdAsync(statusId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        private bool IsStaff() =>
            User.IsInRole("Nurse") || User.IsInRole("Manager");

        private bool TryGetCurrentUserId(out Guid userId) =>
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

        private async Task<bool> CanAccessRequestAsync(int requestId)
        {
            if (IsStaff())
                return true;

            if (!User.IsInRole("Parent") || !TryGetCurrentUserId(out var parentId))
                return false;

            return await _db.MedicationRequests
                .AsNoTracking()
                .AnyAsync(request =>
                    request.RequestId == requestId &&
                    request.ParentId == parentId &&
                    request.IsActive != false);
        }

        private static async Task<bool> HasValidImageSignatureAsync(
            Stream stream,
            string contentType)
        {
            var header = new byte[8];
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length));
            if (read < 3)
                return false;

            if (contentType == "image/jpeg")
                return header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;

            if (contentType == "image/png")
            {
                if (read < 8)
                    return false;

                byte[] pngSignature =
                    { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
                return header.SequenceEqual(pngSignature);
            }

            return false;
        }
    }
}
