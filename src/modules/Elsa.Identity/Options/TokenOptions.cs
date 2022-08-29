namespace Elsa.Identity.Options;

public class TokenOptions
{
    public string SigningKey { get; set; } = default!;
    public string Issuer { get; set; } = "http://elsa.api";
    public string Audience { get; set; } = "http://elsa.api";
    public TimeSpan? Lifetime { get; set; }

    public void Deconstruct(out string signingKey, out string issuer, out string audience, out TimeSpan? lifetime)
    {
        signingKey = SigningKey;
        issuer = Issuer;
        audience = Audience;
        lifetime = Lifetime;
    }
}