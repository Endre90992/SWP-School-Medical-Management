using System.Reflection;

namespace School_Medical_Management.API
{
    public static class LocalStoragePaths
    {
        private static readonly bool IsSingleFile =
            string.IsNullOrEmpty(Assembly.GetExecutingAssembly().Location);

        public static string ApplicationDirectory
        {
            get
            {
                if (IsSingleFile && !string.IsNullOrWhiteSpace(Environment.ProcessPath))
                    return Path.GetDirectoryName(Environment.ProcessPath)!;

                return AppContext.BaseDirectory;
            }
        }

        public static string DataDirectory =>
            Path.Combine(ApplicationDirectory, "data");

        public static string DatabasePath =>
            Path.Combine(DataDirectory, "eduhealth-local-tw.db");

        public static string InitialCredentialPath =>
            Path.Combine(DataDirectory, "初始登入資訊.txt");

        public static string MedicationUploadsDirectory =>
            Path.Combine(DataDirectory, "uploads", "medication");

        public static void EnsureDirectories()
        {
            Directory.CreateDirectory(DataDirectory);
            Directory.CreateDirectory(MedicationUploadsDirectory);
        }
    }
}
