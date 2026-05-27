using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.Text;
using System.Text.Json;

namespace BabyNameTinder.Services;

public class BlobStorageService
{
    private readonly BlobServiceClient _client;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public BlobStorageService(IConfiguration config)
    {
        var connString = config["AzureStorage:ConnectionString"]
            ?? throw new InvalidOperationException("AzureStorage:ConnectionString is not configured.");
        _client = new BlobServiceClient(connString);
    }

    public async Task<T?> GetAsync<T>(string container, string blobName) where T : class
    {
        try
        {
            var containerClient = _client.GetBlobContainerClient(container);
            var blobClient = containerClient.GetBlobClient(blobName);
            var response = await blobClient.DownloadContentAsync();
            var json = response.Value.Content.ToString();
            return JsonSerializer.Deserialize<T>(json, _jsonOptions);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task SetAsync<T>(string container, string blobName, T value)
    {
        var containerClient = _client.GetBlobContainerClient(container);
        await containerClient.CreateIfNotExistsAsync();
        var blobClient = containerClient.GetBlobClient(blobName);
        var json = JsonSerializer.Serialize(value, _jsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        using var stream = new MemoryStream(bytes);
        await blobClient.UploadAsync(stream, overwrite: true);
    }

    public async Task<bool> ExistsAsync(string container, string blobName)
    {
        try
        {
            var containerClient = _client.GetBlobContainerClient(container);
            var blobClient = containerClient.GetBlobClient(blobName);
            var response = await blobClient.ExistsAsync();
            return response.Value;
        }
        catch
        {
            return false;
        }
    }
}
