namespace Elsa.Identity.Endpoints.Users.Login;

public class Request
{
    public string Username { get; set; } = default!;
    public string Password { get; set; } = default!;
}

public class Response
{
    public string AccessToken { get; set; } = default!;
}