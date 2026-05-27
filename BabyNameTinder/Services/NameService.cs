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
    /// Returns names filtered by gender, shuffled deterministically by userId.
    /// </summary>
    public List<string> GetNames(string gender, string userId)
    {
        var seed = userId.GetHashCode();
        var rng = new Random(seed);
        return Filter(gender).Select(n => n.Name).OrderBy(_ => rng.Next()).ToList();
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

    /// <summary>
    /// Returns a rank (1 = most popular) for each name within the filtered gender set.
    /// Based on the order names appear in names.json (SSA-sourced order).
    /// </summary>
    public Dictionary<string, int> GetRanks(string gender)
    {
        return Filter(gender)
            .Select((n, i) => (n.Name, Rank: i + 1))
            .ToDictionary(x => x.Name, x => x.Rank, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Returns a name → meaning dictionary for the given gender.
    /// </summary>
    public Dictionary<string, string> GetMeanings(string gender)
    {
        return Filter(gender)
            .Where(n => !string.IsNullOrWhiteSpace(n.Meaning))
            .ToDictionary(n => n.Name, n => n.Meaning, StringComparer.OrdinalIgnoreCase);
    }

    private IEnumerable<BabyName> Filter(string gender) => gender switch
    {
        "boy"  => _allNames.Where(n => n.Gender == "boy"  || n.Gender == "neutral"),
        "girl" => _allNames.Where(n => n.Gender == "girl" || n.Gender == "neutral"),
        _      => _allNames.AsEnumerable()
    };
}
