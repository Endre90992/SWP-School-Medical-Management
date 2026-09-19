using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Utils;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Models.Request;

using SchoolMedicalManagement.Service.Interface;
using SchoolMedicalManagement.Models.Response;
using Microsoft.AspNetCore.Http;

namespace SchoolMedicalManagement.Service.Implement
{
    public class AuthService : IAuthService 
    {
        private readonly UserRepository _userRepository;
        private readonly IConfiguration _config;
        public AuthService(
            UserRepository userRepository,
            IConfiguration config)
        {
            _userRepository = userRepository;
            _config = config;
        }


        // First login change password
        public async Task<BaseResponse> ChangePasswordAfterFirstLogin(Guid id, ChangePasswordUserRequest Request)
        {
            var user = await _userRepository.GetUserById(id);
            if (user == null || user.IsFirstLogin == false)
                return new BaseResponse
                {
                    Status = StatusCodes.Status400BadRequest.ToString(),
                    Message = "目前帳號不需要執行首次登入改密碼。",
                    Data = null
                };

            if (string.IsNullOrWhiteSpace(Request.NewPassword) || Request.NewPassword.Length < 10)
                return new BaseResponse
                {
                    Status = StatusCodes.Status400BadRequest.ToString(),
                    Message = "新密碼至少需要 10 個字元。",
                    Data = null
                };

            if (HashPassword.VerifyPassword(Request.NewPassword, user.Password))
                return new BaseResponse
                {
                    Status = StatusCodes.Status400BadRequest.ToString(),
                    Message = "新密碼不可與一次性密碼相同。",
                    Data = null
                };

            user.Password = HashPassword.HashPasswordd(Request.NewPassword);
            user.IsFirstLogin = false;

            await _userRepository.UpdateAsync(user);

            // 初次密碼修改完成後刪除一次性登入資訊，避免明碼長期留在磁碟。
            var dataDirectory = _config["LocalPaths:DataDirectory"]
                ?? Path.Combine(Directory.GetCurrentDirectory(), "data");
            var initialCredentialPath = Path.Combine(dataDirectory, "初始登入資訊.txt");
            if (File.Exists(initialCredentialPath))
            {
                File.Delete(initialCredentialPath);
            }

            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "Đổi mật khẩu thành công.",
                Data = new ChangePasswordUserResponse
                {
                    UserId = user.UserId,
                    FullName = user.FullName,
                    RoleName = user.Role.RoleName,
                    Email = user.Email,
                    Phone = user.Phone,
                    IsFirstLogin = user.IsFirstLogin
                }
            };
        }


        //Login
        public async Task<BaseResponse> Login(LoginUserRequest loginRequest)
        {
            var user = await _userRepository.GetLoginUser(loginRequest);

            if (user == null) {
                return new BaseResponse{
                    Status = StatusCodes.Status401Unauthorized.ToString(),
                    Message = "Tên đăng nhập hoặc mật khẩu không đúng.",
                    Data = null
                }
            ;
            }
            var claims = new[]
            {
        new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
        new Claim(ClaimTypes.Name, user.FullName),
        new Claim(ClaimTypes.Role, user.Role.RoleName)
    };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                _config["Jwt:Issuer"],
                _config["Jwt:Audience"],
                claims,
                expires: DateTime.Now.AddHours(3),
                signingCredentials: creds
            );

            return new BaseResponse
            {
                Status = StatusCodes.Status200OK.ToString(),
                Message = "Đăng nhập thành công.",
                Data = new LoginUserResponse
                {
                    UserId = user.UserId,
                    FullName = user.FullName,
                    RoleName = user.Role.RoleName,
                    IsFirstLogin = user.IsFirstLogin,
                    Token = new JwtSecurityTokenHandler().WriteToken(token)
                }
            };
        }

        // 單機離線版不提供 Email / OTP 密碼重設。
        public Task<BaseResponse> ForgotPasswordAsync(ForgotPasswordRequest request)
            => Task.FromResult(new BaseResponse
            {
                Status = StatusCodes.Status410Gone.ToString(),
                Message = "離線版已停用 Email 密碼重設。",
                Data = null
            });

        public Task<BaseResponse> VerifyOtpAndResetPasswordAsync(VerifyOtpAndResetPasswordRequest request)
            => Task.FromResult(new BaseResponse
            {
                Status = StatusCodes.Status410Gone.ToString(),
                Message = "離線版已停用 OTP 密碼重設。",
                Data = null
            });
    }
}
