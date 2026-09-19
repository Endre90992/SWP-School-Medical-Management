using Hangfire;
using Hangfire.MemoryStorage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;
using School_Medical_Management.API;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Service.Implement;
using SchoolMedicalManagement.Service.Interface;
using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;

var embeddedWebRoot = PrepareEmbeddedFrontend();

var builderOptions = new WebApplicationOptions
{
    Args = args,
    WebRootPath = string.IsNullOrWhiteSpace(embeddedWebRoot) ? null : embeddedWebRoot
};
var builder = WebApplication.CreateBuilder(builderOptions);

builder.Configuration.AddEnvironmentVariables();
builder.WebHost.UseUrls(builder.Configuration["LocalServer:Url"] ?? "http://127.0.0.1:5080");

LocalStoragePaths.EnsureDirectories();
builder.Configuration["LocalStorage:InitialCredentialPath"] = LocalStoragePaths.InitialCredentialPath;

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
{
    jwtKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    builder.Configuration["Jwt:Key"] = jwtKey;
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"];
if (string.IsNullOrWhiteSpace(jwtIssuer))
{
    jwtIssuer = "EduHealth-Local-TW";
    builder.Configuration["Jwt:Issuer"] = jwtIssuer;
}

var jwtAudience = builder.Configuration["Jwt:Audience"];
if (string.IsNullOrWhiteSpace(jwtAudience))
{
    jwtAudience = "EduHealth-Local-TW";
    builder.Configuration["Jwt:Audience"] = jwtAudience;
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Repository
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<StudentRepository>();
builder.Services.AddScoped<HealthProfileRepository>();
builder.Services.AddScoped<HealthCheckCampaignRepository>();
builder.Services.AddScoped<MedicalSupplyRepository>();
builder.Services.AddScoped<MedicalEventRepository>();
builder.Services.AddScoped<HealthCheckSummaryRepository>();
builder.Services.AddScoped<VaccinationCampaignRepository>();
builder.Services.AddScoped<MedicalHistoryRepository>();
builder.Services.AddScoped<MedicationRequestRepository>();
builder.Services.AddScoped<NotificationRepository>();
builder.Services.AddScoped<NotificationTypeRepository>();
builder.Services.AddScoped<MedicalEventTypeRepository>();
builder.Services.AddScoped<BlogPostRepository>();
builder.Services.AddScoped<ParentFeedbackRepository>();

// Service
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IOtpService, OtpService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<VaccinationCampaignService>();
builder.Services.AddScoped<IMedicalHistoryService, MedicalHistoryService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IStudentService, StudentService>();
builder.Services.AddScoped<IHealthProfileService, HealthProfileService>();
builder.Services.AddScoped<IHealthCheckCampaignService, HealthCheckCampaignService>();
builder.Services.AddScoped<IMedicalSupplyService, MedicalSupplyService>();
builder.Services.AddScoped<IMedicalEventService, MedicalEventService>();
builder.Services.AddScoped<IMedicationRequestService, MedicationRequestService>();
builder.Services.AddScoped<IHealthCheckSummaryService, HealthCheckSummaryService>();
builder.Services.AddScoped<IVaccinationCampaignService, VaccinationCampaignService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<INotificationTypeService, NotificationTypeService>();
builder.Services.AddScoped<IMedicalEventTypeService, MedicalEventTypeService>();
builder.Services.AddScoped<IBlogPostService, BlogPostService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IParentFeedbackService, ParentFeedbackService>();

// 單機版僅允許本機前端連線。
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalOnly", policy =>
    {
        policy.WithOrigins(
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "http://127.0.0.1:5174",
                "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// 單機版使用 SQLite 單一檔案資料庫，不需安裝 SQL Server，也不會連外。
var sqliteConnectionString =
    $"Data Source={LocalStoragePaths.DatabasePath};Cache=Shared;Pooling=True;Default Timeout=5";
builder.Services.AddDbContext<SwpEduHealV5Context>(options =>
    options.UseSqlite(sqliteConnectionString));

// 離線模式使用記憶體快取，不連 Redis Cloud。
builder.Services.AddDistributedMemoryCache();

builder.Services.AddSwaggerGen(option =>
{
    option.DescribeAllParametersInCamelCase();
    option.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "輸入登入後取得的 Bearer Token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "Bearer"
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                context.HttpContext.Items["JwtAuthError"] =
                    context.Exception is SecurityTokenExpiredException
                        ? "登入工作階段已逾時。"
                        : "登入憑證無效。";
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json; charset=utf-8";
                var message = context.HttpContext.Items.TryGetValue("JwtAuthError", out var authError)
                    ? authError?.ToString() ?? "登入憑證無效。"
                    : "需要登入才能使用此功能。";
                return context.Response.WriteAsJsonAsync(new { error = message });
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    // 預設所有 API 皆需登入；角色與資料所有權由各控制器明確限制。
    // 這可保留既有家長功能，同時避免用全域角色政策誤擋 Parent 流程。
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("login", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
        limiter.AutoReplenishment = true;
    });
});

// 保留既有排程能力，但全部只在本機記憶體執行。
builder.Services.AddHangfire(config =>
    config.SetDataCompatibilityLevel(CompatibilityLevel.Version_170)
          .UseSimpleAssemblyNameTypeSerializer()
          .UseRecommendedSerializerSettings()
          .UseMemoryStorage());
builder.Services.AddHangfireServer(options =>
{
    // 單機健康中心只需要一個背景工作執行緒，避免預設 worker 數量浪費資源。
    options.WorkerCount = 1;
});

var app = builder.Build();

// 基本瀏覽器安全標頭。允許 Ant Design/React 需要的 inline style，但不允許 inline script。
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        context.Response.Headers["Content-Security-Policy"] =
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
            "font-src 'self' data:; connect-src 'self' http://127.0.0.1:5080; object-src 'none'; base-uri 'self'; frame-ancestors 'none';";
        return Task.CompletedTask;
    });

    await next();
});

