using Microsoft.EntityFrameworkCore;
using SchoolMedicalManagement.Models.Entity;
using System.Data.Common;

namespace School_Medical_Management.API
{
    public static class LocalDatabaseOptimizer
    {
        private static readonly string[] Commands =
        {
            "PRAGMA foreign_keys=ON;",
            "PRAGMA journal_mode=WAL;",
            "PRAGMA synchronous=NORMAL;",
            "PRAGMA busy_timeout=5000;",
            "PRAGMA temp_store=MEMORY;",

            "CREATE INDEX IF NOT EXISTS IX_MedicalEvent_Active_Date ON MedicalEvent (IsActive, EventDate DESC);",
            "CREATE INDEX IF NOT EXISTS IX_MedicalEvent_Student_Active_Date ON MedicalEvent (StudentID, IsActive, EventDate DESC);",

            "CREATE INDEX IF NOT EXISTS IX_MedicationRequest_Active_Status_Date ON MedicationRequest (IsActive, StatusID, RequestDate DESC);",
            "CREATE INDEX IF NOT EXISTS IX_MedicationRequest_Student_Active_Date ON MedicationRequest (StudentID, IsActive, RequestDate DESC);",
            "CREATE INDEX IF NOT EXISTS IX_MedicationRequest_Parent_Active_Date ON MedicationRequest (ParentID, IsActive, RequestDate DESC);",

            "CREATE INDEX IF NOT EXISTS IX_Notification_Receiver_Date ON Notification (ReceiverID, SentDate DESC);",
            "CREATE INDEX IF NOT EXISTS IX_Student_Class_Active ON Student (Class, IsActive);",
            "CREATE INDEX IF NOT EXISTS IX_MedicalHistory_Student ON MedicalHistory (StudentID);",

            "CREATE INDEX IF NOT EXISTS IX_HealthCheckSummary_Campaign_Student ON HealthCheckSummary (CampaignID, StudentID);",
            "CREATE INDEX IF NOT EXISTS IX_VaccinationConsent_Campaign_Student ON VaccinationConsentRequest (CampaignID, StudentID);",
            "CREATE INDEX IF NOT EXISTS IX_VaccinationConsent_Campaign_Status ON VaccinationConsentRequest (CampaignID, ConsentStatusID);",
            "CREATE INDEX IF NOT EXISTS IX_VaccinationRecord_Campaign_Active ON VaccinationRecord (CampaignID, IsActive);",

            "PRAGMA optimize;"
        };

        public static async Task OptimizeAsync(SwpEduHealV5Context db)
        {
            var connection = db.Database.GetDbConnection();
            var shouldClose = connection.State != System.Data.ConnectionState.Open;

            if (shouldClose)
                await connection.OpenAsync();

            try
            {
                foreach (var sql in Commands)
                {
                    await using var command = connection.CreateCommand();
                    command.CommandText = sql;

                    // journal_mode 會回傳目前模式；ExecuteScalar 也能安全執行其他 PRAGMA / DDL。
                    await command.ExecuteScalarAsync();
                }
            }
            finally
            {
                if (shouldClose)
                    await connection.CloseAsync();
            }
        }
    }
}
