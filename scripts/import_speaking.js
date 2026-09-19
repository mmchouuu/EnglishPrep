import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const CANDIDATE_SOURCE_PATHS = [
  path.join(projectRoot, 'docs', 'aptis', '04-speaking.md'),
  path.join(projectRoot, 'docs', '04-speaking.md')
];

let SOURCE_FILE_ABS = null;
let SOURCE_FILE_REL = null;

for (const candPath of CANDIDATE_SOURCE_PATHS) {
  if (fs.existsSync(candPath)) {
    SOURCE_FILE_ABS = candPath;
    SOURCE_FILE_REL = path.relative(projectRoot, candPath).replace(/\\/g, '/');
    break;
  }
}

if (!SOURCE_FILE_ABS) {
  throw new Error(`[Phase Speaking Error] Speaking source file not found in candidate paths: ${CANDIDATE_SOURCE_PATHS.join(', ')}`);
}

const MANIFEST_DIR = path.join(projectRoot, 'docs', 'aptis', 'manifests');
const MANIFEST_FILE = path.join(MANIFEST_DIR, 'speaking.json');
const SEED_FILE = path.join(projectRoot, 'supabase', 'seed_speaking.sql');
const REPORT_FILE = path.join(projectRoot, 'docs', 'aptis', 'phase3-speaking-report.md');

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function canonicalize(obj) {
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

function computeImageFileHash(filename) {
  const fileAbs = path.join(projectRoot, 'assets-source', 'speaking', filename);
  if (fs.existsSync(fileAbs)) {
    return crypto.createHash('sha256').update(fs.readFileSync(fileAbs)).digest('hex');
  }
  return crypto.createHash('sha256').update(filename).digest('hex');
}

function computeCanonicalHash(q) {
  const rawObj = {
    content: q.content,
    correct_answer: null,
    metadata: q.metadata || {},
    options: [],
    part_number: q.partNumber,
    question_type: q.questionType,
    skill: 'speaking',
    ui_config: q.uiConfig || {}
  };

  if (q.contentBlocks && q.contentBlocks.length > 0) {
    rawObj.content_blocks = q.contentBlocks.map(cb => ({
      source_key: cb.sourceKey,
      content_hash: cb.contentHash
    })).sort((a, b) => a.source_key.localeCompare(b.source_key));
  }

  const canonicalObj = canonicalize(rawObj);
  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj), 'utf8').digest('hex');
}

function stripComments(str) {
  return str.replace(/<!--[\s\S]*?-->/g, '');
}

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

function detectHeadings(lines) {
  let p1Idx = -1;
  let p2Idx = -1;
  let p3Idx = -1;
  let p4Idx = -1;

  for (let i = 0; i < lines.length; i++) {
    const cleanLine = stripComments(lines[i]).trim();
    if (p1Idx === -1 && /Part\s*1\s*:/i.test(cleanLine)) {
      p1Idx = i;
    } else if (p2Idx === -1 && /Part\s*2\s*:/i.test(cleanLine)) {
      p2Idx = i;
    } else if (p3Idx === -1 && /Part\s*3\s*:/i.test(cleanLine)) {
      p3Idx = i;
    } else if (p4Idx === -1 && /Part\s*4\s*:/i.test(cleanLine)) {
      p4Idx = i;
    }
  }

  if (p1Idx === -1 || p2Idx === -1 || p3Idx === -1 || p4Idx === -1) {
    throw new Error(`[Heading Detection Failed] Found: Part1=${p1Idx}, Part2=${p2Idx}, Part3=${p3Idx}, Part4=${p4Idx}`);
  }

  return { p1Idx, p2Idx, p3Idx, p4Idx };
}

