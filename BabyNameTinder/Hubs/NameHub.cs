using Microsoft.AspNetCore.SignalR;

namespace BabyNameTinder.Hubs;

public class NameHub : Hub
{
    /// <summary>
    /// Called by the client to join their personal notification group.
    /// Query string: ?userId=xxx
    /// </summary>
    public async Task JoinUserGroup(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
    }
}
