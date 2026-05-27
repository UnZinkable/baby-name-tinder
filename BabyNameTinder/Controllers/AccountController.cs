using BabyNameTinder.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;

namespace BabyNameTinder.Controllers;

public class AccountController : Controller
{
    private readonly UserService _users;

    public AccountController(UserService users) => _users = users;

    [HttpGet]
    public IActionResult Register() => View();

    [HttpPost]
    public async Task<IActionResult> Register(string username, string password, string confirmPassword)
    {
        if (password != confirmPassword)
        {
            ViewBag.Error = "Passwords do not match.";
            return View();
        }

        var (success, error) = await _users.RegisterAsync(username, password);
        if (!success)
        {
            ViewBag.Error = error;
            return View();
        }

        // Auto-login after registration
        var user = await _users.GetByUsernameAsync(username);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            UserService.BuildPrincipal(user!),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(30) });

        return RedirectToAction("Create", "Partner");
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        ViewBag.ReturnUrl = returnUrl;
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Login(string username, string password, string? returnUrl = null)
    {
        var (user, error) = await _users.LoginAsync(username, password);
        if (user == null)
        {
            ViewBag.Error = error;
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            UserService.BuildPrincipal(user),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(30) });

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction("Index", "Swipe");
    }

    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction("Index", "Home");
    }
}