function parsePart1(lines, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const groups = [];
  const questions = [];
  const answers = [];
  const coreStoryPromptCounts = [];

  const topicRegex = /(?:<th[^>]*>|<td[^>]*colspan=["']?2["']?[^>]*>)\s*<strong>\s*(CORE STORY \d+\s*[–-]\s*[^<]+)\s*<\/strong>\s*<\/(?:th|td)>/gi;
  
  const topicMatches = [];
  let match;
  while ((match = topicRegex.exec(cleanContent)) !== null) {
    topicMatches.push({
      title: cleanText(match[1]),
      index: match.index
    });
  }

  if (topicMatches.length !== 24) {
    anomalies.push(`Part 1 expected 24 CORE STORY headings, but found ${topicMatches.length}`);
  }

  for (let i = 0; i < topicMatches.length; i++) {
    const curMatch = topicMatches[i];
    const nextMatch = topicMatches[i + 1];
    const blockText = cleanContent.substring(
      curMatch.index,
      nextMatch ? nextMatch.index : cleanContent.length
    );

    const topicNumStr = String(i + 1).padStart(3, '0');
    const groupKey = `speaking-p1-topic${topicNumStr}`;

    const groupObj = {
      groupKey: groupKey,
      skill: 'speaking',
      groupType: 'topic',
      name: curMatch.title,
      description: null,
      displayOrder: i + 1,
      metadata: {
        topic: curMatch.title,
        part_number: 1
      }
    };
    groups.push(groupObj);

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    let qCounter = 1;

    while ((trMatch = trRegex.exec(blockText)) !== null) {
      const rowHtml = trMatch[1];
      if (/CORE STORY \d+/i.test(rowHtml) || /<td[^>]*colspan=["']?2["']?[^>]*>\s*<strong>\s*EXTRA CORE\s*<\/strong>/i.test(rowHtml)) {
        continue;
      }

      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1]);
      }

      if (cells.length >= 1) {
        const leftCell = cells[0];
        const rightCell = cells[1] || '';

        const promptRegex = /<strong>([\s\S]*?)<\/strong>/gi;
        const promptTexts = [];
        let pMatch;
        while ((pMatch = promptRegex.exec(leftCell)) !== null) {
          const text = cleanText(pMatch[1]);
          if (text && !promptTexts.includes(text) && !/CORE STORY|EXTRA CORE/i.test(text)) {
            promptTexts.push(text);
          }
        }

        let mainPrompt = promptTexts[0] || cleanText(leftCell);
        if (!mainPrompt) continue;

        const sampleAnswer = cleanText(rightCell);
        const qNumStr = String(qCounter).padStart(3, '0');
        const questionSourceKey = `${groupKey}-q${qNumStr}`;
        const displayOrder = qCounter;
        qCounter++;

        const uiConfig = {
          topic: curMatch.title,
          prep_time: 0,
          speak_time: 30,
          expected_response_type: 'speaking_recording',
          image_count: 0,
          recording_required: true,
          speech_to_text_enabled: true
        };

        const metadata = {
          ui_config: uiConfig,
          prompt_variants: promptTexts.length > 1 ? promptTexts.slice(1) : []
        };

        const qObj = {
          sourceKey: questionSourceKey,
          groupKey: groupKey,
          groupType: 'topic',
          skill: 'speaking',
          partNumber: 1,
          questionType: 'speaking_recording',
          content: mainPrompt,
          displayOrder: displayOrder,
          metadata: metadata,
          uiConfig: uiConfig,
          contentBlocks: []
        };

        qObj.contentHash = computeCanonicalHash(qObj);
        questions.push(qObj);

        answers.push({
          questionSourceKey: questionSourceKey,
          solutionData: {
            sample_answer: sampleAnswer || null,
            sample_transcript: null,
            key_vocabulary: [],
            rubric: null,
            status: {
              missing_image: false,
              missing_sample_answer: !sampleAnswer,
              missing_rubric: true
            }
          }
        });
      }
    }

    coreStoryPromptCounts.push({
      topic: curMatch.title,
      promptCount: qCounter - 1
    });
  }

  return { groups, questions, answers, coreStoryPromptCounts };
}

