using System.Reflection;

namespace School_Medical_Management.API
{
    public static class EmbeddedFrontend
    {
        private static readonly Assembly Assembly = typeof(EmbeddedFrontend).Assembly;

        public static bool TryOpen(string requestPath, out Stream? stream, out string contentType)
        {
            stream = null;
            contentType = "application/octet-stream";

            var path = requestPath.TrimStart('/').Replace('\\', '/');
            if (string.IsNullOrWhiteSpace(path))
                path = "index.html";

            if (path.Contains("..", StringComparison.Ordinal))
                return false;

            var resourceName = $"wwwroot/{path}";
            stream = Assembly.GetManifestResourceStream(resourceName);
            if (stream == null)
                return false;

            contentType = GetContentType(path);
            return true;
        }

        public static Stream? OpenIndex()
            => Assembly.GetManifestResourceStream("wwwroot/index.html");

        private static string GetContentType(string path)
            => Path.GetExtension(path).ToLowerInvariant() switch
            {
                ".html" => "text/html; charset=utf-8",
                ".js" => "text/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" => "application/json; charset=utf-8",
                ".svg" => "image/svg+xml",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".ico" => "image/x-icon",
                ".woff" => "font/woff",
                ".woff2" => "font/woff2",
                ".ttf" => "font/ttf",
                ".map" => "application/json",
                _ => "application/octet-stream"
            };
    }
}
