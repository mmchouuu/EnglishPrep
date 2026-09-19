import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SOURCE_MD_FILE = path.join(projectRoot, 'docs', '04-speaking.md');
const ASSETS_SOURCE_DIR = path.join(projectRoot, 'assets-source', 'speaking');
const PUBLIC_ASSETS_DIR = path.join(projectRoot, 'public', 'assets', 'speaking');
const MANIFEST_FILE = path.join(projectRoot, 'docs', 'aptis', 'manifests', 'speaking-images.json');

function computeFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function stripComments(str) {
  return str.replace(/<!--[\s\S]*?-->/g, '');
}

function detectHeadings(lines) {
  let p1Idx = -1, p2Idx = -1, p3Idx = -1, p4Idx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = stripComments(lines[i]).trim();
    if (p1Idx === -1 && /Part\s*1\s*:/i.test(line)) p1Idx = i;
    else if (p2Idx === -1 && /Part\s*2\s*:/i.test(line)) p2Idx = i;
    else if (p3Idx === -1 && /Part\s*3\s*:/i.test(line)) p3Idx = i;
    else if (p4Idx === -1 && /Part\s*4\s*:/i.test(line)) p4Idx = i;
  }

  if (p1Idx === -1 || p2Idx === -1 || p3Idx === -1 || p4Idx === -1) {
    throw new Error(`Heading detection failed: P1=${p1Idx}, P2=${p2Idx}, P3=${p3Idx}, P4=${p4Idx}`);
  }

  return { p1Idx, p2Idx, p3Idx, p4Idx };
}

