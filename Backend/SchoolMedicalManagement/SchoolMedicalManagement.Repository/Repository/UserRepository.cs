using Microsoft.EntityFrameworkCore;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Models.Utils;

namespace SchoolMedicalManagement.Repository.Repository
{
    public class UserRepository : GenericRepository<User>
    {
        public UserRepository(SwpEduHealV5Context context) : base(context)
        {
        }

        public async Task<User?> GetLoginUser(LoginUserRequest loginRequest)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u =>
                    u.Username == loginRequest.Username &&
                    u.IsActive == true);

            if (user == null || !HashPassword.VerifyPassword(loginRequest.Password, user.Password))
                return null;

            // 舊資料若仍使用 SHA-256，登入成功後立即升級成 BCrypt。
            if (!user.Password.StartsWith("$2", StringComparison.Ordinal))
            {
                user.Password = HashPassword.HashPasswordd(loginRequest.Password);
                await _context.SaveChangesAsync();
            }

            return user;
        }

        public async Task<List<User>> GetAllUser()
        {
            return await _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .ToListAsync();
        }


        public async Task<Dictionary<int, int>> GetActiveUserCountsByRoleAsync()
        {
            return await _context.Users
                .AsNoTracking()
                .Where(u => u.IsActive == true)
                .GroupBy(u => u.RoleId)
                .Select(g => new { RoleId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.RoleId, x => x.Count);
        }

        public async Task<User?> GetUserById(Guid id)
        {
            return await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserId == id);
        }

        public async Task<User?> GetUserByUsername(string username)
        {
            return await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Username == username);
        }

        public async Task<User?> CreateUser(User user)
        {
            await CreateAsync(user);
            return await GetUserById(user.UserId);
        }

        public async Task<bool> HardDeleteUser(Guid id)
        {
            var user = await GetUserById(id);
            if (user == null) return false;
            return await RemoveAsync(user);
        }

        public async Task<User?> UpdateUser(User user)
        {
            await UpdateAsync(user);
            return await GetUserById(user.UserId);
        }

        public Task<User?> GetUserById(Guid id, ChangePasswordUserRequest request)
        {
            return _context.Users.FirstOrDefaultAsync(u => u.UserId == id);
        }

        public async Task<bool> SoftDeleteUser(Guid id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == id);
            if (user == null) return false;

            user.IsActive = false;
            await UpdateAsync(user);
            return true;
        }

        public async Task<User?> GetUserByEmail(string email)
        {
            return await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email == email && u.IsActive == true);
        }

        public async Task<List<VaccinationConsentRequest>> GetConsentRequestsByStudentIds(List<int> studentIds)
        {
            return await _context.VaccinationConsentRequests
                .Include(v => v.Campaign)
                .Include(v => v.ConsentStatus)
                .Include(v => v.Student)
                .Where(v => studentIds.Contains(v.StudentId))
                .ToListAsync();
        }
    }
}
