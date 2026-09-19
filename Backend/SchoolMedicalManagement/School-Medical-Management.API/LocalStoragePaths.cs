namespace School_Medical_Management.API
{
    public static class LocalStoragePaths
    {
        public static string ApplicationDirectory
        {
            get
            {
                // Published apphost / single-file executables should always keep mutable
                // data beside the real executable. With IncludeAllContentForSelfExtract,
                // Assembly.Location points at the temporary extraction directory, so it
                // cannot be used to identify the application directory.
                var processPath = Environment.ProcessPath;
                if (!string.IsNullOrWhiteSpace(processPath))
                {
                    var processName = Path.GetFileNameWithoutExtension(processPath);
                    if (!string.Equals(processName, "dotnet", StringComparison.OrdinalIgnoreCase))
                    {
                        var processDirectory = Path.GetDirectoryName(processPath);
                        if (!string.IsNullOrWhiteSpace(processDirectory))
                            return processDirectory;
                    }
                }

                // Development / framework-dependent execution via `dotnet app.dll`.
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
