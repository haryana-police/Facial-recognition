import axios from 'axios'

/**
 * POST /api/cases/analyze-and-match
 * Sends the CCTV image + fidelity_w to Spring Boot.
 * Spring Boot orchestrates the AI microservice call + DB matching.
 *
 * @param {File}   imageFile  - Raw image file from the user
 * @param {number} fidelityW  - CodeFormer fidelity weight [0.0 – 1.0]
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeAndMatch(imageFile, fidelityW = 0.85) {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('fidelity_w', fidelityW.toString())

  const response = await axios.post('/api/cases/analyze-and-match', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000, // 2 min — AI pipeline can be slow on first run
  })

  return response.data
}

/**
 * @typedef {Object} AnalysisResult
 * @property {boolean}      matchFound
 * @property {number}       similarityScore   - 0.0 – 1.0
 * @property {SuspectDto|null} suspect
 * @property {string}       enhancedImageUrl  - URL served by Spring Boot
 * @property {string}       message
 */

/**
 * @typedef {Object} SuspectDto
 * @property {number} id
 * @property {string} name
 * @property {string} details
 */
