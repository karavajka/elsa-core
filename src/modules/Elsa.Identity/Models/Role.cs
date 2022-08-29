using Elsa.Persistence.Common.Entities;

namespace Elsa.Identity.Models;

public class Role : Entity
{
    public string Name { get; set; } = default!;
    public ICollection<string> Permissions { get; set; } = new List<string>();
}