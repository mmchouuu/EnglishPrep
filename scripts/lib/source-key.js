import fs from 'fs';
import path from 'path';

/**
 * Validates whether a source key matches the expected skill prefix and format.
 */
export function validateSourceKey(sourceKey, skill) {
  if (!sourceKey || typeof sourceKey !== 'string') {
    return { valid: false, reason: 'Source key must be a non-empty string.' };
  }

  if (!sourceKey.startsWith(`${skill}-`)) {
    return { valid: false, reason: `Source key '${sourceKey}' does not match expected skill prefix '${skill}-'.` };
  }

  if (!/^[a-z0-9-]+$/i.test(sourceKey)) {
    return { valid: false, reason: `Source key '${sourceKey}' contains invalid characters.` };
  }

  return { valid: true };
}

/**
 * Extract existing source_key markers from a markdown string.
 */
export function extractSourceKeyMarkers(markdownContent) {
  const matches = [];
  const regex = /<!--\s*source_key:\s*([a-z0-9-]+)\s*-->/gi;
  let match;
  while ((match = regex.exec(markdownContent)) !== null) {
    matches.push({
      sourceKey: match[1],
      index: match.index,
      fullMarker: match[0]
    });
  }
  return matches;
}

/**
 * Normalizes any manifest structure into a standard array of entry objects.
 */
export function normalizeManifestEntries(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`[MANIFEST_FORMAT_UNSUPPORTED] Manifest data must be a non-null object or array.`);
  }

  const entries = [];

  if (Array.isArray(manifest.questions)) {
    for (const item of manifest.questions) {
      if (item && typeof item === 'object' && item.source_key) {
        entries.push({
          source_key: item.source_key,
          content_hash: item.current_content_hash || item.content_hash || item.initial_content_hash || '',
          part_number: item.part || item.part_number || 1,
          group_key: item.group_key || '',
          ...item
        });
      }
    }
    return entries;
  }

  if (Array.isArray(manifest)) {
    for (const item of manifest) {
      if (item && typeof item === 'object' && item.source_key) {
        entries.push({
          source_key: item.source_key,
          content_hash: item.current_content_hash || item.content_hash || '',
          part_number: item.part || item.part_number || 1,
          group_key: item.group_key || '',
          ...item
        });
      }
    }
    return entries;
  }

  const keys = Object.keys(manifest);
  const isMap = keys.some(k => /^[a-z]+-p\d+-/i.test(k) || /^[a-z]+-[a-z0-9-]+-p\d+-/i.test(k));

  if (isMap) {
    for (const k of keys) {
      const val = manifest[k];
      if (val && typeof val === 'object') {
        entries.push({
          source_key: k,
          content_hash: val.content_hash || val.current_content_hash || '',
          part_number: val.part_number || val.part || 1,
          group_key: val.group_key || '',
          ...val
        });
      }
    }
    return entries;
  }

  if ('skill' in manifest || 'questions' in manifest || keys.length === 0) {
    return entries;
  }

  throw new Error(`[MANIFEST_FORMAT_UNSUPPORTED] Unable to recognize manifest structure.`);
}

/**
 * Generates the next stable, collision-free source key.
 * Distinguishes two strict modes:
 * 1. Mode "existing_group": When explicitGroupKey is provided (from Front Matter or CLI).
 * 2. Mode "new_set": When explicitGroupKey is null/omitted. Finds maxSet across reservedKeys for skill + partNumber and creates maxSet + 1, q001.
 * 
 * Returns { candidateKey, keyGenerationMode }
 */
export function generateNextSourceKey(skill, partNumber, explicitGroupKey, reservedKeys) {
  const reservedSet = new Set(reservedKeys || []);

  let keyGenerationMode = 'new_set';
  let setNum = 1;
  let qSeq = 1;

  if (explicitGroupKey && typeof explicitGroupKey === 'string') {
    keyGenerationMode = 'existing_group';

    const setMatch = /(?:set|topic)(\d+)/i.exec(explicitGroupKey);
    if (setMatch) {
      setNum = parseInt(setMatch[1], 10);
    }
    const groupPrefix = explicitGroupKey.endsWith('-') ? explicitGroupKey : `${explicitGroupKey}-`;
    let maxQ = 0;

    for (const key of reservedSet) {
      if (key.startsWith(groupPrefix) || key.includes(`-p${partNumber}-set${String(setNum).padStart(3, '0')}-`)) {
        const qMatch = /-q(\d+)$/i.exec(key);
        if (qMatch) {
          const qVal = parseInt(qMatch[1], 10);
          if (qVal > maxQ) maxQ = qVal;
        }
      }
    }
    qSeq = maxQ + 1;

    let candidateKey = `${explicitGroupKey}-q${String(qSeq).padStart(3, '0')}`;
    let attempts = 0;
    while (reservedSet.has(candidateKey)) {
      qSeq++;
      candidateKey = `${explicitGroupKey}-q${String(qSeq).padStart(3, '0')}`;
      attempts++;
      if (attempts > 1000) {
        throw new Error(`[SOURCE_KEY_COLLISION_RISK] Unable to generate collision-free key for group ${explicitGroupKey}.`);
      }
    }

    if (reservedSet.has(candidateKey)) {
      throw new Error(`[SOURCE_KEY_COLLISION_RISK] Generated key '${candidateKey}' collides with reservedKeys.`);
    }

    return { candidateKey, keyGenerationMode };

  } else {
    // Mode: "new_set"
    keyGenerationMode = 'new_set';

    let maxSet = 0;
    for (const key of reservedSet) {
      const match = new RegExp(`${skill}-.*p${partNumber}-(?:set|topic)(\\d+)`, 'i').exec(key) ||
                    new RegExp(`${skill}-p${partNumber}-(?:set|topic)(\\d+)`, 'i').exec(key);
      if (match) {
        const sVal = parseInt(match[1], 10);
        if (sVal > maxSet) maxSet = sVal;
      }
    }

    if (maxSet > 0) {
      setNum = maxSet + 1;
      qSeq = 1;
    } else {
      setNum = 1;
      qSeq = 1;
    }

    let candidateKey = `${skill}-p${partNumber}-set${String(setNum).padStart(3, '0')}-q${String(qSeq).padStart(3, '0')}`;
    let attempts = 0;

    while (reservedSet.has(candidateKey)) {
      qSeq++;
      candidateKey = `${skill}-p${partNumber}-set${String(setNum).padStart(3, '0')}-q${String(qSeq).padStart(3, '0')}`;
      attempts++;

      if (attempts > 100) {
        setNum++;
        qSeq = 1;
        candidateKey = `${skill}-p${partNumber}-set${String(setNum).padStart(3, '0')}-q${String(qSeq).padStart(3, '0')}`;
      }

      if (attempts > 2000) {
        throw new Error(`[SOURCE_KEY_COLLISION_RISK] Unable to generate collision-free source_key for ${skill} Part ${partNumber}.`);
      }
    }

    if (reservedSet.has(candidateKey)) {
      throw new Error(`[SOURCE_KEY_COLLISION_RISK] Generated key '${candidateKey}' collides with reservedKeys.`);
    }

    return { candidateKey, keyGenerationMode };
  }
}
