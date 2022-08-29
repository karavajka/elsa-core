using Elsa.Persistence.Common.Entities;

namespace Elsa.Identity.Models;

public class User : Entity
{
    public string Name { get; set; } = default!;
    public string HashedPassword { get; set; } = default!;
    public ICollection<Role> Roles { get; set; } = default!;
}