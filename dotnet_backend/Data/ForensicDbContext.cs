using Microsoft.EntityFrameworkCore;
using ForensicBackend.Models;

namespace ForensicBackend.Data
{
    public class ForensicDbContext : DbContext
    {
        public DbSet<Suspect> Suspects { get; set; }

        public ForensicDbContext(DbContextOptions<ForensicDbContext> options) : base(options) { }
    }
}