app.UseRateLimiter();

// 即使日後誤改 Kestrel 綁定位址，也拒絕非本機來源。
app.Use(async (context, next) =>
{
    var remoteIp = context.Connection.RemoteIpAddress;
    if (remoteIp != null && !IPAddress.IsLoopback(remoteIp))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsync("EduHealth-Local-TW 僅允許本機存取。");
        return;
    }

    await next();
});

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    mode = "local-offline",
    timestamp = DateTime.UtcNow
})).AllowAnonymous();
app.MapMethods("/api/health", new[] { "HEAD" }, () => Results.Ok()).AllowAnonymous();

var publicWebProviders = new List<IFileProvider>
{
    app.Environment.WebRootFileProvider
};

// IncludeAllContentForSelfExtract places bundled content beside the extracted
// managed assembly. Assembly.Location points at that extraction directory,
// while mutable data continues to use Environment.ProcessPath via
// LocalStoragePaths so the database remains beside the real EXE.
var assemblyLocation = typeof(Program).Assembly.Location;
if (!string.IsNullOrWhiteSpace(assemblyLocation))
{
    var extractedDirectory = Path.GetDirectoryName(assemblyLocation);
    if (!string.IsNullOrWhiteSpace(extractedDirectory))
    {
        var extractedWebRoot = Path.Combine(extractedDirectory, "wwwroot");
        if (Directory.Exists(extractedWebRoot))
            publicWebProviders.Add(new PhysicalFileProvider(extractedWebRoot));
    }
}

try
{
    publicWebProviders.Add(
        new ManifestEmbeddedFileProvider(typeof(Program).Assembly, "wwwroot"));
}
catch (InvalidOperationException)
{
    // Physical wwwroot and the single-file extraction provider remain usable.
}

IFileProvider publicWebFiles = publicWebProviders.Count == 1
    ? publicWebProviders[0]
    : new CompositeFileProvider(publicWebProviders);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = publicWebFiles
});


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors("LocalOnly");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Release publish 會把 Vite build 放進 wwwroot；若存在 index.html，
// 讓 React Router 的深層網址也能由同一個 ASP.NET 程序提供。
if (publicWebFiles.GetFileInfo("index.html").Exists)
{
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        FileProvider = publicWebFiles
    }).AllowAnonymous();
}

// 第一次執行時自動建立本機資料庫與必要基本資料。
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SwpEduHealV5Context>();
    await db.Database.EnsureCreatedAsync();
    await LocalDatabaseOptimizer.OptimizeAsync(db);
    await LocalDbSeeder.SeedAsync(db, builder.Configuration);
}

var openBrowser =
    !bool.TryParse(builder.Configuration["LocalServer:OpenBrowser"], out var configuredOpenBrowser) ||
    configuredOpenBrowser;

if (openBrowser)
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        try
        {
            Process.Start(new ProcessStartInfo(
                builder.Configuration["LocalServer:Url"] ?? "http://127.0.0.1:5080")
            {
                UseShellExecute = true
            });
        }
        catch
        {
            // 瀏覽器無法自動開啟時不影響服務本身。
        }
    });
}

app.Run();


static string? PrepareEmbeddedFrontend()
{
    const string resourceName = "EduHealth.Frontend.zip";
    var assembly = Assembly.GetExecutingAssembly();
    using var resource = assembly.GetManifestResourceStream(resourceName);
    if (resource == null)
        return null;

    using var buffer = new MemoryStream();
    resource.CopyTo(buffer);
    var bytes = buffer.ToArray();
    var hash = Convert.ToHexString(SHA256.HashData(bytes))[..16];

    var root = Path.Combine(Path.GetTempPath(), "EduHealth-Local-TW", "web", hash);
    var indexPath = Path.Combine(root, "index.html");
    if (File.Exists(indexPath))
        return root;

    var tempRoot = root + ".tmp-" + Guid.NewGuid().ToString("N");
    Directory.CreateDirectory(tempRoot);

    try
    {
        using var zipBuffer = new MemoryStream(bytes, writable: false);
        using var archive = new ZipArchive(zipBuffer, ZipArchiveMode.Read, leaveOpen: false);

        var destinationRoot = Path.GetFullPath(tempRoot) + Path.DirectorySeparatorChar;
        foreach (var entry in archive.Entries)
        {
            var destinationPath = Path.GetFullPath(Path.Combine(tempRoot, entry.FullName));
            if (!destinationPath.StartsWith(destinationRoot, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Embedded frontend archive contains an invalid path.");

            if (string.IsNullOrEmpty(entry.Name))
            {
                Directory.CreateDirectory(destinationPath);
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            entry.ExtractToFile(destinationPath, overwrite: true);
        }

        if (!File.Exists(Path.Combine(tempRoot, "index.html")))
            throw new InvalidDataException("Embedded frontend is missing index.html.");

        Directory.CreateDirectory(Path.GetDirectoryName(root)!);
        try
        {
            Directory.Move(tempRoot, root);
        }
        catch (IOException) when (Directory.Exists(root))
        {
            // Another process may have populated the same immutable hash cache.
            Directory.Delete(tempRoot, recursive: true);
        }

        return File.Exists(indexPath) ? root : null;
    }
    catch
    {
        if (Directory.Exists(tempRoot))
            Directory.Delete(tempRoot, recursive: true);
        throw;
    }
}
