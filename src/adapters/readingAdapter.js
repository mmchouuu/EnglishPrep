import { normalizeCorrectAnswer } from '../services/aptisService.js';

/**
 * Clean HTML tags from string
 */
function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip leading "Heading 1:", "Paragraph 2 -", "H3:" from heading text
 */
function cleanHeadingText(text) {
  if (!text) return '';
  let str = cleanHtml(text);
  str = str.replace(/^(?:Heading|Paragraph|Section|P|H)\s*\d+\s*[:—\-]?\s*/i, '').trim();
  return str;
}

/**
 * Deterministic pseudo-random shuffle based on seed string
 */
function shuffleList(list = [], seedStr = '') {
  if (!Array.isArray(list) || list.length <= 1) return list;
  const copy = [...list];
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    hash = Math.sin(hash + i) * 10000;
    const j = Math.floor((hash - Math.floor(hash)) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 1. Part 1 Adapter: Multiple Choice Sentence Comprehension
 */
export function adaptPart1Data(questions = []) {
  if (!Array.isArray(questions)) return { questions: [] };

  const adapted = questions.map((q, idx) => {
    const options = (q.options || []).map((opt) => ({
      key: opt.option_key || String.fromCharCode(65 + (opt.display_order || 1) - 1),
      text: cleanHtml(opt.content)
    }));

    return {
      id: q.id,
      sourceKey: q.source_key,
      prompt: cleanHtml(q.content),
      options,
      displayOrder: q.display_order || idx + 1
    };
  });

  return { questions: adapted };
}

/**
 * 2. Part 2-3 Adapter: Sentence Ordering (Text Cohesion)
 * Supports multiple exercise sets and topics.
 * Scrambles initial sentence order so user must rearrange them.
 */
export function adaptPart2Data(questions = [], group = null) {
  if (!Array.isArray(questions)) {
    return { sets: [], set: { id: 'empty-set', title: 'Set 1', sentences: [] } };
  }

  const sets = questions.map((q, qIdx) => {
    const rawSentences = (q.options || []).map((opt) => ({
      id: opt.option_key || String(opt.display_order),
      text: cleanHtml(opt.content),
      display_order: opt.display_order
    }));

    // Scramble sentence list for initial UI layout
    let sentences = shuffleList(rawSentences, q.id || q.source_key || `p2-set-${qIdx}`);

    let rawTopic =
      q.passage?.title ||
      q.metadata?.title ||
      q.metadata?.topic_name ||
      (q.content && q.content.includes(':') ? q.content.split(':').slice(1).join(':').trim() : null) ||
      group?.name ||
      `Exercise Set ${qIdx + 1}`;
    let topicName = rawTopic.replace(/^READING PART \d+:\s*/i, '').trim();

    let rawContent = cleanHtml(q.content);
    let instructions = rawContent;
    if (!instructions) {
      instructions = 'Read the sentences below. Drag and drop them into the correct order to make a coherent text.';
    } else {
      instructions = instructions.replace(/:\s*[^:]+$/, '').trim();
      if (!instructions.endsWith('.')) instructions += '.';
    }

    return {
      id: q.id,
      sourceKey: q.source_key,
      title: topicName,
      topicName,
      instructions,
      sentences
    };
  });

  return {
    sets,
    set: sets[0] || { id: 'empty-set', title: 'Set 1', sentences: [] }
  };
}

/**
 * 3. Part 4 Adapter: Opinion Matching
 * Robustly parses Person A, B, C, D texts from passage content blocks or HTML tables.
 */
export function adaptPart4Data(questions = [], group = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { topicName: group?.name || 'READING PART 4', persons: [], questions: [], topicSets: [] };
  }

  const setGroupsMap = new Map();

  questions.forEach((q) => {
    const rawSetKey = q.passage?.title || q.metadata?.title || (q.source_key ? q.source_key.replace(/-q\d+$/i, '') : '') || group?.name || 'default-set';
    if (!setGroupsMap.has(rawSetKey)) {
      setGroupsMap.set(rawSetKey, []);
    }
    setGroupsMap.get(rawSetKey).push(q);
  });

  const topicSets = [];
  let setIdx = 0;

  for (const [setKey, chunkQuestions] of setGroupsMap.entries()) {
    setIdx++;
    const firstQ = chunkQuestions[0];
    let rawPassage = firstQ?.passage?.content || '';

    const personKeys = ['A', 'B', 'C', 'D'];
    const personMap = {};

    if (rawPassage) {
      personKeys.forEach((key) => {
        const pattern = new RegExp(
          `(?:^|\\n|<p>|<strong>)\\s*(?:Person\\s+)?${key}\\s*[\\.:—\\-]?\\s*(?:<\\/strong>)?\\s*([\\s\\S]*?)(?=(?:(?:^|\\n|<p>|<strong>)\\s*(?:Person\\s+)?[A-D]\\s*[\\.:—\\-])|$)`,
          'i'
        );
        const match = rawPassage.match(pattern);
        if (match && match[1]) {
          personMap[key] = cleanHtml(match[1]);
        }
      });
    }

    const persons = personKeys.map((key) => {
      let text = personMap[key] || '';

      if (!text && firstQ?.passage?.metadata?.persons) {
        const metaP = firstQ.passage.metadata.persons;
        if (metaP[key]) {
          text = typeof metaP[key] === 'string' ? cleanHtml(metaP[key]) : cleanHtml(metaP[key].text || '');
        }
      }

      return {
        key,
        name: `Person ${key}`,
        text: text || `Person ${key} opinion statement.`
      };
    });

    const adaptedQuestions = chunkQuestions.map((q, idx) => {
      return {
        id: q.id,
        num: idx + 1,
        globalNum: idx + 1,
        text: cleanHtml(q.content),
        sourceKey: q.source_key
      };
    });

    const setTopicName = firstQ?.passage?.title || firstQ?.metadata?.title || group?.name || `TOPIC ${setIdx}`;

    topicSets.push({
      id: `p4-topic-set-${setIdx}`,
      topicName: setTopicName,
      persons,
      questions: adaptedQuestions
    });
  }

  return {
    topicName: group?.name || topicSets[0]?.topicName || 'HEALTHY LIFESTYLES',
    persons: topicSets[0]?.persons || [],
    questions: topicSets[0]?.questions || [],
    topicSets
  };
}

/**
 * 4. Part 5 Adapter: Heading Matching (Long Text Comprehension)
 * Robustly parses Paragraph 1..7 texts and headings across all exercise sets.
 * Cleans "Heading X:" prefixes and shuffles heading dropdown options.
 */
export function adaptPart5Data(questions = [], group = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { topicName: group?.name || 'READING PART 5', headingOptions: [], sections: [], topicSets: [] };
  }

  const setGroupsMap = new Map();

  questions.forEach((q) => {
    const rawSetKey = q.passage?.title || q.metadata?.title || (q.source_key ? q.source_key.replace(/-q\d+$/i, '') : '') || group?.name || 'default-set';
    if (!setGroupsMap.has(rawSetKey)) {
      setGroupsMap.set(rawSetKey, []);
    }
    setGroupsMap.get(rawSetKey).push(q);
  });

  const topicSets = [];
  let setIdx = 0;

  for (const [setKey, chunkQuestions] of setGroupsMap.entries()) {
    setIdx++;
    const firstQ = chunkQuestions[0];

    let headingOptions = [];
    if (firstQ && firstQ.options && firstQ.options.length > 0) {
      headingOptions = firstQ.options.map((opt) => ({
        key: opt.option_key || String(opt.display_order),
        text: cleanHeadingText(opt.content)
      }));
    } else {
      headingOptions = Array.from({ length: chunkQuestions.length }, (_, idx) => ({
        key: String(idx + 1),
        text: `Heading option ${idx + 1}`
      }));
    }

    // Shuffle options in dropdown list so they do not reveal sequential answers
    headingOptions = shuffleList(headingOptions, setKey || `p5-set-${setIdx}`);

    let rawPassage = firstQ?.passage?.content || '';

    let parsedParagraphs = [];
    if (rawPassage) {
      const paraHeaderRegex = /(?:^|\n)\s*(?:Paragraph\s+\d+|P\d+|\b\d+\.)\s*[:—\.]?\s*/gi;
      const splitBlocks = rawPassage.split(paraHeaderRegex).map(p => cleanHtml(p)).filter(Boolean);
      if (splitBlocks.length > 0) {
        parsedParagraphs = splitBlocks;
      } else {
        const doubleNewlineBlocks = rawPassage.split(/\n\s*\n/).map(b => cleanHtml(b)).filter(Boolean);
        if (doubleNewlineBlocks.length > 0) {
          parsedParagraphs = doubleNewlineBlocks;
        }
      }
    }

    const sections = chunkQuestions.map((q, idx) => {
      let paraText = parsedParagraphs[idx] || '';

      if (!paraText && q.metadata?.paragraph_text) {
        paraText = cleanHtml(q.metadata.paragraph_text);
      }

      if (!paraText) {
        paraText = cleanHtml(q.content) || `Paragraph ${idx + 1} text.`;
      }

      paraText = paraText.replace(/^(?:Paragraph|Section|P)?\s*\d+[:—\.]?\s*/i, '').trim();

      return {
        id: q.id,
        key: String(idx + 1),
        label: `Paragraph ${idx + 1}`,
        text: paraText,
        sourceKey: q.source_key
      };
    });

    const setTopicName = firstQ?.passage?.title || firstQ?.metadata?.title || group?.name || `TOPIC ${setIdx}`;

    topicSets.push({
      id: `p5-topic-set-${setIdx}`,
      topicName: setTopicName,
      headingOptions,
      sections
    });
  }

  return {
    topicName: group?.name || topicSets[0]?.topicName || 'SCIENCE & TECHNOLOGY',
    headingOptions: topicSets[0]?.headingOptions || [],
    sections: topicSets[0]?.sections || [],
    topicSets
  };
}
