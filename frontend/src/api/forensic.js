import axios from 'axios'

/**
 * POST /api/cases/analyze-and-match
 * Sends CCTV image + optional pre-filters to Node.js backend.
 *
 * @param {File}   imageFile  - Raw image file from the user
 * @param {number} fidelityW  - CodeFormer fidelity weight [0.0 – 1.0]
 * @param {Object} filters    - { gender, age, height_cm } (all optional)
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeAndMatch(imageFile, fidelityW = 0.85, filters = {}) {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('fidelity_w', fidelityW.toString())

  if (filters.gender)      formData.append('gender',       filters.gender)
  if (filters.age_from)    formData.append('age_from',     filters.age_from.toString())
  if (filters.age_to)      formData.append('age_to',       filters.age_to.toString())
  if (filters.height_from) formData.append('height_from',  filters.height_from.toString())
  if (filters.height_to)   formData.append('height_to',    filters.height_to.toString())

  const response = await axios.post('/api/cases/analyze-and-match', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  })

  return response.data
}

/**
 * POST /api/suspects/upload-with-csv
 * Upload a single suspect image + CSV file with metadata.
 *
 * @param {File} imageFile
 * @param {File} csvFile
 * @returns {Promise<Object>}
 */
export async function uploadSuspectWithCsv(imageFile, csvFile) {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('csv', csvFile)

  const response = await axios.post('/api/suspects/upload-with-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180_000,
  })

  return response.data
}

/**
 * POST /api/suspects/bulk-upload-csv
 * Upload a CSV file with metadata for many suspects.
 *
 * @param {File} csvFile
 * @returns {Promise<Object>}
 */
export async function bulkUploadCsv(csvFile) {
  const formData = new FormData()
  formData.append('csv', csvFile)

  const response = await axios.post('/api/suspects/bulk-upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  })

  return response.data
}
