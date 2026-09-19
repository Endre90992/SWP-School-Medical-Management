using Hangfire;
using Hangfire.MemoryStorage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.Sqlite;
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
using System.Security.Cryptography;
using System.Text;

const string defaultUrl = "http://127.0.0.1:5080";
var isCi = string.Equals(
    Environment.GetEnvironmentVariable("CI"),
    "true",
    StringComparison.OrdinalIgnoreCase);

var configuredUrl =
    Environment.GetEnvironmentVariable("LocalServer__Url") ??
    defaultUrl;

using var singleInstance = new Mutex(
    initiallyOwned: true,
    name: @"Local\EduHealth-Local-TW",
    createdNew: out var isFirstInstance);

if (!isFirstInstance)
{
    if (!isCi)
        TryOpen(configuredUrl);
    return;
}

LocalAppPaths.EnsureDirectories();

var sqliteConnectionString = new SqliteConnectionStringBuilder
{
    DataSource = LocalAppPaths.DatabaseFile,
    Cache = SqliteCacheMode.Shared,
    Pooling = true,
    DefaultTimeout = 5
}.ToString();

var builder = WebApplication.CreateBuilder(args);

// 內建單機預設值，讓正式單檔 EXE 不需要旁邊再放 appsettings.json。
// 環境變數最後載入，仍可供 CI / 開發測試覆寫。
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["OfflineMode"] = "true",
    ["LocalServer:Url"] = defaultUrl,
    ["LocalServer:AutoOpenBrowser"] = "true",
    ["ConnectionStrings:DefaultConnection"] = sqliteConnectionString,
    ["Jwt:Issuer"] = "EduHealth-Local-TW",
    ["Jwt:Audience"] = "EduHealth-Local-TW",
    ["LocalBootstrap:DefaultNurseUsername"] = "nurse",
    ["LocalBootstrap:DefaultNursePassword"] = ""
});
builder.Configuration.AddEnvironmentVariables();

var localUrl = builder.Configuration["LocalServer:Url"] ?? defaultUrl;
builder.WebHost.UseUrls(localUrl);

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
{
    // 每次程式啟動使用新的高熵 signing key；舊 session 在重啟後自然失效。
    jwtKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    builder.Configuration["Jwt:Key"] = jwtKey;
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

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

// 開發模式允許本機 Vite；正式版 React 與 API 同源，不依賴 CORS。
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

builder.Services.AddDbContext<SwpEduHealV5Context>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                var message = context.Exception is SecurityTokenExpiredException
                    ? "登入工作階段已逾時。"
                    : "登入憑證無效。";
                return context.Response.WriteAsync($"{{\"error\":\"{message}\"}}");
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddHangfire(config =>
    config.SetDataCompatibilityLevel(CompatibilityLevel.Version_170)
          .UseSimpleAssemblyNameTypeSerializer()
          .UseRecommendedSerializerSettings()
          .UseMemoryStorage());

builder.Services.AddHangfireServer(options => options.WorkerCount = 1);

var app = builder.Build();

// 雙重限制：Kestrel 只綁 127.0.0.1，middleware 也拒絕非 loopback 來源。
app.Use(async (context, next) =>
{
    var remoteIp = context.Connection.RemoteIpAddress;
    if (remoteIp != null && !IPAddress.IsLoopback(remoteIp))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsync("EduHealth Local TW 僅允許本機存取。");
        return;
    }

    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] =
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

    if (!context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers["Content-Security-Policy"] =
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' blob: data:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "frame-ancestors 'none';";
    }

    await next();
});

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    mode = "local-offline",
    timestamp = DateTime.UtcNow
})).AllowAnonymous();

app.MapMethods("/api/health", new[] { "HEAD" }, () => Results.Ok())
    .AllowAnonymous();

if (app.Environment.IsDevelopment())
{
    app.UseStaticFiles();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // 正式版的 React 靜態檔直接從 EXE 內嵌資源提供。
    app.Use(async (context, next) =>
    {
        if ((HttpMethods.IsGet(context.Request.Method) ||
             HttpMethods.IsHead(context.Request.Method)) &&
            !context.Request.Path.StartsWithSegments("/api") &&
            EmbeddedFrontend.TryOpen(
                context.Request.Path.Value ?? "/",
                out var stream,
                out var contentType))
        {
            await using (stream)
            {
                context.Response.ContentType = contentType;
                if (context.Request.Path.StartsWithSegments("/assets"))
                    context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
                else
                    context.Response.Headers.CacheControl = "no-cache";

                if (!HttpMethods.IsHead(context.Request.Method))
                    await stream.CopyToAsync(context.Response.Body);
            }
            return;
        }

        await next();
    });
}

app.UseRouting();
app.UseCors("LocalOnly");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (!app.Environment.IsDevelopment())
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var stream = EmbeddedFrontend.OpenIndex();
        if (stream == null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await using (stream)
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            context.Response.Headers.CacheControl = "no-cache";
            await stream.CopyToAsync(context.Response.Body);
        }
    }).AllowAnonymous();
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SwpEduHealV5Context>();
    await db.Database.EnsureCreatedAsync();
    await LocalDatabaseOptimizer.OptimizeAsync(db);
    await LocalDbSeeder.SeedAsync(db, builder.Configuration);
}

await app.StartAsync();

if (!isCi &&
    builder.Configuration.GetValue("LocalServer:AutoOpenBrowser", true))
{
    // 第一次啟動先打開一次性帳密文字檔，再開登入頁。
    if (File.Exists(LocalAppPaths.InitialCredentialFile))
        TryOpen(LocalAppPaths.InitialCredentialFile);

    TryOpen(localUrl);
}

await app.WaitForShutdownAsync();

static void TryOpen(string target)
{
    try
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = target,
            UseShellExecute = true
        });
    }
    catch
    {
        // 啟動瀏覽器/文字檔失敗不影響健康中心服務本身。
    }
}
