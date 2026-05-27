namespace BabyNameTinder.Models;

public class UserVotes
{
    public string UserId { get; set; } = "";
    public string PartnershipId { get; set; } = "";
    // name -> true (liked) / false (disliked)
    public Dictionary<string, bool> Votes { get; set; } = new();
}
