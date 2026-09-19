import crypto from 'crypto';

/**
 * Deeply sorts object keys recursively for deterministic JSON serialization.
 */
export function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sortedKeys = Object.keys(obj).sort();
  const res = {};
  for (const key of sortedKeys) {
    res[key] = canonicalize(obj[key]);
  }
  return res;
}

/**
 * Computes canonical hash for a question across any skill.
 * Strictly excludes: timestamp, UUID, run_id, absolute paths, or question's own source_key.
 */
export function computeCanonicalQuestionHash(q) {
  const skill = q.skill;
  const rawObj = {
    skill: skill,
    part_number: q.partNumber,
    question_type: q.questionType,
    content: q.content,
    correct_answer: q.correctAnswer !== undefined ? q.correctAnswer : null,
    options: (q.options || []).map(o => ({
      content: o.content,
      display_order: o.displayOrder,
      option_key: o.optionKey
    })).sort((a, b) => a.display_order - b.display_order),
    metadata: q.metadata || {},
    ui_config: q.uiConfig || {}
  };

  // Skill-specific content block bindings if present
  if (q.contentBlock) {
    rawObj.content_block = {
      source_key: q.contentBlock.sourceKey,
      content_hash: q.contentBlock.contentHash
    };
  }

  if (q.contentBlocks && q.contentBlocks.length > 0) {
    rawObj.content_blocks = q.contentBlocks.map(cb => ({
      source_key: cb.sourceKey,
      content_hash: cb.contentHash
    })).sort((a, b) => a.source_key.localeCompare(b.source_key));
  }

  const canonicalObj = canonicalize(rawObj);
  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj), 'utf8').digest('hex');
}

/**
 * Computes canonical hash for a content block (passage, audio, image, instructions).
 */
export function computeContentBlockHash(blockType, mediaUrl, content, title) {
  const obj = canonicalize({
    block_type: blockType,
    media_url: mediaUrl || '',
    content: content || '',
    title: title || ''
  });
  return crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
}
