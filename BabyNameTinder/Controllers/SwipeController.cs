using BabyNameTinder.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace BabyNameTinder.Controllers;

[Authorize]
public class SwipeController : Controller
{
    private readonly UserService _users;
    private readonly PartnershipService _partnerships;
    private readonly VoteService _votes;
    private readonly NameService _names;

    public SwipeController(UserService users, PartnershipService partnerships,
        VoteService votes, NameService names)
    {
        _users = users;
        _partnerships = partnerships;
        _votes = votes;
        _names = names;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
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

        var myVotes = await _votes.GetVotesAsync(partnership.Id, UserId);
        var votedSet = new HashSet<string>(myVotes.Votes.Keys, StringComparer.OrdinalIgnoreCase);
        var unvoted  = _names.GetUnvotedNames(partnership.Gender, UserId, votedSet);

        // ── Partner-liked names first ──────────────────────────────────────────
        // Load partner's votes and bubble up names they liked so matches
        // are discovered as early as possible.
        var partnerLiked = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (partnership.IsComplete)
        {
            var partnerId    = partnership.GetPartnerId(UserId)!;
            var partnerVotes = await _votes.GetVotesAsync(partnership.Id, partnerId);
            foreach (var kv in partnerVotes.Votes)
                if (kv.Value) partnerLiked.Add(kv.Key);
        }

        // Partition: names partner already liked → front; everything else → back
        var prioritized = unvoted.Where(n =>  partnerLiked.Contains(n)).ToList();
        var rest        = unvoted.Where(n => !partnerLiked.Contains(n)).ToList();
        unvoted = prioritized.Concat(rest).ToList();

        // ── Popularity ranks ───────────────────────────────────────────────────
        var ranks = _names.GetRanks(partnership.Gender);

        // ── Meanings ───────────────────────────────────────────────────────────
        var meanings = _names.GetMeanings(partnership.Gender);

        ViewBag.LastName          = partnership.LastName;
        ViewBag.TotalCount        = _names.GetNames(partnership.Gender, UserId).Count;
        ViewBag.VotedCount        = votedSet.Count;
        ViewBag.IsLinked          = partnership.IsComplete;
        ViewBag.PrioritizedCount  = prioritized.Count;   // used to show the smart-sort hint
        ViewBag.Ranks             = ranks;
        ViewBag.RanksJson         = JsonSerializer.Serialize(ranks);
        ViewBag.MeaningsJson      = JsonSerializer.Serialize(meanings);

        return View(unvoted);
    }

    [HttpPost]
    public async Task<IActionResult> Vote([FromBody] VoteRequest request)
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId == null)
            return Json(new { success = false, error = "No partnership found." });

        var partnership = await _partnerships.GetAsync(user.PartnershipId);
        if (partnership == null)
            return Json(new { success = false, error = "Partnership not found." });

        var isMatch = await _votes.RecordVoteAsync(partnership, UserId, request.Name, request.Liked);
        return Json(new { success = true, isMatch });
    }

    public record VoteRequest(string Name, bool Liked);
}
