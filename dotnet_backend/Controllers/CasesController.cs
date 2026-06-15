using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ForensicBackend.Data;
using ForensicBackend.Services;

namespace ForensicBackend.Controllers
{
    [ApiController]
    [Route("api/cases")]
    public class CasesController : ControllerBase
    {
        private readonly ForensicDbContext _dbContext;
        private readonly VectorMatcherService _vectorMatcher;
        private readonly HttpClient _httpClient;
        
        private const double MATCH_THRESHOLD = 0.65;
        private const string FASTAPI_URL = "http://127.0.0.1:8000/api/v1/forensic-extract";

        public CasesController(ForensicDbContext dbContext, VectorMatcherService vectorMatcher)
        {
            _dbContext = dbContext;
            _vectorMatcher = vectorMatcher;
            _httpClient = new HttpClient();
        }

        [HttpPost("analyze-and-match")]
        public async Task<IActionResult> AnalyzeAndMatch([FromForm] IFormFile image, [FromForm] float fidelityW = 0.85f)
        {
            if (image == null || image.Length == 0)
                return BadRequest(new { error = "No image file provided." });

            try
            {
                // 1. Forward image to Python FastAPI Microservice
                using var content = new MultipartFormDataContent();
                
                using var fileStream = image.OpenReadStream();
                using var streamContent = new StreamContent(fileStream);
                streamContent.Headers.ContentType = new MediaTypeHeaderValue(image.ContentType);
                content.Add(streamContent, "file", image.FileName);
                content.Add(new StringContent(fidelityW.ToString()), "fidelity_w");

                var pythonResponse = await _httpClient.PostAsync(FASTAPI_URL, content);
                
                if (!pythonResponse.IsSuccessStatusCode)
                {
                    var errorBody = await pythonResponse.Content.ReadAsStringAsync();
                    return StatusCode(500, new { error = $"AI Pipeline failed: {errorBody}" });
                }

                // 2. Parse FastAPI response
                var responseBody = await pythonResponse.Content.ReadAsStringAsync();
                var aiData = JsonSerializer.Deserialize<JsonElement>(responseBody);

                var embeddingList = aiData.GetProperty("embedding").EnumerateArray().Select(x => x.GetSingle()).ToArray();
                var enhancedImagePath = aiData.GetProperty("enhanced_image_path").GetString();
                var bbox = aiData.GetProperty("bounding_box");

                // 3. Search Database for Match
                var allSuspects = _dbContext.Suspects.ToList();
                
                string bestMatchId = null;
                float bestScore = 0f;

                foreach (var suspect in allSuspects)
                {
                    var suspectVec = _vectorMatcher.ParseEmbedding(suspect.FaceEmbedding);
                    float score = _vectorMatcher.ComputeCosineSimilarity(embeddingList, suspectVec);

                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestMatchId = suspect.Name;
                    }
                }

                // 4. Construct response
                var isMatch = bestScore > MATCH_THRESHOLD;
                
                object suspectObj = null;
                if (isMatch)
                {
                    // Find the matched suspect from db (or we could just use the loop var, but we only saved ID)
                    var matchedSuspect = allSuspects.FirstOrDefault(s => s.Name == bestMatchId);
                    if (matchedSuspect != null)
                    {
                        suspectObj = new
                        {
                            id = matchedSuspect.Id,
                            name = matchedSuspect.Name,
                            details = "Suspect identified via AI embedding matching."
                        };
                    }
                }

                return Ok(new
                {
                    matchFound = isMatch,
                    suspect = suspectObj,
                    similarityScore = bestScore,
                    enhancedImageUrl = enhancedImagePath, 
                    message = isMatch ? "Identity match found." : "No identity match found."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}