function parsePart2(lines, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const groups = [];
  const contentBlocks = [];
  const questionContentBlocks = [];
  const questions = [];
  const answers = [];

  const setRegex = /(?:<th[^>]*>|<td[^>]*colspan=["']?3["']?[^>]*>)\s*<strong>\s*(SET\s+\d+[^<]*)\s*<\/strong>\s*<\/(?:th|td)>/gi;
  
  const setMatches = [];
  let match;
  while ((match = setRegex.exec(cleanContent)) !== null) {
    setMatches.push({
      title: cleanText(match[1]),
      index: match.index
    });
  }

  if (setMatches.length !== 52) {
    anomalies.push(`Part 2 expected 52 SETs, but found ${setMatches.length}`);
  }

  for (let i = 0; i < setMatches.length; i++) {
    const curMatch = setMatches[i];
    const nextMatch = setMatches[i + 1];
    const blockText = cleanContent.substring(
      curMatch.index,
      nextMatch ? nextMatch.index : cleanContent.length
    );

    const setNumStr = String(i + 1).padStart(3, '0');
    const groupKey = `speaking-p2-set${setNumStr}`;

    const groupObj = {
      groupKey: groupKey,
      skill: 'speaking',
      groupType: 'topic',
      name: curMatch.title,
      description: null,
      displayOrder: i + 1,
      metadata: {
        topic: curMatch.title,
        part_number: 2
      }
    };
    groups.push(groupObj);

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const rawImages = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(blockText)) !== null) {
      const src = imgMatch[1];
      const filename = path.basename(src);
      if (!rawImages.includes(filename)) {
        rawImages.push(filename);
      }
    }

    if (rawImages.length === 0) {
      anomalies.push(`Part 2 ${curMatch.title} has no image element!`);
    }

    const linkedContentBlocks = [];
    for (let imgIdx = 0; imgIdx < rawImages.length; imgIdx++) {
      const filename = rawImages[imgIdx];
      const varIdx = imgIdx + 1;
      const cbSourceKey = `${groupKey}-image${varIdx}`;
      const destFilename = `photo-${varIdx}.jpg`;
      const storageObjPath = `part-2/set-${setNumStr}/${destFilename}`;
      const pubPath = `/assets/speaking/part-2/set-${setNumStr}/${destFilename}`;
      const cbHash = computeImageFileHash(filename);

      const cbObj = {
        sourceKey: cbSourceKey,
        skill: 'speaking',
        partNumber: 2,
        blockType: 'image',
        title: `Photo Variant ${varIdx} for ${curMatch.title}`,
        content: null,
        mediaUrl: pubPath,
        contentHash: cbHash,
        contentRole: varIdx === 1 ? 'image_1' : 'image_2',
        metadata: {
          part_number: 2,
          set_key: groupKey,
          image_role: 'description_variant',
          layout: 'single_photo',
          variant_index: varIdx,
          source_filename: filename,
          public_path: pubPath,
          storage_bucket: 'speaking-images',
          storage_object_path: storageObjPath
        }
      };
      contentBlocks.push(cbObj);
      linkedContentBlocks.push(cbObj);
    }

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;

    let descTask = null;
    let followUp1 = null;
    let followUp2 = null;

    while ((trMatch = trRegex.exec(blockText)) !== null) {
      const rowHtml = trMatch[1];
      if (/SET\s+\d+/i.test(rowHtml)) continue;

      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1]);
      }

      if (cells.length >= 1) {
        if (/<img/i.test(cells[0])) continue;

        if (/PHOTO\s+\d+|DESCRIBE THE PICTURE/i.test(cells[0])) {
          let promptTitle = 'Describe the picture';
          let sampleAns1 = '';
          let sampleAns2 = '';

          for (const cell of cells) {
            const strongMatch = /<strong>([\s\S]*?)<\/strong>([\s\S]*)/i.exec(cell);
            if (strongMatch) {
              const pTitle = cleanText(strongMatch[1]);
              const pAns = cleanText(strongMatch[2]);
              if (/PHOTO 1/i.test(pTitle) || (!sampleAns1 && pAns)) {
                sampleAns1 = pAns;
              } else if (/PHOTO 2/i.test(pTitle) || pAns) {
                sampleAns2 = pAns;
              }
            }
          }

          let combinedAns = sampleAns1;
          if (sampleAns2) {
            combinedAns += '\n\n[Alternative Photo Description]: ' + sampleAns2;
          }

          descTask = {
            promptText: promptTitle,
            sampleAnswer: combinedAns
          };
        } else {
          const qText = cleanText(cells[0]);
          const ansText = cleanText(cells[1] || cells[2] || '');

          if (qText) {
            if (!followUp1) {
              followUp1 = { promptText: qText, sampleAnswer: ansText };
            } else if (!followUp2) {
              followUp2 = { promptText: qText, sampleAnswer: ansText };
            }
          }
        }
      }
    }

    const tasks = [descTask, followUp1, followUp2].filter(Boolean);

    if (tasks.length !== 3) {
      anomalies.push(`Part 2 ${curMatch.title} expected 3 prompts, found ${tasks.length}`);
    }

    let qCounter = 1;
    for (const item of tasks) {
      const qNumStr = String(qCounter).padStart(3, '0');
      const questionSourceKey = `${groupKey}-q${qNumStr}`;
      const displayOrder = qCounter;
      qCounter++;

      const uiConfig = {
        topic: curMatch.title,
        prep_time: 45,
        speak_time: 45,
        expected_response_type: 'speaking_recording',
        image_count: rawImages.length,
        recording_required: true,
        speech_to_text_enabled: true
      };

      const metadata = {
        ui_config: uiConfig
      };

      const qObj = {
        sourceKey: questionSourceKey,
        groupKey: groupKey,
        groupType: 'topic',
        skill: 'speaking',
        partNumber: 2,
        questionType: 'photo_description',
        content: item.promptText,
        displayOrder: displayOrder,
        metadata: metadata,
        uiConfig: uiConfig,
        contentBlocks: linkedContentBlocks
      };

      qObj.contentHash = computeCanonicalHash(qObj);
      questions.push(qObj);

      for (let order = 0; order < linkedContentBlocks.length; order++) {
        questionContentBlocks.push({
          questionSourceKey: questionSourceKey,
          contentBlockSourceKey: linkedContentBlocks[order].sourceKey,
          contentRole: linkedContentBlocks[order].contentRole,
          displayOrder: order + 1
        });
      }

      answers.push({
        questionSourceKey: questionSourceKey,
        solutionData: {
          sample_answer: item.sampleAnswer || null,
          sample_transcript: null,
          key_vocabulary: [],
          rubric: null,
          status: {
            missing_image: rawImages.length === 0,
            missing_sample_answer: !item.sampleAnswer,
            missing_rubric: true
          }
        }
      });
    }
  }

  return { groups, contentBlocks, questionContentBlocks, questions, answers };
}

