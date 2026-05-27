using BabyNameTinder.Hubs;
using BabyNameTinder.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);

// MVC + SignalR
builder.Services.AddControllersWithViews();
builder.Services.AddSignalR();

// Cookie Authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
    });

// Services
builder.Services.AddSingleton<BlobStorageService>();
builder.Services.AddSingleton<NameService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<PartnershipService>();
builder.Services.AddScoped<VoteService>();
builder.Services.AddScoped<PasswordHasher<string>>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapHub<NameHub>("/nameHub");

app.Run();
