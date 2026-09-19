namespace School_Medical_Management.API
{
    public static class AppPaths
    {
        public static string RootDirectory { get; } = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "EduHealth-Local-TW");

        public static string DataDirectory { get; } =
            Path.Combine(RootDirectory, "data");

        public static string DatabasePath { get; } =
            Path.Combine(DataDirectory, "eduhealth-local-tw.db");

        public static string UploadDirectory { get; } =
            Path.Combine(RootDirectory, "uploads", "medication");

        public static string InitialCredentialPath { get; } =
            Path.Combine(DataDirectory, "初始登入資訊.txt");

        public static void EnsureDirectories()
        {
            Directory.CreateDirectory(RootDirectory);
            Directory.CreateDirectory(DataDirectory);
            Directory.CreateDirectory(UploadDirectory);
        }
    }
}
