using BabyNameTinder.Models;
using BabyNameTinder.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace BabyNameTinder.Services;

public class VoteService
{
    private const string VotesContainer = "votes";
    private const string MatchesContainer = "matches";
    private readonly BlobStorageService _blobs;
    private readonly IHubContext<NameHub> _hub;

    public VoteService(BlobStorageService blobs, IHubContext<NameHub> hub)
    {
        _blobs = blobs;
        _hub = hub;
    }

    private static string VoteKey(string partnershipId, string userId) =>
        $"{partnershipId}/{userId}.json";

    public async Task<UserVotes> GetVotesAsync(string partnershipId, string userId)
    {
        return await _blobs.GetAsync<UserVotes>(VotesContainer, VoteKey(partnershipId, userId))
            ?? new UserVotes { UserId = userId, PartnershipId = partnershipId };
    }

    /// <summary>
    /// Records a vote and returns true if it created a match.
    /// </summary>
    public async Task<bool> RecordVoteAsync(Partnership partnership, string userId, string name, bool liked)
    {
        // Update this user's votes
        var myVotes = await GetVotesAsync(partnership.Id, userId);
        myVotes.Votes[name] = liked;
        await _blobs.SetAsync(VotesContainer, VoteKey(partnership.Id, userId), myVotes);

        if (!liked) return false;

        // Check if partner also liked it
        var partnerId = partnership.GetPartnerId(userId);
        if (partnerId == null) return false; // no partner yet

        var partnerVotes = await GetVotesAsync(partnership.Id, partnerId);
        if (!partnerVotes.Votes.TryGetValue(name, out var partnerLiked) || !partnerLiked)
            return false;

        // It's a match!
        var matches = await GetMatchListAsync(partnership.Id);
        if (!matches.Names.Contains(name))
        {
            matches.Names.Add(name);
            await _blobs.SetAsync(MatchesContainer, $"{partnership.Id}.json", matches);
        }

        // Notify both users via SignalR
        var fullName = $"{name} {partnership.LastName}";
        await _hub.Clients.Group($"user_{userId}").SendAsync("Match", fullName);
        await _hub.Clients.Group($"user_{partnerId}").SendAsync("Match", fullName);

        return true;
    }

    public async Task<MatchList> GetMatchListAsync(string partnershipId)
    {
        return await _blobs.GetAsync<MatchList>(MatchesContainer, $"{partnershipId}.json")
            ?? new MatchList { PartnershipId = partnershipId };
    }

    /// <summary>
    /// Removes a single vote and, if it was a like, scrubs the resulting match.
    /// </summary>
    public async Task UndoVoteAsync(Partnership partnership, string userId, string name)
    {
        var myVotes = await GetVotesAsync(partnership.Id, userId);
        if (!myVotes.Votes.TryGetValue(name, out var wasLiked)) return;

        myVotes.Votes.Remove(name);
        await _blobs.SetAsync(VotesContainer, VoteKey(partnership.Id, userId), myVotes);

        if (wasLiked)
        {
            var matches = await GetMatchListAsync(partnership.Id);
            var countBefore = matches.Names.Count;
            matches.Names.RemoveAll(n => n.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (matches.Names.Count != countBefore)
                await _blobs.SetAsync(MatchesContainer, $"{partnership.Id}.json", matches);
        }
    }

    /// <summary>
    /// Clears all of this user's votes and removes any matches they contributed to.
    /// </summary>
    public async Task ResetVotesAsync(Partnership partnership, string userId)
    {
        // Remember which names the user liked so we can scrub them from matches
        var myVotes = await GetVotesAsync(partnership.Id, userId);
        var myLikes = myVotes.Votes
            .Where(kv => kv.Value)
            .Select(kv => kv.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Overwrite with empty votes blob
        await _blobs.SetAsync(VotesContainer, VoteKey(partnership.Id, userId),
            new UserVotes { UserId = userId, PartnershipId = partnership.Id });

        // Remove matches that depended on this user's likes
        if (myLikes.Count > 0)
        {
            var matches = await GetMatchListAsync(partnership.Id);
            var countBefore = matches.Names.Count;
            matches.Names.RemoveAll(n => myLikes.Contains(n));
            if (matches.Names.Count != countBefore)
                await _blobs.SetAsync(MatchesContainer, $"{partnership.Id}.json", matches);
        }
    }
}
