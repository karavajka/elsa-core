using Elsa.Common.Features;
using Elsa.Features.Abstractions;
using Elsa.Features.Attributes;
using Elsa.Features.Services;
using Elsa.Identity.Implementations;
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
    
    public Action<IdentityOptions>? IdentityOptions { get; set; }
    public Action<TokenOptions>? TokenOptions { get; set; }

    public override void Apply()
    {
        Services.Configure(IdentityOptions);
        Services.Configure(TokenOptions);
        
        Services
            .AddSingleton<IPasswordHasher, DefaultPasswordHasher>()
            .AddSingleton<IAccessTokenIssuer, DefaultAccessTokenIssuer>()
            .AddSingleton<ICredentialsValidator, OptionsCredentialsValidator>()
            ;
    }
}