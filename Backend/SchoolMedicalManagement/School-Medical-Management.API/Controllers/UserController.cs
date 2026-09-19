using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Service.Interface;
using System.Security.Claims;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IUserService _userService;

        public UserController(IAuthService authService, IUserService userService)
        {
            _authService = authService;
            _userService = userService;
        }

        [AllowAnonymous]
        [EnableRateLimiting("LoginLimit")]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginUserRequest loginRequest)
        {
            var response = await _authService.Login(loginRequest);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Manager")]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var response = await _userService.GetAllUserAsync();
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Manager")]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetUserById([FromRoute] Guid id)
        {
            var response = await _userService.GetUserByIdAsync(id);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Manager")]
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            var response = await _userService.CreateUserAsync(request);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Manager")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var response = await _userService.SoftDeleteUserAsync(id);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Manager")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
        {
            var response = await _userService.UpdateUserAsync(id, request);
            return StatusCode(int.Parse(response.Status), response);
        }

        // 首次登入改密碼只能修改自己的帳號。
        [Authorize]
        [HttpPost("change-password-firstlogin/{id}")]
        public async Task<IActionResult> ChangePasswordAfterFirstLogin(
            [FromRoute] Guid id,
            [FromBody] ChangePasswordUserRequest request)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(currentUserId, out var authenticatedUserId) || authenticatedUserId != id)
                return Forbid();

            var response = await _authService.ChangePasswordAfterFirstLogin(id, request);
            return StatusCode(int.Parse(response.Status), response);
        }

        // 單機離線版不使用 Email/OTP 重設密碼，避免任何不必要的網路依賴。
        [AllowAnonymous]
        [HttpPost("forgot-password")]
        public IActionResult ForgotPassword()
            => StatusCode(StatusCodes.Status410Gone, new
            {
                status = "410",
                message = "離線版已停用 Email 密碼重設。請由本機管理者處理帳號。"
            });

        [AllowAnonymous]
        [HttpPost("verify-otp-reset-password")]
        public IActionResult VerifyOtpAndResetPassword()
            => StatusCode(StatusCodes.Status410Gone, new
            {
                status = "410",
                message = "離線版已停用 OTP 密碼重設。"
            });
    }
}
