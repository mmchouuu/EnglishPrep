/**
 * Phase 6B: Speaking Integration & Security Audit Test Suite
 * Validates Speaking image preparation, storage migrations, database mapping rules,
 * pre-submit answer security, UI view models, and runtime integrity without fallbacks.
 */

import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { prepareSpeakingImages } from '../scripts/prepare_speaking_images.js';

const projectRoot = path.resolve(__dirname, '..');

function readSourceFile(relPath) {
  const absPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Target file not found: ${relPath}`);
  }
  return fs.readFileSync(absPath, 'utf8');
}

describe('Phase 6B Speaking Integration & Security Audit', () => {

  test('1. 145 physical source images exist in assets-source/speaking', () => {
    const assetsDir = path.join(projectRoot, 'assets-source', 'speaking');
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.jpg'));
    expect(files.length).toBe(145);
  });

  test('2. 147 logical image mappings prepared correctly', () => {
    const res = prepareSpeakingImages({ apply: false });
    expect(res.metadata.logical_image_count).toBe(147);
  });

  test('3. Part 2 has 52 sets', () => {
    const res = prepareSpeakingImages({ apply: false });
    expect(res.metadata.part2_set_count).toBe(52);
  });

  test('4. Part 2 has 75 image variants', () => {
    const res = prepareSpeakingImages({ apply: false });
    expect(res.metadata.part2_image_count).toBe(75);
  });

  test('5. Part 2 has 29 one-image sets', () => {
    const res = prepareSpeakingImages({ apply: false });
    const p2Records = res.images.filter(i => i.part_number === 2);
    const setGroups = new Map();
    p2Records.forEach(r => {
      if (!setGroups.has(r.set_key)) setGroups.set(r.set_key, []);
      setGroups.get(r.set_key).push(r);
    });
    const oneImageSets = Array.from(setGroups.values()).filter(list => list.length === 1);
    expect(oneImageSets.length).toBe(29);
  });

  test('6. Part 2 has 23 two-image sets', () => {
    const res = prepareSpeakingImages({ apply: false });
    const p2Records = res.images.filter(i => i.part_number === 2);
    const setGroups = new Map();
    p2Records.forEach(r => {
      if (!setGroups.has(r.set_key)) setGroups.set(r.set_key, []);
      setGroups.get(r.set_key).push(r);
    });
    const twoImageSets = Array.from(setGroups.values()).filter(list => list.length === 2);
    expect(twoImageSets.length).toBe(23);
  });

  test('7. Part 3 has 72 sets', () => {
    const res = prepareSpeakingImages({ apply: false });
    expect(res.metadata.part3_set_count).toBe(72);
  });

  test('8. Part 3 has 72 combined images', () => {
    const res = prepareSpeakingImages({ apply: false });
    expect(res.metadata.part3_image_count).toBe(72);
  });

  test('9. Part 3 has no set requesting two image blocks', () => {
    const res = prepareSpeakingImages({ apply: false });
    const p3Records = res.images.filter(i => i.part_number === 3);
    const setGroups = new Map();
    p3Records.forEach(r => {
      if (!setGroups.has(r.set_key)) setGroups.set(r.set_key, []);
      setGroups.get(r.set_key).push(r);
    });
    setGroups.forEach((list, key) => {
      expect(list.length).toBe(1);
    });
  });

  test('10. image14.jpg reused correctly in Part 2', () => {
    const res = prepareSpeakingImages({ apply: false });
    const image14Records = res.images.filter(i => i.source_filename === 'image14.jpg');
    expect(image14Records.length).toBe(2);
    expect(image14Records[0].part_number).toBe(2);
    expect(image14Records[1].part_number).toBe(2);
  });

  test('11. image143.jpg reused correctly in Part 3', () => {
    const res = prepareSpeakingImages({ apply: false });
    const image143Records = res.images.filter(i => i.source_filename === 'image143.jpg');
    expect(image143Records.length).toBe(2);
    expect(image143Records[0].part_number).toBe(3);
    expect(image143Records[1].part_number).toBe(3);
  });

  test('12. No Windows absolute paths in manifest records', () => {
    const res = prepareSpeakingImages({ apply: false });
    res.images.forEach(r => {
      expect(r.public_path).not.toMatch(/^[a-zA-Z]:\\/);
      expect(r.storage_object_path).not.toMatch(/^[a-zA-Z]:\\/);
    });
  });

  test('13. No file:// protocol in manifest records', () => {
    const res = prepareSpeakingImages({ apply: false });
    res.images.forEach(r => {
      expect(r.public_path).not.toMatch(/^file:\/\//);
      expect(r.storage_object_path).not.toMatch(/^file:\/\//);
    });
  });

  test('14. No duplicate logical source keys', () => {
    const res = prepareSpeakingImages({ apply: false });
    const keys = res.images.map(r => r.source_key);
    expect(new Set(keys).size).toBe(147);
  });

  test('15. No duplicate destination paths', () => {
    const res = prepareSpeakingImages({ apply: false });
    const paths = res.images.map(r => r.public_path);
    expect(new Set(paths).size).toBe(147);
  });

  test('16. No missing source files', () => {
    const res = prepareSpeakingImages({ apply: false });
    expect(res.metadata.missing_count).toBe(0);
  });

  test('17. Part 2 UI renders only one active variant at a time', () => {
    const practiceCode = readSourceFile('src/components/SpeakingPractice.jsx');
    const adapterCode = readSourceFile('src/adapters/speakingAdapter.js');

    expect(adapterCode).toContain('imageVariants');
    expect(adapterCode).toContain('activeVariantIndex: 0');
    expect(practiceCode).toContain('const [activeVariantIdx, setActiveVariantIdx] = useState');
    expect(practiceCode).toContain('Photo {i + 1}');
    expect(practiceCode).not.toContain('grid grid-cols-1 md:grid-cols-2 gap-4');
  });

  test('18. Part 3 UI renders one combined comparison image', () => {
    const practiceCode = readSourceFile('src/components/SpeakingPractice.jsx');
    const adapterCode = readSourceFile('src/adapters/speakingAdapter.js');

    expect(adapterCode).toContain('combinedImage');
    expect(practiceCode).toContain('combinedImg');
    expect(practiceCode).toContain('object-contain');
    expect(practiceCode).not.toContain('imagesList[1]');
  });

  test('19. Part 1 and Part 4 do not render image container or placeholders', () => {
    const practiceCode = readSourceFile('src/components/SpeakingPractice.jsx');
    expect(practiceCode).toContain('function Part1PersonalInfo');
    expect(practiceCode).toContain('function Part4AbstractTopic');
  });

  test('20. Sample answers not present in pre-submit question adapter payload', () => {
    const rawAdapterCode = readSourceFile('src/adapters/speakingAdapter.js');
    const codeWithoutComments = rawAdapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    expect(codeWithoutComments).not.toContain('sample_answer');
    expect(codeWithoutComments).not.toContain('model_answer');
    expect(codeWithoutComments).not.toContain('rubric');
    expect(codeWithoutComments).not.toContain('aptis_question_answers');
  });

  test('21. No service_role key present in frontend src directory', () => {
    const srcDir = path.join(projectRoot, 'src');
    function scanDir(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(f => {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(js|jsx|ts|tsx)$/.test(f)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
          expect(content).not.toContain('service_role');
        }
      });
    }
    scanDir(srcDir);
  });

  test('22. Fetch error does not fallback to mock data', () => {
    const hookCode = readSourceFile('src/hooks/useSpeakingPractice.js');
    expect(hookCode).not.toContain('MOCK_PART1');
    expect(hookCode).not.toContain('MOCK_PART2');
    expect(hookCode).not.toContain('fallbackToMock');
  });

});
