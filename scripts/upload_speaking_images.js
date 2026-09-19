import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const MANIFEST_FILE = path.join(projectRoot, 'docs', 'aptis', 'manifests', 'speaking-images.json');
const PUBLIC_ASSETS_DIR = path.join(projectRoot, 'public', 'assets', 'speaking');

function loadEnvFiles() {
  const envPaths = [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (key && (!process.env[key] || process.env[key].includes('placeholder'))) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

function isNotFoundError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const status = error.statusCode || error.status || '';
  return msg.includes('not found') || msg.includes('does not exist') || String(status) === '404' || String(error.error || '').toLowerCase().includes('not_found');
}

export async function uploadSpeakingImages({
  apply = false,
  supabaseClient = null,
  manifestFilePath = MANIFEST_FILE,
  assetsDir = PUBLIC_ASSETS_DIR
} = {}) {
  console.log('====================================================');
  console.log(`[Phase Speaking] Storage Uploader (${apply ? 'APPLY' : 'DRY-RUN'})`);
  console.log('====================================================');

  if (!fs.existsSync(manifestFilePath)) {
    throw new Error(`Manifest file not found: ${manifestFilePath}`);
  }

  const manifestData = JSON.parse(fs.readFileSync(manifestFilePath, 'utf8'));
  const records = manifestData.images || [];

  if (records.length !== 147) {
    throw new Error(`Manifest record count mismatch: found ${records.length}, expected 147`);
  }

  let supabase = supabaseClient;

  if (!supabase) {
    loadEnvFiles();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    const validServiceKey = (rawServiceKey && !rawServiceKey.includes('placeholder')) ? rawServiceKey : null;
    const validAnonKey = (rawAnonKey && !rawAnonKey.includes('placeholder')) ? rawAnonKey : null;

    const keyToUse = validServiceKey || validAnonKey;

    if (!supabaseUrl || !keyToUse) {
      throw new Error(`Supabase configuration (SUPABASE_URL / VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY) is required.`);
    }

    supabase = createClient(supabaseUrl, keyToUse);
  }

  const stats = {
    processed: 0,
    proposed_changes: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    missing: 0,
    errors: 0
  };

  console.log(`Inspecting and processing ${records.length} logical images in remote Supabase Storage...`);

  for (const record of records) {
    const localFileAbs = path.join(assetsDir, ...record.storage_object_path.split('/'));

    // Check 1: Missing local file
    if (!fs.existsSync(localFileAbs)) {
      console.error(`[Missing Local File] ${record.storage_object_path} at ${localFileAbs}`);
      stats.missing++;
      continue;
    }

    const fileBuffer = fs.readFileSync(localFileAbs);
    const localHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let state = null; // Exactly one of: 'inserted', 'updated', 'unchanged', 'errors'

    try {
      // Download remote object to compare hash with remote Storage state
      const { data: existingData, error: downloadErr } = await supabase.storage
        .from(record.storage_bucket)
        .download(record.storage_object_path);

      if (downloadErr) {
        if (isNotFoundError(downloadErr)) {
          state = 'inserted';
        } else {
          console.error(`[Storage Download Error] ${record.storage_object_path}:`, downloadErr.message || downloadErr);
          state = 'errors';
        }
      } else if (existingData) {
        let remoteBuffer;
        if (typeof existingData.arrayBuffer === 'function') {
          const ab = await existingData.arrayBuffer();
          remoteBuffer = Buffer.from(ab);
        } else if (Buffer.isBuffer(existingData)) {
          remoteBuffer = existingData;
        } else {
          remoteBuffer = Buffer.from(existingData);
        }

        const remoteHash = crypto.createHash('sha256').update(remoteBuffer).digest('hex');

        if (remoteHash === localHash) {
          state = 'unchanged';
        } else {
          state = 'updated';
        }
      } else {
        state = 'inserted';
      }
    } catch (err) {
      if (isNotFoundError(err)) {
        state = 'inserted';
      } else {
        console.error(`[Storage Exception Error] ${record.storage_object_path}:`, err.message || err);
        state = 'errors';
      }
    }

    // Apply actual upload ONLY if apply === true and state is 'inserted' or 'updated'
    if (apply && (state === 'inserted' || state === 'updated')) {
      try {
        const { error: uploadErr } = await supabase.storage
          .from(record.storage_bucket)
          .upload(record.storage_object_path, fileBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadErr) {
          console.error(`[Upload Error] ${record.storage_object_path}:`, uploadErr.message || uploadErr);
          state = 'errors';
        }
      } catch (uploadExc) {
        console.error(`[Upload Exception] ${record.storage_object_path}:`, uploadExc.message || uploadExc);
        state = 'errors';
      }
    }

    // Increment exactly one bucket counter
    if (state === 'inserted') stats.inserted++;
    else if (state === 'updated') stats.updated++;
    else if (state === 'unchanged') stats.unchanged++;
    else stats.errors++;
  }

  stats.processed = stats.inserted + stats.updated + stats.unchanged + stats.missing + stats.errors;
  stats.proposed_changes = stats.inserted + stats.updated;

  console.log('\n====================================================');
  console.log('[Storage Upload Summary]');
  console.log(`  Processed:        ${stats.processed}`);
  console.log(`  Proposed changes: ${stats.proposed_changes}`);
  console.log(`  Inserted:         ${stats.inserted}`);
  console.log(`  Updated:          ${stats.updated}`);
  console.log(`  Unchanged:        ${stats.unchanged}`);
  console.log(`  Missing:          ${stats.missing}`);
  console.log(`  Errors:           ${stats.errors}`);
  console.log('====================================================\n');

  if (stats.errors > 0) {
    throw new Error(`Upload completed with ${stats.errors} errors.`);
  }

  return stats;
}

if (process.argv[1] && process.argv[1].endsWith('upload_speaking_images.js')) {
  const isApply = process.argv.includes('--apply');
  uploadSpeakingImages({ apply: isApply });
}
