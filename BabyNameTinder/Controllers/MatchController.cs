using BabyNameTinder.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BabyNameTinder.Controllers;

[Authorize]
public class MatchController : Controller
{
    private readonly UserService _users;
    private readonly PartnershipService _partnerships;
    private readonly VoteService _votes;

    public MatchController(UserService users, PartnershipService partnerships, VoteService votes)
    {
        _users = users;
        _partnerships = partnerships;
        _votes = votes;
    }

    private string Username => User.FindFirstValue(ClaimTypes.Name)!;

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId == null)
            return RedirectToAction("Create", "Partner");

        var partnership = await _partnerships.GetAsync(user.PartnershipId);
        if (partnership == null)
            return RedirectToAction("Create", "Partner");

        var matchList = await _votes.GetMatchListAsync(partnership.Id);
        ViewBag.LastName = partnership.LastName;
        ViewBag.Partner = partnership.GetPartnerUsername(User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier)!);
        return View(matchList.Names);
    }
}
