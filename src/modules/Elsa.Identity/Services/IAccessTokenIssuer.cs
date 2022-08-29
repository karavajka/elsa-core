using Elsa.Identity.Models;

namespace Elsa.Identity.Services;

public interface IAccessTokenIssuer
{
    ValueTask<string> IssueTokenAsync(User user, CancellationToken cancellationToken = default);
}