using Elsa.Common.Features;
using Elsa.Features.Abstractions;
using Elsa.Features.Attributes;
using Elsa.Features.Services;
using Elsa.Identity.Extensions;
using Elsa.Identity.Implementations;
using Elsa.Identity.Models;
using Elsa.Identity.Options;
using Elsa.Identity.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Elsa.Identity.Features;

[DependsOn(typeof(SystemClockFeature))]
public class IdentityFeature : FeatureBase
{
    public IdentityFeature(IModule module) : base(module)
    {
    }

    public ICollection<User> Users { get; set; } = new List<User>();
    public Action<IdentityOptions>? IdentityOptions { get; set; }
    public Action<TokenOptions>? TokenOptions { get; set; }

    public override void Apply()
    {
        if (Users.Any())
            Services.Configure<IdentityOptions>(options => options.Users.AddRange(Users));
        
        Services.Configure(IdentityOptions);
        Services.Configure(TokenOptions);
        
        Services
            .AddSingleton<IPasswordHasher, DefaultPasswordHasher>()
            .AddSingleton<IAccessTokenIssuer, DefaultAccessTokenIssuer>()
            .AddSingleton<ICredentialsValidator, OptionsCredentialsValidator>()
            ;
    }
}