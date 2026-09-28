const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { extractText } = require('../services/parsingService');
const { classifyAndExtract } = require('../services/classificationService');
const { uploadFile } = require('../services/storageService');
const { storeChunks } = require('../services/retrievalService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// POST /api/upload  (multipart/form-data, field name "file")
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file attached (expected form field "file")' });
  }

  try {
    // 1. Extract text (or vision-transcribe, for images)
    const text = await extractText(file.buffer, file.mimetype);

    // 2. Classify into the fixed taxonomy + pull out structured dates/amounts
    const classification = text.trim().length > 0
      ? await classifyAndExtract(text)
      : { category: 'Others', subcategory: null, events: [] };

    // 3. Store the raw file (Supabase Storage if <=50MB, else R2)
    const stored = await uploadFile(req.supabase, {
      userId: req.user.id,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    // 4. Write the metadata row
    const { data: fileRow, error: fileError } = await req.supabase
      .from('files')
      .insert({
        user_id: req.user.id,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_provider: stored.provider,
        storage_path: stored.path,
        category: classification.category,
        subcategory: classification.subcategory,
      })
      .select()
      .single();

    if (fileError) throw new Error(`Failed to save file metadata: ${fileError.message}`);

    // 5. Chunk + embed the text, store vectors linked to this file (skips cleanly if text is empty)
    if (text.trim().length > 0) {
      await storeChunks(req.supabase, {
        fileId: fileRow.id,
        userId: req.user.id,
        category: classification.category,
        text,
      });
    }

    // 6. Store any extracted structured events (dates/amounts) - this is what the dashboard reads
    // IMPORTANT: sanitize event_type - LLMs sometimes return values outside the allowed enum
    // (e.g. "effective_date", "payment_date"). Clamp to "other" so the CHECK constraint never
    // silently kills the entire insert batch.
    const ALLOWED_EVENT_TYPES = new Set(['expiry', 'renewal', 'due_date', 'birthday', 'amount', 'other']);
    if (classification.events.length > 0) {
      const eventRows = classification.events
        .filter((e) => e.event_date || e.amount) // skip empty/junk extractions
        .map((e) => ({
          file_id: fileRow.id,
          user_id: req.user.id,
          event_type: ALLOWED_EVENT_TYPES.has(e.event_type) ? e.event_type : 'other',
          event_date: e.event_date || null,
          description: e.description || null,
          amount: e.amount ?? null,
        }));
      if (eventRows.length > 0) {
        const { error: eventsError } = await req.supabase.from('extracted_events').insert(eventRows);
        if (eventsError) console.error('Failed to save extracted events:', eventsError.message);
      }
    }

    res.status(201).json({ file: fileRow, extractedEvents: classification.events });
  } catch (err) {
    console.error('Upload pipeline failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