function parsePart3(lines, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const groups = [];
  const contentBlocks = [];
  const questionContentBlocks = [];
  const questions = [];
  const answers = [];

  const setRegex = /\|\s*\*\*(SET\s+\d+[^*]*)\*\*\s*\|/gi;
  
  const setMatches = [];
  let match;
  while ((match = setRegex.exec(cleanContent)) !== null) {
    setMatches.push({
      title: cleanText(match[1]),
      index: match.index
    });
  }

  if (setMatches.length !== 72) {
    anomalies.push(`Part 3 expected 72 SETs, but found ${setMatches.length}`);
  }

  for (let i = 0; i < setMatches.length; i++) {
    const curMatch = setMatches[i];
    const nextMatch = setMatches[i + 1];
    const blockText = cleanContent.substring(
      curMatch.index,
      nextMatch ? nextMatch.index : cleanContent.length
    );

    const setNumStr = String(i + 1).padStart(3, '0');
    const groupKey = `speaking-p3-set${setNumStr}`;

    const groupObj = {
      groupKey: groupKey,
      skill: 'speaking',
      groupType: 'topic',
      name: curMatch.title,
      description: null,
      displayOrder: i + 1,
      metadata: {
        topic: curMatch.title,
        part_number: 3
      }
    };
    groups.push(groupObj);

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const rawImages = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(blockText)) !== null) {
      const src = imgMatch[1];
      const filename = path.basename(src);
      if (!rawImages.includes(filename)) {
        rawImages.push(filename);
      }
    }

    if (rawImages.length === 0) {
      anomalies.push(`Part 3 ${curMatch.title} has no image element!`);
    }

    const linkedContentBlocks = [];
    if (rawImages.length > 0) {
      const filename = rawImages[0];
      const cbSourceKey = `${groupKey}-image1`;
      const storageObjPath = `part-3/set-${setNumStr}/comparison.jpg`;
      const pubPath = `/assets/speaking/part-3/set-${setNumStr}/comparison.jpg`;
      const cbHash = computeImageFileHash(filename);

      const cbObj = {
        sourceKey: cbSourceKey,
        skill: 'speaking',
        partNumber: 3,
        blockType: 'image',
        title: `Combined Comparison Image for ${curMatch.title}`,
        content: null,
        mediaUrl: pubPath,
        contentHash: cbHash,
        contentRole: 'image_1',
        metadata: {
          part_number: 3,
          set_key: groupKey,
          image_role: 'comparison_pair',
          layout: 'combined_pair',
          source_filename: filename,
          public_path: pubPath,
          storage_bucket: 'speaking-images',
          storage_object_path: storageObjPath
        }
      };
      contentBlocks.push(cbObj);
      linkedContentBlocks.push(cbObj);
    }

    const rowRegex = /\|\s*([^|\n]+)\s*\|\s*([^|\n]*)\s*\|/g;
    let rowMatch;
    const prompts = [];

    while ((rowMatch = rowRegex.exec(blockText)) !== null) {
      const leftCol = rowMatch[1].trim();
      const rightCol = rowMatch[2].trim();

      if (leftCol.startsWith('---') || leftCol.includes('SET ')) continue;
      if (/<img/i.test(leftCol)) continue;

      const cleanQ = cleanText(leftCol);
      const cleanAns = cleanText(rightCol);

      if (cleanQ) {
        prompts.push({
          promptText: cleanQ,
          sampleAnswer: cleanAns
        });
      }
    }

    if (prompts.length !== 3) {
      anomalies.push(`Part 3 ${curMatch.title} expected 3 prompts, found ${prompts.length}`);
    }

    let qCounter = 1;
    for (const item of prompts) {
      const qNumStr = String(qCounter).padStart(3, '0');
      const questionSourceKey = `${groupKey}-q${qNumStr}`;
      const displayOrder = qCounter;
      qCounter++;

      const uiConfig = {
        topic: curMatch.title,
        prep_time: 45,
        speak_time: 45,
        expected_response_type: 'speaking_recording',
        image_count: 1,
        image_layout: 'combined',
        comparison_image_count: 2,
        recording_required: true,
        speech_to_text_enabled: true
      };

      const metadata = {
        ui_config: uiConfig
      };

      const qObj = {
        sourceKey: questionSourceKey,
        groupKey: groupKey,
        groupType: 'topic',
        skill: 'speaking',
        partNumber: 3,
        questionType: 'photo_comparison',
        content: item.promptText,
        displayOrder: displayOrder,
        metadata: metadata,
        uiConfig: uiConfig,
        contentBlocks: linkedContentBlocks
      };

      qObj.contentHash = computeCanonicalHash(qObj);
      questions.push(qObj);

      for (let order = 0; order < linkedContentBlocks.length; order++) {
        questionContentBlocks.push({
          questionSourceKey: questionSourceKey,
          contentBlockSourceKey: linkedContentBlocks[order].sourceKey,
          contentRole: linkedContentBlocks[order].contentRole,
          displayOrder: order + 1
        });
      }

      answers.push({
        questionSourceKey: questionSourceKey,
        solutionData: {
          sample_answer: item.sampleAnswer || null,
          sample_transcript: null,
          key_vocabulary: [],
          rubric: null,
          status: {
            missing_image: rawImages.length === 0,
            missing_sample_answer: !item.sampleAnswer,
            missing_rubric: true
          }
        }
      });
    }
  }

  return { groups, contentBlocks, questionContentBlocks, questions, answers };
}

