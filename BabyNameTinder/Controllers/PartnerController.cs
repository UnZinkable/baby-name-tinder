using BabyNameTinder.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BabyNameTinder.Controllers;

[Authorize]
public class PartnerController : Controller
{
    private readonly PartnershipService _partnerships;
    private readonly UserService _users;

    public PartnerController(PartnershipService partnerships, UserService users)
    {
        _partnerships = partnerships;
        _users = users;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string Username => User.FindFirstValue(ClaimTypes.Name)!;

    [HttpGet]
    public async Task<IActionResult> Dashboard()
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId == null)
            return RedirectToAction("Create");

        var partnership = await _partnerships.GetAsync(user.PartnershipId);
        if (partnership == null)
            return RedirectToAction("Create");

        return View(partnership);
    }

    [HttpGet]
    public async Task<IActionResult> Create()
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId != null)
            return RedirectToAction("Dashboard");
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Create(string lastName, string gender)
    {
        if (string.IsNullOrWhiteSpace(lastName))
        {
            ViewBag.Error = "Please enter a last name.";
            return View();
        }

        var partnership = await _partnerships.CreateAsync(UserId, Username, lastName.Trim(), gender);
        TempData["InviteCode"] = partnership.InviteCode;
        return RedirectToAction("Dashboard");
    }

    [HttpGet]
    public async Task<IActionResult> Join()
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId != null)
            return RedirectToAction("Dashboard");
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Join(string code)
    {
        var (success, error, _) = await _partnerships.JoinAsync(code?.Trim() ?? "", UserId, Username);
        if (!success)
        {
            ViewBag.Error = error;
            return View();
        }

        return RedirectToAction("Dashboard");
    }
}