function parsePart2Images(p2Lines) {
  const content = p2Lines.join('\n');
  const cleanContent = stripComments(content);

  const setRegex = /(?:<th[^>]*>|<td[^>]*colspan=["']?3["']?[^>]*>)\s*<strong>\s*(SET\s+\d+[^<]*)\s*<\/strong>\s*<\/(?:th|td)>/gi;
  const setMatches = [];
  let match;

  while ((match = setRegex.exec(cleanContent)) !== null) {
    setMatches.push({
      title: match[1].trim(),
      index: match.index
    });
  }

  const records = [];
  let oneImageSetCount = 0;
  let twoImageSetCount = 0;

  for (let i = 0; i < setMatches.length; i++) {
    const curMatch = setMatches[i];
    const nextMatch = setMatches[i + 1];
    const blockText = cleanContent.substring(
      curMatch.index,
      nextMatch ? nextMatch.index : cleanContent.length
    );

    const setNum = i + 1;
    const setNumStr = String(setNum).padStart(3, '0');
    const setKey = `speaking-p2-set${setNumStr}`;

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const imagesInBlock = [];
    let imgMatch;

    while ((imgMatch = imgRegex.exec(blockText)) !== null) {
      const rawSrc = imgMatch[1];
      const filename = path.basename(rawSrc);
      if (!imagesInBlock.includes(filename)) {
        imagesInBlock.push(filename);
      }
    }

    if (imagesInBlock.length === 1) oneImageSetCount++;
    else if (imagesInBlock.length === 2) twoImageSetCount++;

    for (let imgIdx = 0; imgIdx < imagesInBlock.length; imgIdx++) {
      const filename = imagesInBlock[imgIdx];
      const variantIdx = imgIdx + 1;
      const destFilename = `photo-${variantIdx}.jpg`;
      const storageObjectPath = `part-2/set-${setNumStr}/${destFilename}`;
      const publicPath = `/assets/speaking/part-2/set-${setNumStr}/${destFilename}`;
      const sourceKey = `${setKey}-image${variantIdx}`;

      records.push({
        source_key: sourceKey,
        skill: 'speaking',
        part_number: 2,
        set_key: setKey,
        image_role: 'description_variant',
        layout: 'single_photo',
        variant_index: variantIdx,
        source_filename: filename,
        source_relative_path: `assets-source/speaking/${filename}`,
        public_path: publicPath,
        storage_bucket: 'speaking-images',
        storage_object_path: storageObjectPath,
        content_hash: null,
        file_size: 0,
        status: 'pending'
      });
    }
  }

  return { records, setMatches, oneImageSetCount, twoImageSetCount };
}

function parsePart3Images(p3Lines) {
  const content = p3Lines.join('\n');
  const cleanContent = stripComments(content);

  const setRegex = /\|\s*\*\*(SET\s+\d+[^*]*)\*\*\s*\|/gi;
  const setMatches = [];
  let match;

  while ((match = setRegex.exec(cleanContent)) !== null) {
    setMatches.push({
      title: match[1].trim(),
      index: match.index
    });
  }

  const records = [];

  for (let i = 0; i < setMatches.length; i++) {
    const curMatch = setMatches[i];
    const nextMatch = setMatches[i + 1];
    const blockText = cleanContent.substring(
      curMatch.index,
      nextMatch ? nextMatch.index : cleanContent.length
    );

    const setNum = i + 1;
    const setNumStr = String(setNum).padStart(3, '0');
    const setKey = `speaking-p3-set${setNumStr}`;

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const imagesInBlock = [];
    let imgMatch;

    while ((imgMatch = imgRegex.exec(blockText)) !== null) {
      const rawSrc = imgMatch[1];
      const filename = path.basename(rawSrc);
      if (!imagesInBlock.includes(filename)) {
        imagesInBlock.push(filename);
      }
    }

    if (imagesInBlock.length > 0) {
      const filename = imagesInBlock[0];
      const destFilename = `comparison.jpg`;
      const storageObjectPath = `part-3/set-${setNumStr}/${destFilename}`;
      const publicPath = `/assets/speaking/part-3/set-${setNumStr}/${destFilename}`;
      const sourceKey = `${setKey}-image1`;

      records.push({
        source_key: sourceKey,
        skill: 'speaking',
        part_number: 3,
        set_key: setKey,
        image_role: 'comparison_pair',
        layout: 'combined_pair',
        source_filename: filename,
        source_relative_path: `assets-source/speaking/${filename}`,
        public_path: publicPath,
        storage_bucket: 'speaking-images',
        storage_object_path: storageObjectPath,
        content_hash: null,
        file_size: 0,
        status: 'pending'
      });
    }
  }

  return { records, setMatches };
}

export function prepareSpeakingImages({ apply = false } = {}) {
  console.log('====================================================');
  console.log(`[Phase Speaking] Image Assets Preparation (${apply ? 'APPLY' : 'DRY-RUN'})`);
  console.log('====================================================');

  if (!fs.existsSync(SOURCE_MD_FILE)) {
    throw new Error(`Source Markdown file not found: ${SOURCE_MD_FILE}`);
  }

  const rawContent = fs.readFileSync(SOURCE_MD_FILE, 'utf8');
  const lines = rawContent.split(/\r?\n/);
  const headings = detectHeadings(lines);

  const p2Lines = lines.slice(headings.p2Idx, headings.p3Idx);
  const p3Lines = lines.slice(headings.p3Idx, headings.p4Idx);

  const resP2 = parsePart2Images(p2Lines);
  const resP3 = parsePart3Images(p3Lines);

  const allRecords = [...resP2.records, ...resP3.records];

  // Resolve source files, calculate SHA-256 hashes, verify existence
  const uniquePhysicalFiles = new Set();
  const fileUsageMap = new Map();
  const destPathSet = new Set();
  const storageObjectPathSet = new Set();
  const sourceKeySet = new Set();

  let missingFilesCount = 0;

  for (const record of allRecords) {
    if (sourceKeySet.has(record.source_key)) {
      throw new Error(`Duplicate logical source_key detected: ${record.source_key}`);
    }
    sourceKeySet.add(record.source_key);

    if (destPathSet.has(record.public_path)) {
      throw new Error(`Duplicate destination public_path detected: ${record.public_path}`);
    }
    destPathSet.add(record.public_path);

    if (storageObjectPathSet.has(record.storage_object_path)) {
      throw new Error(`Duplicate storage_object_path detected: ${record.storage_object_path}`);
    }
    storageObjectPathSet.add(record.storage_object_path);

    const sourceFileAbs = path.join(ASSETS_SOURCE_DIR, record.source_filename);

    if (!fs.existsSync(sourceFileAbs)) {
      console.error(`[Missing Source File] ${record.source_filename} at ${sourceFileAbs}`);
      missingFilesCount++;
      record.status = 'missing';
      continue;
    }

    uniquePhysicalFiles.add(record.source_filename);

    if (!fileUsageMap.has(record.source_filename)) {
      fileUsageMap.set(record.source_filename, []);
    }
    fileUsageMap.get(record.source_filename).push(record);

    const stats = fs.statSync(sourceFileAbs);
    const hash = computeFileHash(sourceFileAbs);

    record.content_hash = hash;
    record.file_size = stats.size;
    record.status = 'ready';
  }

  // Count physical file reuses
  const reusedPhysicalFiles = [];
  for (const [filename, usages] of fileUsageMap.entries()) {
    if (usages.length > 1) {
      reusedPhysicalFiles.push({ filename, usages });
    }
  }

  // Strict Assertions
  const assertions = [
    { label: 'Physical source images', actual: uniquePhysicalFiles.size, expected: 145 },
    { label: 'Part 2 sets', actual: resP2.setMatches.length, expected: 52 },
    { label: 'Part 2 images', actual: resP2.records.length, expected: 75 },
    { label: 'Part 2 one-image sets', actual: resP2.oneImageSetCount, expected: 29 },
    { label: 'Part 2 two-image sets', actual: resP2.twoImageSetCount, expected: 23 },
    { label: 'Part 3 sets', actual: resP3.setMatches.length, expected: 72 },
    { label: 'Part 3 images', actual: resP3.records.length, expected: 72 },
    { label: 'Total logical images', actual: allRecords.length, expected: 147 },
    { label: 'Unique logical source keys', actual: sourceKeySet.size, expected: 147 },
    { label: 'Missing source files', actual: missingFilesCount, expected: 0 },
    { label: 'Reused physical files count', actual: reusedPhysicalFiles.length, expected: 2 }
  ];

  console.log('\n--- Structural Assertions ---');
  let failedAssertions = 0;
  for (const a of assertions) {
    const passed = a.actual === a.expected;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${a.label}: actual=${a.actual}, expected=${a.expected}`);
    if (!passed) failedAssertions++;
  }

  // Specific check for image14.jpg and image143.jpg reuse
  const image14Usages = fileUsageMap.get('image14.jpg') || [];
  const image143Usages = fileUsageMap.get('image143.jpg') || [];

  if (image14Usages.length !== 2) {
    console.error(`[FAIL] image14.jpg expected 2 usages, found ${image14Usages.length}`);
    failedAssertions++;
  } else {
    console.log(`  [PASS] image14.jpg reused correctly in 2 Part 2 logical mappings (${image14Usages.map(u => u.source_key).join(', ')})`);
  }

  if (image143Usages.length !== 2) {
    console.error(`[FAIL] image143.jpg expected 2 usages, found ${image143Usages.length}`);
    failedAssertions++;
  } else {
    console.log(`  [PASS] image143.jpg reused correctly in 2 Part 3 logical mappings (${image143Usages.map(u => u.source_key).join(', ')})`);
  }

  if (failedAssertions > 0) {
    throw new Error(`[ABORTED] Image preparation failed ${failedAssertions} assertions.`);
  }

  // Build Image Manifest Payload
  const manifestPayload = {
    metadata: {
      generated_at: new Date().toISOString(),
      skill: 'speaking',
      physical_source_count: uniquePhysicalFiles.size,
      logical_image_count: allRecords.length,
      part2_set_count: resP2.setMatches.length,
      part2_image_count: resP2.records.length,
      part3_set_count: resP3.setMatches.length,
      part3_image_count: resP3.records.length,
      missing_count: missingFilesCount,
      duplicate_source_key_count: 0,
      reused_physical_file_count: reusedPhysicalFiles.length,
      reused_files: reusedPhysicalFiles.map(r => ({
        filename: r.filename,
        source_keys: r.usages.map(u => u.source_key)
      }))
    },
    images: allRecords
  };

  if (apply) {
    // Copy files to public/assets/speaking/
    for (const record of allRecords) {
      const srcAbs = path.join(ASSETS_SOURCE_DIR, record.source_filename);
      const destAbs = path.join(PUBLIC_ASSETS_DIR, ...record.storage_object_path.split('/'));

      fs.mkdirSync(path.dirname(destAbs), { recursive: true });
      fs.copyFileSync(srcAbs, destAbs);
    }
    console.log(`\n[APPLY] Copied ${allRecords.length} image files to ${PUBLIC_ASSETS_DIR}`);

    // Write Manifest
    fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifestPayload, null, 2), 'utf8');
    console.log(`[APPLY] Written manifest to ${MANIFEST_FILE}`);
  } else {
    console.log(`\n[DRY-RUN] Verified ${allRecords.length} records cleanly. Pass --apply to write output.`);
  }

  return manifestPayload;
}

if (process.argv[1] && process.argv[1].endsWith('prepare_speaking_images.js')) {
  const isApply = process.argv.includes('--apply');
  prepareSpeakingImages({ apply: isApply });
}
