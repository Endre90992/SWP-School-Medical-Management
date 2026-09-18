using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Models.Response;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Service.Interface;
using System.Security.Claims;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MedicationRequestController : ControllerBase
    {
        private const long MaxAttachmentBytes = 10 * 1024 * 1024;

        private readonly IMedicationRequestService _medicationRequestService;
        private readonly MedicationRequestRepository _medicationRequestRepository;

        public MedicationRequestController(
            IMedicationRequestService medicationRequestService,
            MedicationRequestRepository medicationRequestRepository)
        {
            _medicationRequestService = medicationRequestService;
            _medicationRequestRepository = medicationRequestRepository;
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

            var result = await _medicationRequestService.HandleMedicationRequest(request);
            return StatusCode(int.Parse(result.Status ?? "200"), result);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpPost("create")]
        [RequestSizeLimit(MaxAttachmentBytes + 1024 * 1024)]
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

            var currentRole = User.FindFirstValue(ClaimTypes.Role);
            var currentUserIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentRole == "Parent" &&
                (!Guid.TryParse(currentUserIdText, out var currentUserId) || currentUserId != parentId))
            {
                return Forbid();
            }

            string? storedFileName = null;
            try
            {
                if (request.ImageFile is { Length: > 0 })
                {
                    if (request.ImageFile.Length > MaxAttachmentBytes)
                        return BadRequest("附件不可超過 10 MB。");

                    var extension = await DetectImageExtensionAsync(request.ImageFile);
                    if (extension == null)
                        return BadRequest("附件僅接受有效的 JPEG 或 PNG 圖片。");

                    storedFileName = $"{Guid.NewGuid():N}{extension}";
                    var attachmentDir = Path.Combine(
                        AppContext.BaseDirectory,
                        "data",
                        "attachments",
                        "medication");
                    Directory.CreateDirectory(attachmentDir);

                    var savePath = Path.Combine(attachmentDir, storedFileName);
                    await using var stream = new FileStream(
                        savePath,
                        FileMode.CreateNew,
                        FileAccess.Write,
                        FileShare.None,
                        64 * 1024,
                        useAsync: true);
                    await request.ImageFile.CopyToAsync(stream);
                }

                var response = await _medicationRequestService.CreateMedicationRequestAsync(
                    request,
                    parentId,
                    storedFileName);

                return StatusCode(int.Parse(response.Status), response);
            }
            catch
            {
                if (!string.IsNullOrWhiteSpace(storedFileName))
                {
                    var orphan = Path.Combine(
                        AppContext.BaseDirectory,
                        "data",
                        "attachments",
                        "medication",
                        storedFileName);
                    if (System.IO.File.Exists(orphan))
                        System.IO.File.Delete(orphan);
                }

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

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("student/{studentId}")]
        public async Task<IActionResult> GetMedicalRequestByStudent(string studentId)
        {
            var response = await _medicationRequestService.GetMedicalRequestByStudentId(studentId);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("parent/{parentId}")]
        public async Task<IActionResult> GetRequestsByParent(Guid parentId)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role == "Parent")
            {
                var currentUserIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!Guid.TryParse(currentUserIdText, out var currentUserId) || currentUserId != parentId)
                    return Forbid();
            }

            var response = await _medicationRequestService.GetRequestsByParentIdAsync(parentId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("{requestId:int}")]
        public async Task<IActionResult> GetRequestById(int requestId)
        {
            var entity = await _medicationRequestRepository.GetByIdMedical(requestId);
            if (entity == null)
                return NotFound();

            if (!CanAccess(entity.ParentId))
                return Forbid();

            var response = await _medicationRequestService.GetRequestByIdAsync(requestId);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Nurse,Manager,Parent")]
        [HttpGet("{requestId:int}/attachment")]
        public async Task<IActionResult> GetAttachment(int requestId)
        {
            var entity = await _medicationRequestRepository.GetByIdMedical(requestId);
            if (entity == null || string.IsNullOrWhiteSpace(entity.ImagePath))
                return NotFound();

            if (!CanAccess(entity.ParentId))
                return Forbid();

            var fileName = Path.GetFileName(entity.ImagePath);
            if (string.IsNullOrWhiteSpace(fileName))
                return NotFound();

            var filePath = Path.Combine(
                AppContext.BaseDirectory,
                "data",
                "attachments",
                "medication",
                fileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound();

            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            var contentType = extension == ".png" ? "image/png" : "image/jpeg";
            return PhysicalFile(filePath, contentType, enableRangeProcessing: false);
        }

        [Authorize(Roles = "Nurse,Manager,Parent")]
        [HttpPut("{requestId:int}/status")]
        public async Task<IActionResult> UpdateMedicationRequestStatus(
            int requestId,
            [FromBody] UpdateMedicationStatusDto dto)
        {
            if (dto == null || dto.StatusId <= 0)
                return BadRequest("用藥狀態無效。");

            var entity = await _medicationRequestRepository.GetByIdMedical(requestId);
            if (entity == null)
                return NotFound();

            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role == "Parent")
            {
                if (!CanAccess(entity.ParentId) || dto.StatusId != 6)
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

        private bool CanAccess(Guid parentId)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role is "Nurse" or "Manager")
                return true;

            if (role != "Parent")
                return false;

            var currentUserIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(currentUserIdText, out var currentUserId) && currentUserId == parentId;
        }

        private static async Task<string?> DetectImageExtensionAsync(IFormFile file)
        {
            var header = new byte[8];
            await using var input = file.OpenReadStream();
            var read = await input.ReadAsync(header.AsMemory(0, header.Length));

            if (read >= 8 &&
                header[0] == 0x89 && header[1] == 0x50 &&
                header[2] == 0x4E && header[3] == 0x47 &&
                header[4] == 0x0D && header[5] == 0x0A &&
                header[6] == 0x1A && header[7] == 0x0A)
            {
                return ".png";
            }

            if (read >= 3 &&
                header[0] == 0xFF &&
                header[1] == 0xD8 &&
                header[2] == 0xFF)
            {
                return ".jpg";
            }

            return null;
        }
    }
}
