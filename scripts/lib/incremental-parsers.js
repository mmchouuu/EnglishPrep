import { computeCanonicalQuestionHash, computeContentBlockHash } from './canonical-hash.js';
import { validateSourceKey } from './source-key.js';

/**
 * Parses YAML front matter from update file markdown content.
 */
export function parseFrontMatter(content) {
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = frontMatterRegex.exec(content);

  if (!match) {
    throw new Error(`[Front Matter Missing] Update file must start with YAML front matter (--- ... ---).`);
  }

  const lines = match[1].split(/\r?\n/);
  const metadata = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      metadata[key] = val;
    }
  }

  if (!metadata.skill) {
    throw new Error(`[Front Matter Invalid] 'skill' attribute is required in front matter.`);
  }

  const skill = metadata.skill.toLowerCase();
  if (!['reading', 'listening', 'speaking', 'writing'].includes(skill)) {
    throw new Error(`[Front Matter Invalid] Unsupported skill '${metadata.skill}'. Must be reading, listening, speaking, or writing.`);
  }

  if (metadata.operation && metadata.operation.toLowerCase() === 'delete') {
    throw new Error(`[Operation Not Allowed] Operation 'delete' is not supported in incremental import.`);
  }

  return {
    frontMatter: metadata,
    body: content.substring(match[0].length)
  };
}

/**
 * Clean text strings for consistent hash calculation.
 */
function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a table row is header or separator.
 */
function isTableMetaRow(col1, col2) {
  const c1 = col1.toLowerCase();
  const c2 = col2 ? col2.toLowerCase() : '';
  if (c1.startsWith('---') || c2.startsWith('---')) return true;
  if (c1 === 'question' || c1 === 'prompt' || c1 === 'item') return true;
  return false;
}

/**
 * Parses question fragments from an update file body.
 * NOTE: groupKey is ONLY set if explicitly passed via options.explicitGroupKey (from Front Matter or CLI).
 * It MUST NOT be inferred from headings, titles, question numbers, or fallback defaults.
 */
export function parseIncrementalFragment(skill, body, manifestKeys = [], options = {}) {
  const questions = [];
  const groups = [];
  const contentBlocks = [];
  const answers = [];
  const anomalies = [];

  // Only explicit groupKey from front matter or CLI is allowed
  const explicitGroupKey = options.explicitGroupKey || null;

  const lines = body.split(/\r?\n/);
  let currentPart = options.partNumber || 1;
  let currentMarkerKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Part heading updates part number for schema, but DOES NOT set group_key!
    const partMatch = /Part\s*(\d+)/i.exec(line);
    if (partMatch) {
      currentPart = parseInt(partMatch[1], 10);
      continue;
    }

    // Check for source_key comment marker
    const keyMatch = /<!--\s*source_key:\s*([a-z0-9-]+)\s*-->/i.exec(line);
    if (keyMatch) {
      currentMarkerKey = keyMatch[1].trim();
      const valRes = validateSourceKey(currentMarkerKey, skill);
      if (!valRes.valid) {
        anomalies.push(valRes.reason);
      }
      continue;
    }

    // Ignore plain markdown headings
    if (line.startsWith('#')) {
      continue;
    }

    // Parse Markdown Table Row
    if (line.includes('|')) {
      const cols = line.split('|').map(c => cleanText(c));
      if (cols.length > 0 && cols[0] === '') cols.shift();
      if (cols.length > 0 && cols[cols.length - 1] === '') cols.pop();

      if (cols.length >= 1) {
        const col1 = cols[0];
        const col2 = cols.length >= 2 ? cols[1] : '';

        if (isTableMetaRow(col1, col2)) {
          continue; // Skip header / separator row
        }

        const sourceKey = currentMarkerKey || null;
        currentMarkerKey = null;

        const qObj = {
          sourceKey: sourceKey,
          groupKey: explicitGroupKey, // MUST be null unless explicitly specified in Front Matter or CLI!
          groupType: explicitGroupKey ? 'practice_set' : null,
          skill: skill,
          partNumber: currentPart,
          questionType: skill === 'writing' ? 'text_input' : (skill === 'speaking' ? 'speaking_recording' : 'multiple_choice'),
          content: col1,
          displayOrder: questions.length + 1,
          metadata: {
            part_number: currentPart,
            section_name: `Part ${currentPart}`
          },
          uiConfig: {
            input_type: skill === 'writing' ? 'textarea' : 'radio',
            autosave: true
          },
          options: (skill === 'reading' || skill === 'listening') && col2 ? [
            { content: col2, displayOrder: 1, optionKey: 'opt_1' }
          ] : [],
          correctAnswer: (skill === 'reading' || skill === 'listening') && col2 ? 'opt_1' : null
        };

        qObj.contentHash = computeCanonicalQuestionHash(qObj);
        questions.push(qObj);

        if (col2) {
          answers.push({
            questionSourceKey: sourceKey,
            solutionData: {
              sample_answer: col2,
              model_answer: col2,
              explanation: null,
              rubric: null
            }
          });
        }
      }
    }
  }

  return {
    questions,
    groups,
    contentBlocks,
    answers,
    anomalies
  };
}
