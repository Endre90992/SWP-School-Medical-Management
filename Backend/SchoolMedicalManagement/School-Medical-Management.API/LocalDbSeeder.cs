using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Utils;

namespace School_Medical_Management.API
{
    public static class LocalDbSeeder
    {
        public static async Task SeedAsync(SwpEduHealV5Context db, IConfiguration configuration)
        {
            if (!await db.Roles.AnyAsync())
            {
                await db.Roles.AddRangeAsync(
                    new Role { RoleName = "Manager" },
                    new Role { RoleName = "Nurse" },
                    new Role { RoleName = "Parent" });
                await db.SaveChangesAsync();
            }

            if (!await db.GenderTypes.AnyAsync())
            {
                await db.GenderTypes.AddRangeAsync(
                    new GenderType { GenderName = "男" },
                    new GenderType { GenderName = "女" },
                    new GenderType { GenderName = "其他／未填" });
                await db.SaveChangesAsync();
            }

            if (!await db.SeverityLevels.AnyAsync())
            {
                await db.SeverityLevels.AddRangeAsync(
                    new SeverityLevel { SeverityName = "輕度" },
                    new SeverityLevel { SeverityName = "中度" },
                    new SeverityLevel { SeverityName = "重度" });
                await db.SaveChangesAsync();
            }

            if (!await db.MedicalEventTypes.AnyAsync())
            {
                await db.MedicalEventTypes.AddRangeAsync(
                    new MedicalEventType { EventTypeName = "擦傷／割傷" },
                    new MedicalEventType { EventTypeName = "跌倒／撞傷" },
                    new MedicalEventType { EventTypeName = "扭傷／拉傷" },
                    new MedicalEventType { EventTypeName = "頭痛／暈眩" },
                    new MedicalEventType { EventTypeName = "腹痛／腸胃不適" },
                    new MedicalEventType { EventTypeName = "發燒／身體不適" },
                    new MedicalEventType { EventTypeName = "鼻血" },
                    new MedicalEventType { EventTypeName = "其他" });
                await db.SaveChangesAsync();
            }

            if (!await db.MedicationRequestStatuses.AnyAsync())
            {
                await db.MedicationRequestStatuses.AddRangeAsync(
                    new MedicationRequestStatus { StatusName = "待審核" },
                    new MedicationRequestStatus { StatusName = "已核准" },
                    new MedicationRequestStatus { StatusName = "已拒絕" },
                    new MedicationRequestStatus { StatusName = "已排程" },
                    new MedicationRequestStatus { StatusName = "已完成" },
                    new MedicationRequestStatus { StatusName = "已取消" });
                await db.SaveChangesAsync();
            }

            if (!await db.NotificationTypes.AnyAsync())
            {
                await db.NotificationTypes.AddRangeAsync(
                    new NotificationType { TypeName = "一般通知" },
                    new NotificationType { TypeName = "傷病通知" },
                    new NotificationType { TypeName = "預防接種" },
                    new NotificationType { TypeName = "健康檢查" });
                await db.SaveChangesAsync();
            }

            if (!await db.ConsentStatusTypes.AnyAsync())
            {
                await db.ConsentStatusTypes.AddRangeAsync(
                    new ConsentStatusType { ConsentStatusName = "待回覆" },
                    new ConsentStatusType { ConsentStatusName = "同意" },
                    new ConsentStatusType { ConsentStatusName = "不同意" });
                await db.SaveChangesAsync();
            }

            if (!await db.CampaignStatuses.AnyAsync())
            {
                await db.CampaignStatuses.AddRangeAsync(
                    new CampaignStatus { StatusName = "尚未開始" },
                    new CampaignStatus { StatusName = "進行中" },
                    new CampaignStatus { StatusName = "已完成" },
                    new CampaignStatus { StatusName = "已取消" });
                await db.SaveChangesAsync();
            }

            if (!await db.Users.AnyAsync())
            {
                var nurseRole = await db.Roles.SingleAsync(r => r.RoleName == "Nurse");
                var username = configuration["LocalBootstrap:DefaultNurseUsername"] ?? "nurse";
                var password = configuration["LocalBootstrap:DefaultNursePassword"];
                var generatedPassword = false;

                if (string.IsNullOrWhiteSpace(password))
                {
                    password = $"Eh!{Convert.ToHexString(RandomNumberGenerator.GetBytes(8))}";
                    generatedPassword = true;
                }

                await db.Users.AddAsync(new User
                {
                    Username = username,
                    Password = HashPassword.HashPasswordd(password),
                    FullName = "健康中心護理師",
                    RoleId = nurseRole.RoleId,
                    IsFirstLogin = true,
                    IsActive = true
                });

                await db.SaveChangesAsync();

                if (generatedPassword)
                {
                    var credentialPath =
                        configuration["LocalStorage:InitialCredentialPath"]
                        ?? LocalStoragePaths.InitialCredentialPath;
                    Directory.CreateDirectory(Path.GetDirectoryName(credentialPath)!);
                    await File.WriteAllTextAsync(
                        credentialPath,
                        $"EduHealth Local TW 初始登入資訊{Environment.NewLine}" +
                        $"帳號：{username}{Environment.NewLine}" +
                        $"一次性密碼：{password}{Environment.NewLine}" +
                        "首次登入後請立即修改密碼；修改成功後此檔案會自動刪除。"
                    );
                    Console.WriteLine($"[EduHealth] 初始登入資訊已建立：{credentialPath}");
                }
            }
        }
    }
}