function parsePart4(lines, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const groups = [];
  const questions = [];
  const answers = [];

  const coreStoryRegex = /(?:<th[^>]*>|<td[^>]*colspan=["']?3["']?[^>]*>)\s*<strong>\s*(CORE STORY \d+\s*[–-]\s*[^<]+)\s*<\/strong>\s*<\/(?:th|td)>/gi;
  const coreStoryMatches = [];
  let csMatch;
  while ((csMatch = coreStoryRegex.exec(cleanContent)) !== null) {
    coreStoryMatches.push({
      title: cleanText(csMatch[1]),
      index: csMatch.index
    });
  }

  if (coreStoryMatches.length !== 6) {
    anomalies.push(`Part 4 expected 6 CORE STORY headings, but found ${coreStoryMatches.length}`);
  }

  const moduleRegex = /(?:<th[^>]*>|<td[^>]*colspan=["']?3["']?[^>]*>)\s*<strong>\s*(MODULE\s+[A-Z]\s*–\s*[^<]+)\s*<\/strong>\s*<\/(?:th|td)>/gi;
  const moduleMatches = [];
  let mMatch;
  while ((mMatch = moduleRegex.exec(cleanContent)) !== null) {
    moduleMatches.push({
      title: cleanText(mMatch[1]),
      index: mMatch.index
    });
  }

  if (moduleMatches.length !== 58) {
    anomalies.push(`Part 4 expected 58 MODULEs, but found ${moduleMatches.length}`);
  }

  let totalVariantsCount = 0;

  for (let i = 0; i < moduleMatches.length; i++) {
    const curMatch = moduleMatches[i];
    const nextMatch = moduleMatches[i + 1];
    const blockText = cleanContent.substring(
      curMatch.index,
      nextMatch ? nextMatch.index : cleanContent.length
    );

    const topicNumStr = String(i + 1).padStart(3, '0');
    const groupKey = `speaking-p4-topic${topicNumStr}`;

    const groupObj = {
      groupKey: groupKey,
      skill: 'speaking',
      groupType: 'topic',
      name: curMatch.title,
      description: null,
      displayOrder: i + 1,
      metadata: {
        topic: curMatch.title,
        part_number: 4
      }
    };
    groups.push(groupObj);

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;

    let mainQuestionObj = null;
    let sub1Obj = null;
    let sub2Obj = null;

    let pendingMainQuestionHeader = false;

    while ((trMatch = trRegex.exec(blockText)) !== null) {
      const rowHtml = trMatch[1];
      if (/MODULE\s+[A-Z]/i.test(rowHtml)) continue;

      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1]);
      }

      if (cells.length >= 1) {
        const fullCellText = cells.map(cleanText).join(' ');

        if (/MAIN QUESTION(?:\s*\([^)]*\))?/i.test(fullCellText) && !/•|Talk about|Describe/i.test(fullCellText)) {
          pendingMainQuestionHeader = true;
          continue;
        }

        if (pendingMainQuestionHeader || /MAIN QUESTION/i.test(fullCellText)) {
          pendingMainQuestionHeader = false;
          const bulletRegex = /<strong>\s*[•\-\*]?\s*([^<]+)\s*<\/strong>/gi;
          const variants = [];
          let bMatch;
          while ((bMatch = bulletRegex.exec(rowHtml)) !== null) {
            const txt = cleanText(bMatch[1])
              .replace(/^(?:MAIN QUESTION|SUBQUESTION \d+)(?:\s*\([^)]*\))?\s*/i, '')
              .replace(/^[•\-\*]\s*/, '')
              .trim();
            if (txt && !variants.includes(txt) && !/MAIN QUESTION|source set/i.test(txt)) {
              variants.push(txt);
            }
          }

          if (variants.length === 0) {
            for (const c of cells) {
              const txt = cleanText(c).replace(/^(?:MAIN QUESTION|SUBQUESTION \d+)(?:\s*\([^)]*\))?\s*/i, '').replace(/^[•\-\*]\s*/, '').trim();
              if (txt && !variants.includes(txt) && !/MAIN QUESTION|source set/i.test(txt)) {
                variants.push(txt);
              }
            }
          }

          if (variants.length > 0) {
            totalVariantsCount += Math.max(0, variants.length - 1);
            mainQuestionObj = {
              promptText: variants[0],
              variants: variants.slice(1),
              sampleAnswer: cells.length >= 2 ? cleanText(cells[1]) : ''
            };
          }
        } else if (/SUBQUESTION 1/i.test(fullCellText)) {
          const bulletRegex = /<strong>\s*[•\-\*]?\s*([^<]+)\s*<\/strong>/gi;
          const variants = [];
          let bMatch;
          while ((bMatch = bulletRegex.exec(rowHtml)) !== null) {
            const txt = cleanText(bMatch[1])
              .replace(/^(?:SUBQUESTION \d+)(?:\s*\([^)]*\))?\s*/i, '')
              .replace(/^[•\-\*]\s*/, '')
              .trim();
            if (txt && !variants.includes(txt) && !/SUBQUESTION/i.test(txt)) {
              variants.push(txt);
            }
          }

          let promptTxt = variants[0] || cleanText(cells[0]).replace(/^SUBQUESTION 1(?:\s*\([^)]*\))?\s*/i, '').replace(/^[•\-\*]\s*/, '').trim();
          sub1Obj = {
            promptText: promptTxt,
            variants: variants.slice(1),
            sampleAnswer: cells.length >= 2 ? cleanText(cells[1]) : ''
          };
        } else if (/SUBQUESTION 2/i.test(fullCellText)) {
          const bulletRegex = /<strong>\s*[•\-\*]?\s*([^<]+)\s*<\/strong>/gi;
          const variants = [];
          let bMatch;
          while ((bMatch = bulletRegex.exec(rowHtml)) !== null) {
            const txt = cleanText(bMatch[1])
              .replace(/^(?:SUBQUESTION \d+)(?:\s*\([^)]*\))?\s*/i, '')
              .replace(/^[•\-\*]\s*/, '')
              .trim();
            if (txt && !variants.includes(txt) && !/SUBQUESTION/i.test(txt)) {
              variants.push(txt);
            }
          }

          let promptTxt = variants[0] || cleanText(cells[0]).replace(/^SUBQUESTION 2(?:\s*\([^)]*\))?\s*/i, '').replace(/^[•\-\*]\s*/, '').trim();
          sub2Obj = {
            promptText: promptTxt,
            variants: variants.slice(1),
            sampleAnswer: cells.length >= 2 ? cleanText(cells[1]) : ''
          };
        }
      }
    }

    const logicalTasks = [mainQuestionObj, sub1Obj, sub2Obj].filter(Boolean);

    if (logicalTasks.length !== 3) {
      anomalies.push(`Part 4 ${curMatch.title} expected 3 logical tasks, found ${logicalTasks.length}`);
    }

    let qCounter = 1;
    for (const task of logicalTasks) {
      const qNumStr = String(qCounter).padStart(3, '0');
      const questionSourceKey = `${groupKey}-q${qNumStr}`;
      const displayOrder = qCounter;
      qCounter++;

      const uiConfig = {
        topic: curMatch.title,
        prep_time: 60,
        speak_time: 120,
        expected_response_type: 'speaking_recording',
        image_count: 0,
        recording_required: true,
        speech_to_text_enabled: true
      };

      const metadata = {
        ui_config: uiConfig,
        prompt_variants: task.variants || []
      };

      const qObj = {
        sourceKey: questionSourceKey,
        groupKey: groupKey,
        groupType: 'topic',
        skill: 'speaking',
        partNumber: 4,
        questionType: 'speaking_recording',
        content: task.promptText,
        displayOrder: displayOrder,
        metadata: metadata,
        uiConfig: uiConfig,
        contentBlocks: []
      };

      qObj.contentHash = computeCanonicalHash(qObj);
      questions.push(qObj);

      answers.push({
        questionSourceKey: questionSourceKey,
        solutionData: {
          sample_answer: task.sampleAnswer || null,
          sample_transcript: null,
          key_vocabulary: [],
          rubric: null,
          status: {
            missing_image: false,
            missing_sample_answer: !task.sampleAnswer,
            missing_rubric: true
          }
        }
      });
    }
  }

  return {
    groups,
    questions,
    answers,
    coreStoryCount: coreStoryMatches.length,
    moduleCount: moduleMatches.length,
    promptVariantsCount: totalVariantsCount
  };
}

