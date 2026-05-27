using BabyNameTinder.Models;

namespace BabyNameTinder.Services;

public class PartnershipService
{
    private const string PartnershipsContainer = "partnerships";
    private const string InvitesContainer = "invites";
    private readonly BlobStorageService _blobs;
    private readonly UserService _users;

    public PartnershipService(BlobStorageService blobs, UserService users)
    {
        _blobs = blobs;
        _users = users;
    }

    public async Task<Partnership> CreateAsync(string userId, string username, string lastName, string gender)
    {
        var partnership = new Partnership
        {
            Id = Guid.NewGuid().ToString(),
            User1Id = userId,
            User1Username = username,
            LastName = lastName,
            Gender = gender,
            InviteCode = GenerateCode()
        };

        await _blobs.SetAsync(PartnershipsContainer, $"{partnership.Id}.json", partnership);
        await _blobs.SetAsync(InvitesContainer, $"{partnership.InviteCode}.json", partnership.Id);

        // Update user
        var user = await _users.GetByUsernameAsync(username);
        if (user != null)
        {
            user.PartnershipId = partnership.Id;
            await _users.SaveAsync(user);
        }

        return partnership;
    }

    public async Task<(bool success, string error, Partnership? partnership)> JoinAsync(
        string code, string userId, string username)
    {
        var partnershipId = await _blobs.GetAsync<string>(InvitesContainer, $"{code.ToUpper()}.json");
        if (partnershipId == null)
            return (false, "Invalid invite code.", null);

        var partnership = await _blobs.GetAsync<Partnership>(PartnershipsContainer, $"{partnershipId}.json");
        if (partnership == null)
            return (false, "Partnership not found.", null);

        if (partnership.IsComplete)
            return (false, "This invite code has already been used.", null);

        if (partnership.User1Id == userId)
            return (false, "You can't link with yourself.", null);

        partnership.User2Id = userId;
        partnership.User2Username = username;
        await _blobs.SetAsync(PartnershipsContainer, $"{partnership.Id}.json", partnership);

        // Update joining user
        var user = await _users.GetByUsernameAsync(username);
        if (user != null)
        {
            user.PartnershipId = partnership.Id;
            await _users.SaveAsync(user);
        }

        return (true, "", partnership);
    }

    public async Task<Partnership?> GetAsync(string partnershipId) =>
        await _blobs.GetAsync<Partnership>(PartnershipsContainer, $"{partnershipId}.json");

    private static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var rng = new Random();
        return new string(Enumerable.Range(0, 6).Select(_ => chars[rng.Next(chars.Length)]).ToArray());
    }
}
