using BabyNameTinder.Models;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;

namespace BabyNameTinder.Services;

public class UserService
{
    private const string Container = "users";
    private readonly BlobStorageService _blobs;
    private readonly PasswordHasher<string> _hasher;

    public UserService(BlobStorageService blobs, PasswordHasher<string> hasher)
    {
        _blobs = blobs;
        _hasher = hasher;
    }

    private static string BlobKey(string username) => $"{username.ToLower()}.json";

    public async Task<(bool success, string error)> RegisterAsync(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
            return (false, "Username must be at least 3 characters.");
        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
            return (false, "Password must be at least 6 characters.");

        if (await _blobs.ExistsAsync(Container, BlobKey(username)))
            return (false, "That username is already taken.");

        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Username = username,
            PasswordHash = _hasher.HashPassword(username, password)
        };

        await _blobs.SetAsync(Container, BlobKey(username), user);
        return (true, "");
    }

    public async Task<(User? user, string error)> LoginAsync(string username, string password)
    {
        var user = await _blobs.GetAsync<User>(Container, BlobKey(username));
        if (user == null)
            return (null, "Invalid username or password.");

        var result = _hasher.VerifyHashedPassword(username, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed)
            return (null, "Invalid username or password.");

        return (user, "");
    }

    public async Task<User?> GetByUsernameAsync(string username) =>
        await _blobs.GetAsync<User>(Container, BlobKey(username));

    public async Task SaveAsync(User user) =>
        await _blobs.SetAsync(Container, BlobKey(user.Username), user);

    public static ClaimsPrincipal BuildPrincipal(User user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Username)
        };
        var identity = new ClaimsIdentity(claims, "Cookies");
        return new ClaimsPrincipal(identity);
    }
}
