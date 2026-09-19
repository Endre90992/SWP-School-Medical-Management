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
    [Authorize]
    public class MedicationRequestController : ControllerBase
    {
        private const long MaxImageBytes = 5 * 1024 * 1024;

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
                (request.StatusID != 2 && request.StatusID != 3))
                return BadRequest("用藥申請資料不正確。");

            if (User.IsInRole("Nurse"))
            {
                var currentUserId = GetCurrentUserId();
                if (!currentUserId.HasValue) return Forbid();
                request.NurseID = currentUserId.Value;
            }
            else if (request.NurseID == Guid.Empty)
            {
                var currentUserId = GetCurrentUserId();
                if (!currentUserId.HasValue) return Forbid();
                request.NurseID = currentUserId.Value;
            }

            var result = await _medicationRequestService.HandleMedicationRequest(request);
            return StatusCode(int.Parse(result.Status ?? "200"), result);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpPost("create")]
        [RequestSizeLimit(MaxImageBytes + 1024 * 1024)]
        public async Task<IActionResult> CreateMedicationRequest(
            [FromForm] CreateMedicationRequest request,
            [FromQuery] Guid parentId)
        {
            if (request == null || request.StudentID <= 0 ||
                string.IsNullOrWhiteSpace(request.MedicationName) ||
                string.IsNullOrWhiteSpace(request.Dosage) ||
                string.IsNullOrWhiteSpace(request.Instructions))
                return BadRequest("用藥申請資料不完整。");

            if (User.IsInRole("Parent") && GetCurrentUserId() != parentId)
                return Forbid();

            string? storedFileName = null;
            string? fullPath = null;

            try
            {
                if (request.ImageFile is { Length: > 0 })
                {
                    var validation = await ValidateImageAsync(request.ImageFile);
                    if (!validation.IsValid)
                        return BadRequest(validation.Message);

                    LocalAppPaths.EnsureDirectories();
                    storedFileName = $"{Guid.NewGuid():N}{validation.Extension}";
                    fullPath = Path.Combine(LocalAppPaths.MedicationImagesDirectory, storedFileName);

                    await using var input = request.ImageFile.OpenReadStream();
                    await using var output = new FileStream(
                        fullPath,
                        FileMode.CreateNew,
                        FileAccess.Write,
                        FileShare.None,
                        81920,
                        useAsync: true);
                    await input.CopyToAsync(output);
                }

                var response = await _medicationRequestService.CreateMedicationRequestAsync(
                    request,
                    parentId,
                    storedFileName);

                if (!int.TryParse(response.Status, out var statusCode))
                    statusCode = StatusCodes.Status200OK;

                if (statusCode >= 400 && fullPath != null && System.IO.File.Exists(fullPath))
                    System.IO.File.Delete(fullPath);

                return StatusCode(statusCode, response);
            }
            catch
            {
                if (fullPath != null && System.IO.File.Exists(fullPath))
                    System.IO.File.Delete(fullPath);
                throw;
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
            var response = await _medicationRequestService.GetMedicalRequestByStudentId(studentId);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("parent/{parentId:guid}")]
        public async Task<IActionResult> GetRequestsByParent(Guid parentId)
        {
            if (User.IsInRole("Parent") && GetCurrentUserId() != parentId)
                return Forbid();

            var response = await _medicationRequestService.GetRequestsByParentIdAsync(parentId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("{requestId:int}")]
        public async Task<IActionResult> GetRequestById(int requestId)
        {
            if (!await CanAccessRequestAsync(requestId))
                return Forbid();

            var response = await _medicationRequestService.GetRequestByIdAsync(requestId);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("{requestId:int}/image")]
        public async Task<IActionResult> GetMedicationImage(int requestId)
        {
            var entity = await _db.MedicationRequests
                .AsNoTracking()
                .Where(r => r.RequestId == requestId && r.IsActive == true)
                .Select(r => new { r.ParentId, r.ImagePath })
                .FirstOrDefaultAsync();

            if (entity == null || string.IsNullOrWhiteSpace(entity.ImagePath))
                return NotFound();

            if (User.IsInRole("Parent") && GetCurrentUserId() != entity.ParentId)
                return Forbid();

            var fileName = Path.GetFileName(entity.ImagePath);
            var filePath = Path.Combine(LocalAppPaths.MedicationImagesDirectory, fileName);
            if (!System.IO.File.Exists(filePath))
                return NotFound();

            var contentType = Path.GetExtension(fileName).ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };

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

            if (User.IsInRole("Parent"))
            {
                if (dto.StatusId != 6 || !await CanAccessRequestAsync(requestId))
                    return Forbid();
            }

            var response = await _medicationRequestService.UpdateMedicationRequestStatusAsync(requestId, dto);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet("status/{statusId:int}")]
        public async Task<IActionResult> GetRequestsByStatusId(int statusId)
        {
            var response = await _medicationRequestService.GetRequestsByStatusIdAsync(statusId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        private Guid? GetCurrentUserId()
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id) ? id : null;
        }

        private async Task<bool> CanAccessRequestAsync(int requestId)
        {
            if (User.IsInRole("Nurse") || User.IsInRole("Manager"))
                return true;

            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
                return false;

            return await _db.MedicationRequests
                .AsNoTracking()
                .AnyAsync(r =>
                    r.RequestId == requestId &&
                    r.ParentId == currentUserId.Value &&
                    r.IsActive == true);
        }

        private static async Task<(bool IsValid, string Message, string Extension)> ValidateImageAsync(
            IFormFile file)
        {
            if (file.Length <= 0 || file.Length > MaxImageBytes)
                return (false, "圖片大小必須在 5 MB 以內。", string.Empty);

            var expected = file.ContentType.ToLowerInvariant() switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                _ => string.Empty
            };

            if (string.IsNullOrEmpty(expected))
                return (false, "只允許 JPEG、PNG 或 WebP 圖片。", string.Empty);

            var header = new byte[12];
            await using var stream = file.OpenReadStream();
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length));

            var valid = expected switch
            {
                ".jpg" => read >= 3 &&
                          header[0] == 0xFF &&
                          header[1] == 0xD8 &&
                          header[2] == 0xFF,
                ".png" => read >= 8 &&
                          header[0] == 0x89 &&
                          header[1] == 0x50 &&
                          header[2] == 0x4E &&
                          header[3] == 0x47 &&
                          header[4] == 0x0D &&
                          header[5] == 0x0A &&
                          header[6] == 0x1A &&
                          header[7] == 0x0A,
                ".webp" => read >= 12 &&
                           header[0] == 0x52 &&
                           header[1] == 0x49 &&
                           header[2] == 0x46 &&
                           header[3] == 0x46 &&
                           header[8] == 0x57 &&
                           header[9] == 0x45 &&
                           header[10] == 0x42 &&
                           header[11] == 0x50,
                _ => false
            };

            return valid
                ? (true, string.Empty, expected)
                : (false, "圖片內容與檔案類型不符。", string.Empty);
        }
    }
}
