using System.Security.Claims;
using Elsa.Common.Services;
using Elsa.Identity.Models;
using Elsa.Identity.Options;
using Elsa.Identity.Services;
using FastEndpoints.Security;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Elsa.Identity.Implementations;

public class DefaultAccessTokenIssuer : IAccessTokenIssuer
{
    private readonly ISystemClock _systemClock;
    private readonly TokenOptions _tokenOptions;

    public DefaultAccessTokenIssuer(ISystemClock systemClock, IOptions<TokenOptions> tokenOptions)
    {
        _systemClock = systemClock;
        _tokenOptions = tokenOptions.Value;
    }

    public ValueTask<string> IssueTokenAsync(User user, CancellationToken cancellationToken = default)
    {
        var permissions = user.Roles.SelectMany(x => x.Permissions).ToList();
        var (signingKey, issuer, audience, lifetime) = _tokenOptions;

        if (string.IsNullOrWhiteSpace(signingKey)) throw new Exception("No signing key configured");
        if (string.IsNullOrWhiteSpace(issuer)) throw new Exception("No issuer configured");
        if (string.IsNullOrWhiteSpace(audience)) throw new Exception("No audience configured");

        var nameClaim = new Claim(JwtRegisteredClaimNames.Name, user.Name);
        var claims = new[] { nameClaim };

        var expiresAt = lifetime != null ? _systemClock.UtcNow.Add(lifetime.Value) : default(DateTimeOffset?);
        var token = JWTBearer.CreateToken(signingKey, expiresAt?.DateTime, permissions, issuer: issuer, audience: audience, claims: claims);

        return new(token);
    }
}