using System;
using System.Linq;

namespace ForensicBackend.Services
{
    public class VectorMatcherService
    {
        public float[] ParseEmbedding(string embeddingStr)
        {
            if (string.IsNullOrWhiteSpace(embeddingStr)) return new float[0];
            return embeddingStr.Split(',').Select(float.Parse).ToArray();
        }

        public float ComputeCosineSimilarity(float[] vecA, float[] vecB)
        {
            if (vecA.Length != vecB.Length || vecA.Length == 0) return 0f;
            
            float dotProduct = 0f;
            float normA = 0f;
            float normB = 0f;
            
            for (int i = 0; i < vecA.Length; i++)
            {
                dotProduct += vecA[i] * vecB[i];
                normA += vecA[i] * vecA[i];
                normB += vecB[i] * vecB[i];
            }
            
            if (normA == 0 || normB == 0) return 0f;
            return (float)(dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB)));
        }
    }
}
