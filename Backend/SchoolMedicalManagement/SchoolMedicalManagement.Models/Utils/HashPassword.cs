using System.Security.Cryptography;
using System.Text;

namespace SchoolMedicalManagement.Models.Utils
{
    public static class HashPassword
    {
        private const int WorkFactor = 12;

        public static string HashPasswordd(string rawPassword)
        {
            if (string.IsNullOrWhiteSpace(rawPassword))
                throw new ArgumentException("密碼不得為空白。", nameof(rawPassword));

            return BCrypt.Net.BCrypt.HashPassword(rawPassword, workFactor: WorkFactor);
        }

        public static bool VerifyPassword(string rawPassword, string storedHash)
        {
            if (string.IsNullOrEmpty(rawPassword) || string.IsNullOrEmpty(storedHash))
                return false;

            if (storedHash.StartsWith("$2", StringComparison.Ordinal))
                return BCrypt.Net.BCrypt.Verify(rawPassword, storedHash);

            // 相容原專案舊的 SHA-256 密碼；登入成功後由 Repository 自動升級成 BCrypt。
            using var sha256 = SHA256.Create();
            var legacyHash = Convert.ToBase64String(
                sha256.ComputeHash(Encoding.UTF8.GetBytes(rawPassword))
            );
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(legacyHash),
                Encoding.UTF8.GetBytes(storedHash)
            );
        }
    }
}
