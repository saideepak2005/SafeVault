const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { analyzeImage } = require('./llmService');

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const TEXT_TYPES = ['text/plain', 'text/csv', 'application/json'];

// Returns plain text for whatever file type was uploaded. This text is what
// gets chunked + embedded for search. For images, we ask Gemini's vision
// model to describe/transcribe the content instead of running local OCR -
// one API covers both "read the text" and "describe the image" in one call.
async function extractText(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const result = await pdfParse(buffer);
    return result.text || '';
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  if (TEXT_TYPES.includes(mimeType)) {
    return buffer.toString('utf-8');
  }

  if (IMAGE_TYPES.includes(mimeType)) {
    const base64 = buffer.toString('base64');
    const prompt =
      'Transcribe every piece of readable text in this image exactly as written. ' +
      'If it is a form, ID, receipt, or scanned document, preserve field labels and values. ' +
      'If there is no readable text, briefly describe what the image shows.';
    return analyzeImage(base64, mimeType, prompt);
  }

  // Unsupported type (e.g. .doc, .xlsx, .zip) - still store the file itself,
  // just without searchable text. Flagged clearly so it's not a silent gap.
  console.warn(`No text extractor for mime type "${mimeType}" - file will be stored but not searchable.`);
  return '';
}

module.exports = { extractText };
