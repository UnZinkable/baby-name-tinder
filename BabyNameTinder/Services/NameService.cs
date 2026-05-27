using BabyNameTinder.Models;
using System.Text.Json;

namespace BabyNameTinder.Services;

public class NameService
{
    private readonly List<BabyName> _allNames;

    public NameService(IWebHostEnvironment env)
    {
        var path = Path.Combine(env.ContentRootPath, "Data", "names.json");
        var json = File.ReadAllText(path);
        var raw = JsonSerializer.Deserialize<List<BabyName>>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();

        // Deduplicate by name (case-insensitive), keeping first occurrence
        _allNames = raw
            .DistinctBy(n => n.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>
    /// Returns names filtered by gender, shuffled deterministically by userId so
    /// both partners see a different order.
    /// </summary>
    public List<string> GetNames(string gender, string userId)
    {
        var filtered = gender switch
        {
            "boy"  => _allNames.Where(n => n.Gender == "boy"  || n.Gender == "neutral"),
            "girl" => _allNames.Where(n => n.Gender == "girl" || n.Gender == "neutral"),
            _      => _allNames.AsEnumerable()
        };

        // Deterministic shuffle per user so partners see different orderings
        var seed = userId.GetHashCode();
        var rng = new Random(seed);
        return filtered.Select(n => n.Name).OrderBy(_ => rng.Next()).ToList();
    }

    /// <summary>
    /// Returns names the user hasn't voted on yet.
    /// </summary>
    public List<string> GetUnvotedNames(string gender, string userId, HashSet<string> votedNames)
    {
        return GetNames(gender, userId)
            .Where(n => !votedNames.Contains(n))
            .ToList();
    }
}
