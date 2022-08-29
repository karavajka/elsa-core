using Elsa.Identity.Models;

namespace Elsa.Identity.Options;

public class IdentityOptions
{
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Role> Roles { get; set; } = new List<Role>();
}