export function runImporter() {
  console.log('====================================================');
  console.log('[Phase Speaking] APTIS Speaking Importer Running...');
  console.log(`Source File: ${SOURCE_FILE_REL}`);
  console.log('====================================================');

  const anomalies = [];

  const rawContent = fs.readFileSync(SOURCE_FILE_ABS, 'utf8');
  const lines = rawContent.split(/\r?\n/);
  const headings = detectHeadings(lines);

  const p1Lines = lines.slice(headings.p1Idx, headings.p2Idx);
  const p2Lines = lines.slice(headings.p2Idx, headings.p3Idx);
  const p3Lines = lines.slice(headings.p3Idx, headings.p4Idx);
  const p4Lines = lines.slice(headings.p4Idx);

  const resP1 = parsePart1(p1Lines, anomalies);
  const resP2 = parsePart2(p2Lines, anomalies);
  const resP3 = parsePart3(p3Lines, anomalies);
  const resP4 = parsePart4(p4Lines, anomalies);

  const allGroups = [...resP1.groups, ...resP2.groups, ...resP3.groups, ...resP4.groups];
  const allContentBlocks = [...resP2.contentBlocks, ...resP3.contentBlocks];
  const allQuestionContentBlocks = [...resP2.questionContentBlocks, ...resP3.questionContentBlocks];
  const allQuestions = [...resP1.questions, ...resP2.questions, ...resP3.questions, ...resP4.questions];
  const allAnswers = [...resP1.answers, ...resP2.answers, ...resP3.answers, ...resP4.answers];

  if (resP1.groups.length !== 24) anomalies.push(`Structural Assertion Failed: Part 1 coreStoryCount is ${resP1.groups.length}, expected 24`);
  if (resP2.groups.length !== 52) anomalies.push(`Structural Assertion Failed: Part 2 setCount is ${resP2.groups.length}, expected 52`);
  if (resP2.questions.length !== 156) anomalies.push(`Structural Assertion Failed: Part 2 questionCount is ${resP2.questions.length}, expected 156`);
  if (resP3.groups.length !== 72) anomalies.push(`Structural Assertion Failed: Part 3 setCount is ${resP3.groups.length}, expected 72`);
  if (resP3.questions.length !== 216) anomalies.push(`Structural Assertion Failed: Part 3 questionCount is ${resP3.questions.length}, expected 216`);
  if (resP4.coreStoryCount !== 6) anomalies.push(`Structural Assertion Failed: Part 4 coreStoryCount is ${resP4.coreStoryCount}, expected 6`);
  if (resP4.moduleCount !== 58) anomalies.push(`Structural Assertion Failed: Part 4 moduleCount is ${resP4.moduleCount}, expected 58`);
  if (resP4.questions.length !== 174) anomalies.push(`Structural Assertion Failed: Part 4 questionCount is ${resP4.questions.length}, expected 174`);

  const uniqueKeys = new Set();
  const duplicateKeys = [];
  for (const q of allQuestions) {
    if (uniqueKeys.has(q.sourceKey)) {
      duplicateKeys.push(q.sourceKey);
    }
    uniqueKeys.add(q.sourceKey);
  }
  if (duplicateKeys.length > 0) {
    anomalies.push(`Duplicate source_keys found: ${duplicateKeys.join(', ')}`);
  }

  const missingAnswersCount = allAnswers.filter(a => !a.solutionData.sample_answer).length;
  const missingImagesCount = allAnswers.filter(a => a.solutionData.status.missing_image).length;

  console.log(`\n====================================================`);
  console.log(`[INSPECTION SUMMARY]`);
  console.log(`  Part 1 Core Stories: ${resP1.groups.length} (Questions: ${resP1.questions.length})`);
  console.log(`  Part 2 SETs: ${resP2.groups.length} (Questions: ${resP2.questions.length}, Image Blocks: ${resP2.contentBlocks.length})`);
  console.log(`  Part 3 SETs: ${resP3.groups.length} (Questions: ${resP3.questions.length}, Image Blocks: ${resP3.contentBlocks.length})`);
  console.log(`  Part 4 Core Stories: ${resP4.coreStoryCount}, Modules: ${resP4.moduleCount} (Questions: ${resP4.questions.length})`);
  console.log(`  Total Groups/Topics: ${allGroups.length}`);
  console.log(`  Total Logical Questions: ${allQuestions.length}`);
  console.log(`  Total Image Blocks: ${allContentBlocks.length}`);
  console.log(`  Total Prompt Variants: ${resP4.promptVariantsCount}`);
  console.log(`  Duplicate Source Keys: ${duplicateKeys.length}`);
  console.log(`  Missing Sample Answers: ${missingAnswersCount}`);
  console.log(`  Missing Image Blocks: ${missingImagesCount}`);
  console.log(`  Anomalies Count: ${anomalies.length}`);
  console.log(`====================================================\n`);

  if (anomalies.length > 0) {
    console.error(`[ANOMALIES DETECTED - IMPORTER ABORTED!]`);
    anomalies.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    throw new Error(`Import aborted due to ${anomalies.length} unresolved structural anomalies.`);
  }

  // Write Manifest
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const manifestData = allQuestions.map(q => ({
    source_key: q.sourceKey,
    content_hash: q.contentHash,
    part_number: q.partNumber,
    question_type: q.questionType
  }));
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`[Manifest Written] ${MANIFEST_FILE} (${manifestData.length} records)`);

  // Write Seed SQL - Idempotent & Fully compliant with Phase 0 Schema!
  let sql = `-- APTIS Speaking Initial Seed Data (Phase Speaking Image Integration)\n`;
  sql += `-- Generated on ${new Date().toISOString()}\n`;
  sql += `-- Fully compliant with Phase 0 schema (20260910000000_create_aptis_system.sql)\n\n`;
  sql += `BEGIN;\n\n`;

  sql += `-- Log import run\n`;
  sql += `INSERT INTO public.aptis_import_runs (\n`;
  sql += `  source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at\n`;
  sql += `) VALUES (\n`;
  sql += `  ${sqlLiteral(SOURCE_FILE_REL)}, 'speaking'::public.aptis_skill_enum, 'completed', ${allQuestions.length}, 0, 0, ${allQuestions.length}, 0, NOW(), NOW()\n`;
  sql += `);\n\n`;

  sql += `-- Upsert aptis_groups\n`;
  sql += `INSERT INTO public.aptis_groups (skill, group_type, group_key, name, description, display_order, metadata)\nVALUES\n`;
  const groupRows = allGroups.map(g => 
    `  ('speaking'::public.aptis_skill_enum, ${sqlLiteral(g.groupType)}, ${sqlLiteral(g.groupKey)}, ${sqlLiteral(g.name)}, ${sqlLiteral(g.description)}, ${g.displayOrder}, ${sqlLiteral(JSON.stringify(g.metadata))}::jsonb)`
  );
  sql += groupRows.join(',\n') + `\n`;
  sql += `ON CONFLICT (skill, group_type, group_key) DO UPDATE SET\n`;
  sql += `  name = EXCLUDED.name,\n`;
  sql += `  description = EXCLUDED.description,\n`;
  sql += `  display_order = EXCLUDED.display_order,\n`;
  sql += `  metadata = EXCLUDED.metadata\n`;
  sql += `WHERE aptis_groups.name IS DISTINCT FROM EXCLUDED.name\n`;
  sql += `   OR aptis_groups.description IS DISTINCT FROM EXCLUDED.description\n`;
  sql += `   OR aptis_groups.display_order IS DISTINCT FROM EXCLUDED.display_order\n`;
  sql += `   OR aptis_groups.metadata IS DISTINCT FROM EXCLUDED.metadata;\n\n`;

  if (allContentBlocks.length > 0) {
    sql += `-- Upsert aptis_content_blocks\n`;
    sql += `INSERT INTO public.aptis_content_blocks (skill, block_type, source_key, title, content, media_url, metadata, content_hash)\nVALUES\n`;
    const cbRows = allContentBlocks.map(cb =>
      `  ('speaking'::public.aptis_skill_enum, ${sqlLiteral(cb.blockType)}, ${sqlLiteral(cb.sourceKey)}, ${sqlLiteral(cb.title)}, ${sqlLiteral(cb.content)}, ${sqlLiteral(cb.mediaUrl)}, ${sqlLiteral(JSON.stringify(cb.metadata))}::jsonb, ${sqlLiteral(cb.contentHash)})`
    );
    sql += cbRows.join(',\n') + `\n`;
    sql += `ON CONFLICT (skill, source_key) DO UPDATE SET\n`;
    sql += `  title = EXCLUDED.title,\n`;
    sql += `  content = EXCLUDED.content,\n`;
    sql += `  media_url = EXCLUDED.media_url,\n`;
    sql += `  metadata = EXCLUDED.metadata,\n`;
    sql += `  content_hash = EXCLUDED.content_hash\n`;
    sql += `WHERE aptis_content_blocks.title IS DISTINCT FROM EXCLUDED.title\n`;
    sql += `   OR aptis_content_blocks.content IS DISTINCT FROM EXCLUDED.content\n`;
    sql += `   OR aptis_content_blocks.media_url IS DISTINCT FROM EXCLUDED.media_url\n`;
    sql += `   OR aptis_content_blocks.metadata IS DISTINCT FROM EXCLUDED.metadata\n`;
    sql += `   OR aptis_content_blocks.content_hash IS DISTINCT FROM EXCLUDED.content_hash;\n\n`;
  }

  sql += `-- Upsert aptis_questions\n`;
  sql += `INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash)\nVALUES\n`;
  const qRows = allQuestions.map(q =>
    `  ('speaking'::public.aptis_skill_enum, ${q.partNumber}, ${sqlLiteral(q.questionType)}, ${sqlLiteral(q.sourceKey)}, ${sqlLiteral(SOURCE_FILE_REL)}, ${sqlLiteral(q.content)}, ${q.displayOrder}, ${sqlLiteral(JSON.stringify(q.uiConfig))}::jsonb, ${sqlLiteral(JSON.stringify(q.metadata))}::jsonb, ${sqlLiteral(q.contentHash)})`
  );
  sql += qRows.join(',\n') + `\n`;
  sql += `ON CONFLICT (skill, source_key) DO UPDATE SET\n`;
  sql += `  part_number = EXCLUDED.part_number,\n`;
  sql += `  question_type = EXCLUDED.question_type,\n`;
  sql += `  source_file = EXCLUDED.source_file,\n`;
  sql += `  content = EXCLUDED.content,\n`;
  sql += `  display_order = EXCLUDED.display_order,\n`;
  sql += `  ui_config = EXCLUDED.ui_config,\n`;
  sql += `  metadata = EXCLUDED.metadata,\n`;
  sql += `  content_hash = EXCLUDED.content_hash\n`;
  sql += `WHERE aptis_questions.content IS DISTINCT FROM EXCLUDED.content\n`;
  sql += `   OR aptis_questions.ui_config IS DISTINCT FROM EXCLUDED.ui_config\n`;
  sql += `   OR aptis_questions.metadata IS DISTINCT FROM EXCLUDED.metadata\n`;
  sql += `   OR aptis_questions.content_hash IS DISTINCT FROM EXCLUDED.content_hash;\n\n`;

  sql += `-- Upsert aptis_question_groups\n`;
  sql += `INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)\n`;
  sql += `SELECT q.id, g.id, qg.display_order\n`;
  sql += `FROM (VALUES\n`;
  const qgRows = allQuestions.map(q =>
    `  (${sqlLiteral(q.sourceKey)}, ${sqlLiteral(q.groupType)}, ${sqlLiteral(q.groupKey)}, ${q.displayOrder})`
  );
  sql += qgRows.join(',\n') + `\n`;
  sql += `) AS qg(question_source_key, group_type, group_key, display_order)\n`;
  sql += `JOIN public.aptis_questions q ON q.skill = 'speaking'::public.aptis_skill_enum AND q.source_key = qg.question_source_key\n`;
  sql += `JOIN public.aptis_groups g ON g.skill = 'speaking'::public.aptis_skill_enum AND g.group_type = qg.group_type AND g.group_key = qg.group_key\n`;
  sql += `ON CONFLICT (question_id, group_id) DO UPDATE SET\n`;
  sql += `  display_order = EXCLUDED.display_order\n`;
  sql += `WHERE aptis_question_groups.display_order IS DISTINCT FROM EXCLUDED.display_order;\n\n`;

  if (allQuestionContentBlocks.length > 0) {
    sql += `-- Upsert aptis_question_content_blocks\n`;
    sql += `INSERT INTO public.aptis_question_content_blocks (question_id, content_block_id, content_role, display_order)\n`;
    sql += `SELECT q.id, cb.id, qcb.content_role, qcb.display_order\n`;
    sql += `FROM (VALUES\n`;
    const qcbRows = allQuestionContentBlocks.map(qcb =>
      `  (${sqlLiteral(qcb.questionSourceKey)}, ${sqlLiteral(qcb.contentBlockSourceKey)}, ${sqlLiteral(qcb.contentRole)}, ${qcb.displayOrder})`
    );
    sql += qcbRows.join(',\n') + `\n`;
    sql += `) AS qcb(question_source_key, content_block_source_key, content_role, display_order)\n`;
    sql += `JOIN public.aptis_questions q ON q.skill = 'speaking'::public.aptis_skill_enum AND q.source_key = qcb.question_source_key\n`;
    sql += `JOIN public.aptis_content_blocks cb ON cb.skill = 'speaking'::public.aptis_skill_enum AND cb.source_key = qcb.content_block_source_key\n`;
    sql += `ON CONFLICT (question_id, content_block_id, content_role) DO UPDATE SET\n`;
    sql += `  display_order = EXCLUDED.display_order\n`;
    sql += `WHERE aptis_question_content_blocks.display_order IS DISTINCT FROM EXCLUDED.display_order;\n\n`;
  }

  sql += `-- Upsert aptis_question_answers\n`;
  sql += `INSERT INTO public.aptis_question_answers (question_id, solution_data)\n`;
  sql += `SELECT q.id, a.solution_data::jsonb\n`;
  sql += `FROM (VALUES\n`;
  const ansRows = allAnswers.map(ans =>
    `  (${sqlLiteral(ans.questionSourceKey)}, ${sqlLiteral(JSON.stringify(ans.solutionData))})`
  );
  sql += ansRows.join(',\n') + `\n`;
  sql += `) AS a(question_source_key, solution_data)\n`;
  sql += `JOIN public.aptis_questions q ON q.skill = 'speaking'::public.aptis_skill_enum AND q.source_key = a.question_source_key\n`;
  sql += `ON CONFLICT (question_id) DO UPDATE SET\n`;
  sql += `  solution_data = EXCLUDED.solution_data\n`;
  sql += `WHERE aptis_question_answers.solution_data IS DISTINCT FROM EXCLUDED.solution_data;\n\n`;

  sql += `COMMIT;\n`;

  fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
  fs.writeFileSync(SEED_FILE, sql, 'utf8');
  console.log(`[Seed SQL Written] ${SEED_FILE}`);

  return {
    allGroups,
    allContentBlocks,
    allQuestionContentBlocks,
    allQuestions,
    allAnswers
  };
}

if (process.argv[1] && process.argv[1].endsWith('import_speaking.js')) {
  runImporter();
}
