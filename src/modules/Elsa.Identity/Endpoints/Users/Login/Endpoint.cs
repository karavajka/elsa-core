using Elsa.Identity.Services;
using FastEndpoints;

namespace Elsa.Identity.Endpoints.Users.Login;

public class Login : Endpoint<Request, Response>
{
    private readonly ICredentialsValidator _credentialsValidator;
    private readonly IAccessTokenIssuer _tokenIssuer;

    public Login(ICredentialsValidator credentialsValidator, IAccessTokenIssuer tokenIssuer)
    {
        _credentialsValidator = credentialsValidator;
        _tokenIssuer = tokenIssuer;
    }

    public override void Configure()
    {
        Post("/identity/login");
        AllowAnonymous();
    }

    public override async Task<Response> ExecuteAsync(Request request, CancellationToken cancellationToken)
    {
        var user = await _credentialsValidator.ValidateAsync(request.Username.Trim(), request.Password.Trim(), cancellationToken);

        if (user == null)
        {
            await SendUnauthorizedAsync(cancellationToken);
            return null!;
        }

        var token = await _tokenIssuer.IssueTokenAsync(user, cancellationToken);

        return new Response
        {
            AccessToken = token
        };
    }
}