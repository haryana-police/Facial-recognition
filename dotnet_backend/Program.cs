using ForensicBackend.Data;
using ForensicBackend.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// 1. Add SQLite Database Connection
// Point this to the existing forensic_suspects.db
var dbPath = @"d:\Facial-recognition\forensic_suspects.db";
builder.Services.AddDbContext<ForensicDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// 2. Register Custom Services
builder.Services.AddScoped<VectorMatcherService>();

// 3. Add CORS to allow React Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:3000") // React port
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

app.UseCors("AllowReactApp");
app.UseAuthorization();
app.MapControllers();

// Ensure the app runs on Port 8080 like the Spring Boot app did
app.Run("http://localhost:8080");
