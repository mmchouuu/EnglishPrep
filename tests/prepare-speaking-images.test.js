import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { prepareSpeakingImages } from '../scripts/prepare_speaking_images.js';

describe('Phase Speaking Image Assets Preparation Unit Tests', () => {
  test('prepareSpeakingImages parses doc and satisfies all 147 logical mapping rules', () => {
    const result = prepareSpeakingImages({ apply: false });
    const { metadata, images } = result;

    // 1. Physical source images = 145
    expect(metadata.physical_source_count).toBe(145);

    // 2. Total logical image mappings = 147
    expect(metadata.logical_image_count).toBe(147);
    expect(images.length).toBe(147);

    // 3. Part 2 sets = 52
    expect(metadata.part2_set_count).toBe(52);

    // 4. Part 2 image count = 75
    expect(metadata.part2_image_count).toBe(75);

    // 5. Part 3 sets = 72
    expect(metadata.part3_set_count).toBe(72);

    // 6. Part 3 image count = 72
    expect(metadata.part3_image_count).toBe(72);

    // 7. Reused physical files count = 2
    expect(metadata.reused_physical_file_count).toBe(2);

    // Check specific reused files
    const reusedFilenames = metadata.reused_files.map(r => r.filename);
    expect(reusedFilenames).toContain('image14.jpg');
    expect(reusedFilenames).toContain('image143.jpg');

    // 8. No Windows absolute paths or file:// in manifest records
    images.forEach(rec => {
      expect(rec.public_path).not.toMatch(/^[a-zA-Z]:\\/);
      expect(rec.public_path).not.toMatch(/^file:\/\//);
      expect(rec.storage_object_path).not.toMatch(/^[a-zA-Z]:\\/);
      expect(rec.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(rec.file_size).toBeGreaterThan(0);
    });

    // 9. No duplicate logical source keys or destination paths
    const sourceKeys = new Set(images.map(i => i.source_key));
    const publicPaths = new Set(images.map(i => i.public_path));
    const storagePaths = new Set(images.map(i => i.storage_object_path));

    expect(sourceKeys.size).toBe(147);
    expect(publicPaths.size).toBe(147);
    expect(storagePaths.size).toBe(147);
  });
});
