using Azure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Models.Response;
using SchoolMedicalManagement.Service.Interface;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MedicationRequestController : ControllerBase
    {
        private readonly IMedicationRequestService _medicationRequestService;

        public MedicationRequestController(IMedicationRequestService medicationRequestService)
        {
            _medicationRequestService = medicationRequestService;
        }

        // ✅ 1. Lấy danh sách đơn thuốc đang chờ duyệt
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingRequests()
        {
            var response = await _medicationRequestService.GetPendingRequestsAsync();
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        // ✅ 2. Xử lý đơn thuốc (duyệt hoặc từ chối)
        [HttpPost("handle")]
        public async Task<IActionResult> HandleMedicationRequest([FromBody] UpdateMedicationRequestStatus request)
        {
            if (request == null || request.RequestID <= 0 || (request.StatusID != 2 && request.StatusID != 3) || request.NurseID == Guid.Empty)
            {
                return BadRequest("Dữ liệu yêu cầu không hợp lệ.");
            }
            var result = await _medicationRequestService.HandleMedicationRequest(request);
            return StatusCode(int.Parse(result.Status ?? "200"), result);
        }

        // ✅ 3. Tạo đơn thuốc mới (cho phép upload ảnh đơn thuốc)
        [HttpPost("create")]
        public async Task<IActionResult> CreateMedicationRequest([FromForm] CreateMedicationRequest request, [FromQuery] Guid parentId)
        {
            if (request == null || request.StudentID <= 0 ||
                string.IsNullOrWhiteSpace(request.MedicationName) ||
                string.IsNullOrWhiteSpace(request.Dosage) ||
                string.IsNullOrWhiteSpace(request.Instructions))
            {
                return BadRequest("Dữ liệu yêu cầu đơn thuốc không hợp lệ.");
            }

            try
            {
                // ✅ Xử lý lưu ảnh nếu có
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
                    var uploadDirectory = Path.Combine(
                        AppContext.BaseDirectory,
                        "wwwroot",
                        "uploads",
                        "medication");
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

                    imagePath = $"/uploads/medication/{fileName}";
                }

                var response = await _medicationRequestService.CreateMedicationRequestAsync(request, parentId, imagePath);

                return StatusCode(int.Parse(response.Status), response);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new BaseResponse { Status = "500", Message = $"Lỗi tạo yêu cầu: {ex.Message}", Data = null });
            }
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAllMedicalRequests()
        {
            var response = await _medicationRequestService.GetAllMedicalRequest();
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [HttpGet("student/{studentId}")]
        public async Task<IActionResult> GetMedicalRequestByStudent(string studentId)
        {
            try
            {
                var response = await _medicationRequestService.GetMedicalRequestByStudentId(studentId);
                return StatusCode(int.Parse(response.Status), response);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, $"Lỗi lấy yêu cầu của học sinh: {ex.Message}");
            }
        }

        // Get medication requests by parent ID
        [HttpGet("parent/{parentId}")]
        public async Task<IActionResult> GetRequestsByParent(Guid parentId)
        {
            var response = await _medicationRequestService.GetRequestsByParentIdAsync(parentId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        // Get medication request by ID
        [HttpGet("{requestId}")]
        public async Task<IActionResult> GetRequestById(int requestId)
        {
            try
            {
                var response = await _medicationRequestService.GetRequestByIdAsync(requestId);
                return StatusCode(int.Parse(response.Status), response);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, $"Lỗi lấy yêu cầu: {ex.Message}");
            }
        }

        // API cập nhật trạng thái tổng quát cho đơn thuốc
        [HttpPut("{requestId}/status")]
        public async Task<IActionResult> UpdateMedicationRequestStatus(int requestId, [FromBody] UpdateMedicationStatusDto dto)
        {
            if (dto == null || dto.StatusId <= 0)
                return BadRequest("Trạng thái không hợp lệ.");

            var response = await _medicationRequestService.UpdateMedicationRequestStatusAsync(requestId, dto);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        // ✅ Lấy danh sách đơn thuốc theo Id trạng thái
        [HttpGet("status/{statusId}")]
        public async Task<IActionResult> GetRequestsByStatusId(int statusId)
        {
            var response = await _medicationRequestService.GetRequestsByStatusIdAsync(statusId);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }
        private static async Task<bool> HasValidImageSignatureAsync(Stream stream, string contentType)
        {
            var header = new byte[8];
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length));
            if (read < 3) return false;

            if (contentType == "image/jpeg")
                return header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;

            if (contentType == "image/png")
            {
                if (read < 8) return false;
                byte[] pngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
                return header.SequenceEqual(pngSignature);
            }

            return false;
        }

    }
}
