using BabyNameTinder.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace BabyNameTinder.Controllers;

[Authorize]
public class VotesController : Controller
{
    private readonly UserService _users;
    private readonly PartnershipService _partnerships;
    private readonly VoteService _votes;
    private readonly NameService _names;

    public VotesController(UserService users, PartnershipService partnerships,
        VoteService votes, NameService names)
    {
        _users = users;
        _partnerships = partnerships;
        _votes = votes;
        _names = names;
    }

    private string UserId   => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
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

        var userVotes = await _votes.GetVotesAsync(partnership.Id, UserId);

        var ranks    = _names.GetRanks(partnership.Gender);
        var meanings = _names.GetMeanings(partnership.Gender);

        // Split into liked / disliked, sorted by name
        var liked    = userVotes.Votes.Where(kv =>  kv.Value).Select(kv => kv.Key).OrderBy(n => n).ToList();
        var disliked = userVotes.Votes.Where(kv => !kv.Value).Select(kv => kv.Key).OrderBy(n => n).ToList();

        ViewBag.LastName     = partnership.LastName;
        ViewBag.Liked        = liked;
        ViewBag.Disliked     = disliked;
        ViewBag.Ranks        = ranks;
        ViewBag.Meanings     = meanings;
        ViewBag.RanksJson    = JsonSerializer.Serialize(ranks);
        ViewBag.MeaningsJson = JsonSerializer.Serialize(meanings);

        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Reset()
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId == null)
            return RedirectToAction("Create", "Partner");

        var partnership = await _partnerships.GetAsync(user.PartnershipId);
        if (partnership == null)
            return RedirectToAction("Create", "Partner");

        await _votes.ResetVotesAsync(partnership, UserId);

        TempData["Success"] = "All votes cleared — time to swipe again!";
        return RedirectToAction("Index");
    }
}
