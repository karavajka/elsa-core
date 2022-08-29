using Elsa.Identity.Models;
using Elsa.Identity.Options;
using Elsa.Identity.Services;
using Microsoft.Extensions.Options;

namespace Elsa.Identity.Implementations;

public class OptionsCredentialsValidator : ICredentialsValidator
{
    private readonly IOptionsMonitor<IdentityOptions> _userOptionsMonitor;
    private readonly IPasswordHasher _passwordHasher;

    public OptionsCredentialsValidator(IOptionsMonitor<IdentityOptions> userOptionsMonitor, IPasswordHasher passwordHasher)
    {
        _userOptionsMonitor = userOptionsMonitor;
        _passwordHasher = passwordHasher;
    }

    public ValueTask<User?> ValidateAsync(string username, string password, CancellationToken cancellationToken = default)
    {
        var users = _userOptionsMonitor.CurrentValue?.Users ?? new List<User>();
        var user = users.FirstOrDefault(x => string.Equals(x.Name, username, StringComparison.InvariantCultureIgnoreCase));

        if (user == null)
            return default;

        var isValidPassword = _passwordHasher.VerifyHashedPassword(user.HashedPassword, password);

        if (!isValidPassword)
            return default;

        return new(user);
    }
}