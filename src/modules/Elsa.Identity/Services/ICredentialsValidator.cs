using Elsa.Identity.Models;

namespace Elsa.Identity.Services;

public interface ICredentialsValidator
{
    ValueTask<User?> ValidateAsync(string username, string password, CancellationToken cancellationToken = default);
}