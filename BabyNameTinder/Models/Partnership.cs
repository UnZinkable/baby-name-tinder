namespace BabyNameTinder.Models;

public class Partnership
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string User1Id { get; set; } = "";
    public string User1Username { get; set; } = "";
    public string? User2Id { get; set; }
    public string? User2Username { get; set; }
    public string LastName { get; set; } = "";
    public string Gender { get; set; } = "both"; // "boy", "girl", "both"
    public string InviteCode { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsComplete => User2Id != null;

    public string? GetPartnerId(string userId) =>
        userId == User1Id ? User2Id : (userId == User2Id ? User1Id : null);

    public string? GetPartnerUsername(string userId) =>
        userId == User1Id ? User2Username : (userId == User2Id ? User1Username : null);
}
