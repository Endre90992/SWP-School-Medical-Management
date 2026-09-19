namespace School_Medical_Management.API
{
    public static class LocalAppPaths
    {
        public static string RootDirectory { get; } =
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "EduHealth-Local-TW");

        public static string DataDirectory { get; } =
            Path.Combine(RootDirectory, "data");

        public static string DatabaseFile { get; } =
            Path.Combine(DataDirectory, "eduhealth-local-tw.db");

        public static string InitialCredentialFile { get; } =
            Path.Combine(DataDirectory, "初始登入資訊.txt");

        public static string MedicationImagesDirectory { get; } =
            Path.Combine(DataDirectory, "medication-images");

        public static string BackupDirectory { get; } =
            Path.Combine(RootDirectory, "backups");

        public static void EnsureDirectories()
        {
            Directory.CreateDirectory(RootDirectory);
            Directory.CreateDirectory(DataDirectory);
            Directory.CreateDirectory(MedicationImagesDirectory);
            Directory.CreateDirectory(BackupDirectory);
        }
    }
}
