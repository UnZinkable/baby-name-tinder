namespace BabyNameTinder.Models;

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? PartnershipId { get; set; }
}
