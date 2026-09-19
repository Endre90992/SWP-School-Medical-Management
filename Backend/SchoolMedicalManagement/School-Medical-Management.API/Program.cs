using Hangfire;
using Hangfire.MemoryStorage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using School_Medical_Management.API;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Repository.Repository;
using SchoolMedicalManagement.Service.Implement;
using SchoolMedicalManagement.Service.Interface;
using System.Diagnostics;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Single-file publish with IncludeAllContentForSelfExtract extracts content
// before managed startup. On Windows the runtime uses DOTNET_BUNDLE_EXTRACT_BASE_DIR
// when set, otherwise %TEMP%\\.net. Assembly.Location is intentionally empty for
// bundled assemblies, so probe the runtime extraction layout explicitly.
var webRootCandidates = new List<string>
{
    Path.Combine(AppContext.BaseDirectory, "wwwroot")
};

try
{
    var configuredExtractBase = Environment.GetEnvironmentVariable("DOTNET_BUNDLE_EXTRACT_BASE_DIR");
    var extractBase = string.IsNullOrWhiteSpace(configuredExtractBase)
        ? Path.Combine(Path.GetTempPath(), ".net")
        : configuredExtractBase;

    var bundleNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var assemblyName = Assembly.GetExecutingAssembly().GetName().Name;
    if (!string.IsNullOrWhiteSpace(assemblyName))
        bundleNames.Add(assemblyName);

    var processPath = Environment.ProcessPath;
    if (!string.IsNullOrWhiteSpace(processPath))
        bundleNames.Add(Path.GetFileNameWithoutExtension(processPath));

    foreach (var bundleName in bundleNames)
    {
        var appExtractRoot = Path.Combine(extractBase, bundleName);
        if (!Directory.Exists(appExtractRoot))
            continue;

        foreach (var extractedVersionDir in Directory
                     .EnumerateDirectories(appExtractRoot)
                     .OrderByDescending(Directory.GetLastWriteTimeUtc))
        {
            var candidate = Path.Combine(extractedVersionDir, "wwwroot");
            if (File.Exists(Path.Combine(candidate, "index.html")))
            {
                webRootCandidates.Add(candidate);
                break;
            }
        }
    }

    // The extraction folder name can differ from the physical EXE name after
    // the published apphost is renamed. Identify our bundle by the extracted
    // managed entry assembly instead of relying only on directory naming.
    if (!string.IsNullOrWhiteSpace(assemblyName) && Directory.Exists(extractBase))
    {
        var entryAssemblyFileName = assemblyName + ".dll";
        foreach (var entryAssemblyPath in Directory
                     .EnumerateFiles(extractBase, entryAssemblyFileName, SearchOption.AllDirectories)
                     .OrderByDescending(File.GetLastWriteTimeUtc))
        {
            var extractedVersionDir = Path.GetDirectoryName(entryAssemblyPath);
            if (string.IsNullOrWhiteSpace(extractedVersionDir))
                continue;

            var candidate = Path.Combine(extractedVersionDir, "wwwroot");
            if (File.Exists(Path.Combine(candidate, "index.html")))
            {
                webRootCandidates.Add(candidate);
                break;
            }
        }
    }
}
catch (IOException)
{
    // If extraction probing fails, ASP.NET falls back to the normal web root.
}
catch (UnauthorizedAccessException)
{
    // Same fallback for locked-down environments.
}

var bundledWebRoot = webRootCandidates
    .FirstOrDefault(path => Directory.Exists(path) && File.Exists(Path.Combine(path, "index.html")));

if (!string.IsNullOrWhiteSpace(bundledWebRoot))
{
    builder.WebHost.UseWebRoot(bundledWebRoot);
}

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

app.UseStaticFiles();


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
var spaIndex = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
if (File.Exists(spaIndex))
{
    app.MapFallbackToFile("index.html").AllowAnonymous();
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
