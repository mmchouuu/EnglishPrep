import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { uploadSpeakingImages } from '../scripts/upload_speaking_images.js';

const projectRoot = path.resolve(__dirname, '..');
const TEST_DIR = path.join(projectRoot, 'tests', 'fixtures_upload_test');
const TEST_MANIFEST_FILE = path.join(TEST_DIR, 'test-manifest.json');
const TEST_ASSETS_DIR = path.join(TEST_DIR, 'assets');

function computeHash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

describe('Phase Speaking Upload Script Unit Tests', () => {

  const sampleRecords = [];
  const localFileBuffers = new Map();

  beforeEach(() => {
    fs.mkdirSync(TEST_ASSETS_DIR, { recursive: true });
    sampleRecords.length = 0;
    localFileBuffers.clear();

    let recordIdx = 0;

    const addMockRecord = (idx, partNum, setKey, storageObjPath, variantIdx, sourceFilename) => {
      const sourceKey = `${setKey}-image${variantIdx}`;
      const buf = Buffer.from(`mock-image-content-for-record-${idx}`);
      const hash = computeHash(buf);
      const localFileAbs = path.join(TEST_ASSETS_DIR, ...storageObjPath.split('/'));

      fs.mkdirSync(path.dirname(localFileAbs), { recursive: true });
      fs.writeFileSync(localFileAbs, buf);
      localFileBuffers.set(storageObjPath, buf);

      sampleRecords.push({
        source_key: sourceKey,
        skill: 'speaking',
        part_number: partNum,
        set_key: setKey,
        image_role: partNum === 2 ? 'description_variant' : 'comparison_pair',
        layout: partNum === 2 ? 'single_photo' : 'combined_pair',
        variant_index: variantIdx,
        source_filename: sourceFilename,
        source_relative_path: `assets-source/speaking/${sourceFilename}`,
        public_path: `/assets/speaking/${storageObjPath}`,
        storage_bucket: 'speaking-images',
        storage_object_path: storageObjPath,
        content_hash: hash,
        file_size: buf.length,
        status: 'ready'
      });
    };

    // Part 2: 29 one-image sets (set-001 to set-029)
    for (let s = 1; s <= 29; s++) {
      recordIdx++;
      const setNumStr = String(s).padStart(3, '0');
      const storageObjPath = `part-2/set-${setNumStr}/photo-1.jpg`;
      addMockRecord(recordIdx, 2, `speaking-p2-set${setNumStr}`, storageObjPath, 1, `image${recordIdx}.jpg`);
    }

    // Part 2: 23 two-image sets (set-030 to set-052)
    for (let s = 30; s <= 52; s++) {
      const setNumStr = String(s).padStart(3, '0');
      for (let v = 1; v <= 2; v++) {
        recordIdx++;
        const storageObjPath = `part-2/set-${setNumStr}/photo-${v}.jpg`;
        addMockRecord(recordIdx, 2, `speaking-p2-set${setNumStr}`, storageObjPath, v, `image${recordIdx}.jpg`);
      }
    }

    // Part 3: 72 one-image sets (set-001 to set-072)
    for (let s = 1; s <= 72; s++) {
      recordIdx++;
      const setNumStr = String(s).padStart(3, '0');
      const storageObjPath = `part-3/set-${setNumStr}/comparison.jpg`;
      addMockRecord(recordIdx, 3, `speaking-p3-set${setNumStr}`, storageObjPath, 1, `image${recordIdx}.jpg`);
    }

    expect(sampleRecords.length).toBe(147);
    fs.writeFileSync(TEST_MANIFEST_FILE, JSON.stringify({ images: sampleRecords }, null, 2), 'utf8');
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  function createMockSupabaseClient({ remoteStore = new Map(), uploadCalls = [] }) {
    return {
      storage: {
        from: (bucketName) => ({
          download: async (objectPath) => {
            if (!remoteStore.has(objectPath)) {
              return {
                data: null,
                error: { message: 'Object not found', statusCode: 404 }
              };
            }
            const buf = remoteStore.get(objectPath);
            return {
              data: {
                arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
              },
              error: null
            };
          },
          upload: async (objectPath, buffer, options) => {
            uploadCalls.push({ objectPath, buffer, options });
            remoteStore.set(objectPath, buffer);
            return { data: { path: objectPath }, error: null };
          }
        })
      }
    };
  }

  test('1. Empty Supabase Storage Bucket -> 147 inserted, proposed_changes: 147, unchanged: 0', async () => {
    const remoteStore = new Map();
    const uploadCalls = [];
    const mockClient = createMockSupabaseClient({ remoteStore, uploadCalls });

    const stats = await uploadSpeakingImages({
      apply: false,
      supabaseClient: mockClient,
      manifestFilePath: TEST_MANIFEST_FILE,
      assetsDir: TEST_ASSETS_DIR
    });

    expect(stats.processed).toBe(147);
    expect(stats.proposed_changes).toBe(147);
    expect(stats.inserted).toBe(147);
    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(0);
    expect(stats.missing).toBe(0);
    expect(stats.errors).toBe(0);
    expect(uploadCalls.length).toBe(0);
  });

  test('2. All 147 objects exist in Storage with matching content hash -> 147 unchanged, proposed_changes: 0', async () => {
    const remoteStore = new Map();
    localFileBuffers.forEach((buf, path) => remoteStore.set(path, buf));

    const uploadCalls = [];
    const mockClient = createMockSupabaseClient({ remoteStore, uploadCalls });

    const stats = await uploadSpeakingImages({
      apply: false,
      supabaseClient: mockClient,
      manifestFilePath: TEST_MANIFEST_FILE,
      assetsDir: TEST_ASSETS_DIR
    });

    expect(stats.processed).toBe(147);
    expect(stats.proposed_changes).toBe(0);
    expect(stats.inserted).toBe(0);
    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(147);
    expect(stats.missing).toBe(0);
    expect(stats.errors).toBe(0);
    expect(uploadCalls.length).toBe(0);
  });

  test('3. One object has a different content hash in Storage -> 146 unchanged, 1 updated, proposed_changes: 1', async () => {
    const remoteStore = new Map();
    localFileBuffers.forEach((buf, path) => remoteStore.set(path, buf));

    const firstKey = Array.from(localFileBuffers.keys())[0];
    remoteStore.set(firstKey, Buffer.from('different-outdated-remote-content'));

    const uploadCalls = [];
    const mockClient = createMockSupabaseClient({ remoteStore, uploadCalls });

    const stats = await uploadSpeakingImages({
      apply: false,
      supabaseClient: mockClient,
      manifestFilePath: TEST_MANIFEST_FILE,
      assetsDir: TEST_ASSETS_DIR
    });

    expect(stats.processed).toBe(147);
    expect(stats.proposed_changes).toBe(1);
    expect(stats.inserted).toBe(0);
    expect(stats.updated).toBe(1);
    expect(stats.unchanged).toBe(146);
    expect(stats.missing).toBe(0);
    expect(stats.errors).toBe(0);
    expect(uploadCalls.length).toBe(0);
  });

  test('4. One local file is missing -> 1 missing, processed: 147', async () => {
    const remoteStore = new Map();
    const firstKey = Array.from(localFileBuffers.keys())[0];
    const missingFileAbs = path.join(TEST_ASSETS_DIR, ...firstKey.split('/'));

    if (fs.existsSync(missingFileAbs)) {
      fs.unlinkSync(missingFileAbs);
    }

    const uploadCalls = [];
    const mockClient = createMockSupabaseClient({ remoteStore, uploadCalls });

    const stats = await uploadSpeakingImages({
      apply: false,
      supabaseClient: mockClient,
      manifestFilePath: TEST_MANIFEST_FILE,
      assetsDir: TEST_ASSETS_DIR
    });

    expect(stats.processed).toBe(147);
    expect(stats.missing).toBe(1);
    expect(stats.inserted).toBe(146);
    expect(stats.proposed_changes).toBe(146);
  });

  test('5. Dry-run does NOT mutate Storage, but --apply mutates Storage', async () => {
    const remoteStore = new Map();
    const uploadCalls = [];
    const mockClient = createMockSupabaseClient({ remoteStore, uploadCalls });

    const dryStats = await uploadSpeakingImages({
      apply: false,
      supabaseClient: mockClient,
      manifestFilePath: TEST_MANIFEST_FILE,
      assetsDir: TEST_ASSETS_DIR
    });

    expect(dryStats.inserted).toBe(147);
    expect(uploadCalls.length).toBe(0);

    const applyStats = await uploadSpeakingImages({
      apply: true,
      supabaseClient: mockClient,
      manifestFilePath: TEST_MANIFEST_FILE,
      assetsDir: TEST_ASSETS_DIR
    });

    expect(applyStats.inserted).toBe(147);
    expect(uploadCalls.length).toBe(147);
    expect(remoteStore.size).toBe(147);
  });

});
