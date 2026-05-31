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

        // ── Sprinkle partner-liked names through the deck ─────────────────────
        var partnerLiked = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (partnership.IsComplete)
        {
            var partnerId    = partnership.GetPartnerId(UserId)!;
            var partnerVotes = await _votes.GetVotesAsync(partnership.Id, partnerId);
            foreach (var kv in partnerVotes.Votes)
                if (kv.Value) partnerLiked.Add(kv.Key);
        }

        var prioritized = unvoted.Where(n =>  partnerLiked.Contains(n)).ToList();
        var rest        = unvoted.Where(n => !partnerLiked.Contains(n)).ToList();

        if (prioritized.Count > 0 && rest.Count > 0)
        {
            // Weave partner-liked names in at regular intervals so they appear
            // throughout the session rather than all bunched at the front.
            var interleaved = new List<string>(unvoted.Count);
            int interval = Math.Max(3, rest.Count / (prioritized.Count + 1));
            int restIdx  = 0;
            int prioIdx  = 0;

            while (restIdx < rest.Count || prioIdx < prioritized.Count)
            {
                int take = Math.Min(interval, rest.Count - restIdx);
                for (int j = 0; j < take; j++)
                    interleaved.Add(rest[restIdx++]);

                if (prioIdx < prioritized.Count)
                    interleaved.Add(prioritized[prioIdx++]);
            }

            unvoted = interleaved;
        }
        else
        {
            unvoted = prioritized.Concat(rest).ToList();
        }

        // ── Popularity ranks ───────────────────────────────────────────────────
        var ranks = _names.GetRanks(partnership.Gender);

        // ── Meanings ───────────────────────────────────────────────────────────
        var meanings = _names.GetMeanings(partnership.Gender);

        ViewBag.LastName          = partnership.LastName;
        ViewBag.TotalCount        = _names.GetNames(partnership.Gender, UserId).Count;
        ViewBag.VotedCount        = votedSet.Count;
        ViewBag.IsLinked          = partnership.IsComplete;
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

    [HttpPost]
    public async Task<IActionResult> Undo([FromBody] UndoRequest request)
    {
        var user = await _users.GetByUsernameAsync(Username);
        if (user?.PartnershipId == null)
            return Json(new { success = false });

        var partnership = await _partnerships.GetAsync(user.PartnershipId);
        if (partnership == null)
            return Json(new { success = false });

        await _votes.UndoVoteAsync(partnership, UserId, request.Name);
        return Json(new { success = true });
    }

    public record VoteRequest(string Name, bool Liked);
    public record UndoRequest(string Name);
}
