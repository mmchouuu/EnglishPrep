/**
 * Aptis Listening Audio & TTS Provider Service (Phase 6B2)
 *
 * Core Capabilities:
 * 1. Baseline 4 Voice Profiles: 'en-GB-male', 'en-GB-female', 'en-US-male', 'en-US-female'
 * 2. 100% Deterministic Voice Assignment (string hash based, 0% randomness)
 * 3. Safe Web Speech API Fallback Chain with English-only enforcement
 * 4. Global Single Audio Controller (prevents multiple audio streams playing simultaneously)
 * 5. Multi-Speaker Dialogue Parser & Expressive Utterance Chaining per Part rules:
 *    - Part 1: Strip speaker labels ('Man:', 'Friend:', etc.) from spoken text. Insert newlines between speakers. Switch voices per turn.
 *    - Part 2: Speak 'Person A:', 'Person B:', 'Person C:', 'Person D:' using 4 distinct speaker voices.
 *    - Part 3: Strip 'W:' and 'M:' labels from spoken text. Alternate Female and Male voices line by line.
 *    - Part 4: Expressive monologue reading with tuned pitch and pace.
 */

export const VOICE_PROFILES = {
  EN_GB_MALE: 'en-GB-male',
  EN_GB_FEMALE: 'en-GB-female',
  EN_US_MALE: 'en-US-male',
  EN_US_FEMALE: 'en-US-female'
};

export const PROFILE_LIST = [
  VOICE_PROFILES.EN_GB_FEMALE,
  VOICE_PROFILES.EN_GB_MALE,
  VOICE_PROFILES.EN_US_FEMALE,
  VOICE_PROFILES.EN_US_MALE
];

/**
 * Pure DJB2 String Hash for 100% Deterministic Voice Mapping
 */
export function hashString(str = '') {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Deterministically assigns a requested voice profile based on source_key / audio_key
 */
export function assignVoiceProfile(sourceKey = '', context = {}) {
  const key = String(sourceKey || 'default-audio');

  if (context.speaker) {
    const spk = String(context.speaker).toLowerCase();
    if (spk.includes('man') || spk === 'speaker a' || spk === 'a' || spk === 'm') {
      const isGb = hashString(key) % 2 === 0;
      return isGb ? VOICE_PROFILES.EN_GB_MALE : VOICE_PROFILES.EN_US_MALE;
    }
    if (spk.includes('woman') || spk === 'speaker b' || spk === 'b' || spk === 'w') {
      const isGb = hashString(key) % 2 === 0;
      return isGb ? VOICE_PROFILES.EN_GB_FEMALE : VOICE_PROFILES.EN_US_FEMALE;
    }
  }

  const hashVal = hashString(key);
  const profileIdx = hashVal % PROFILE_LIST.length;
  return PROFILE_LIST[profileIdx];
}

/**
 * Detect female voice keywords in voice name
 */
function isFemaleVoiceName(name = '') {
  const n = name.toLowerCase();
  return (
    n.includes('female') ||
    n.includes('woman') ||
    n.includes('zira') ||
    n.includes('hazel') ||
    n.includes('samantha') ||
    n.includes('victoria') ||
    n.includes('karen') ||
    n.includes('fiona') ||
    n.includes('sora') ||
    n.includes('catherine') ||
    n.includes('susan') ||
    n.includes('moira') ||
    n.includes('serena') ||
    n.includes('stephanie') ||
    n.includes('jenny') ||
    n.includes('aria') ||
    n.includes('eva') ||
    n.includes('libby') ||
    n.includes('sonia')
  );
}

/**
 * Detect male voice keywords in voice name
 */
function isMaleVoiceName(name = '') {
  const n = name.toLowerCase();
  return (
    n.includes('male') ||
    n.includes('man') ||
    n.includes('david') ||
    n.includes('george') ||
    n.includes('james') ||
    n.includes('richard') ||
    n.includes('alex') ||
    n.includes('daniel') ||
    n.includes('oliver') ||
    n.includes('mark') ||
    n.includes('rishi') ||
    n.includes('guy') ||
    n.includes('stefan') ||
    n.includes('christopher') ||
    n.includes('eric') ||
    n.includes('ryan') ||
    n.includes('brian')
  );
}

/**
 * Web Speech API Voice Selection with Automatic Best-Voice Ranking
 */
export function resolveWebSpeechVoice(requestedProfile, availableVoices = []) {
  if (!Array.isArray(availableVoices) || availableVoices.length === 0) {
    return { voice: null, actualVoiceUsed: 'Unavailable', isFallback: false };
  }

  const englishVoices = availableVoices.filter(
    v => v && v.lang && (v.lang.toLowerCase().startsWith('en') || v.lang.toLowerCase().startsWith('en-'))
  );

  if (englishVoices.length === 0) {
    return { voice: null, actualVoiceUsed: 'No English voice installed', isFallback: true };
  }

  const targetLang = requestedProfile.includes('en-GB') ? 'en-gb' : 'en-us';
  const wantFemale = requestedProfile.includes('female');

  // Automatic Quality Voice Rankings
  const preferredFemaleKeywords = [
    'google uk english female',
    'google us english',
    'microsoft zira',
    'microsoft eva',
    'samantha',
    'hazel',
    'female',
    'woman'
  ];

  const preferredMaleKeywords = [
    'google uk english male',
    'google us english male',
    'microsoft mark',
    'microsoft david',
    'male',
    'man',
    'george',
    'james'
  ];

  const keywords = wantFemale ? preferredFemaleKeywords : preferredMaleKeywords;

  // 1. Try finding voice by quality ranking list first
  for (const kw of keywords) {
    const candidate = englishVoices.find(v => {
      const n = v.name.toLowerCase();
      const l = v.lang.toLowerCase();
      return n.includes(kw) && (l.includes('en') || l.includes('en-'));
    });

    if (candidate) {
      return { voice: candidate, actualVoiceUsed: candidate.name, isFallback: false };
    }
  }

  // 2. Fallback to any gender match
  let match = englishVoices.find(v => (wantFemale ? isFemaleVoiceName(v.name) : isMaleVoiceName(v.name)));
  if (match) {
    return { voice: match, actualVoiceUsed: match.name, isFallback: true };
  }

  // 3. Fallback to accent match
  match = englishVoices.find(v => v.lang.toLowerCase().includes(targetLang));
  if (match) {
    return { voice: match, actualVoiceUsed: match.name, isFallback: true };
  }

  // 4. First available English voice
  match = englishVoices[0];
  return { voice: match, actualVoiceUsed: match.name, isFallback: true };
}

/**
 * Parses raw transcript text into expressive multi-speaker dialogue turns for Web Speech TTS.
 * Automatically inserts newlines before inline speaker labels (e.g. Man:, Friend:)
 * and STRIPS speaker labels from spoken audio for Part 1 & Part 3.
 */
export function parseDialogueTurns(transcriptText = '', requestedProfile = 'en-GB-female', partNumber = 1) {
  if (!transcriptText || typeof transcriptText !== 'string') return [];

  let cleanText = transcriptText
    .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
    .replace(/<details[^>]*>/gi, '')
    .replace(/<\/details>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^Question:\s*/gi, '')
    .replace(/\bTranscript:\s*/gi, '\n')
    .trim();

  if (!cleanText) return [];

  // Automatically insert newlines before inline speaker labels
  cleanText = cleanText.replace(/(?<=\S)\s+(?=\b(?:Man|Woman|Friend|Sister|Brother|Mother|Father|Customer|Clerk|Receptionist|Assistant|Officer|Doctor|Patient|Teacher|Student|Speaker\s*\d*|Person\s*[A-D]|[A-D]|W|M|[A-Z][a-zA-Z0-9_]{1,20}):\s*)/g, '\n');

  const lines = cleanText.split(/\r?\n/).map(l => l.replace(/^>\s*/, '').trim()).filter(Boolean);
  const turns = [];

  const isGb = requestedProfile.includes('en-GB');
  
  const femaleProfiles = isGb 
    ? [VOICE_PROFILES.EN_GB_FEMALE, VOICE_PROFILES.EN_US_FEMALE] 
    : [VOICE_PROFILES.EN_US_FEMALE, VOICE_PROFILES.EN_GB_FEMALE];

  const maleProfiles = isGb 
    ? [VOICE_PROFILES.EN_GB_MALE, VOICE_PROFILES.EN_US_MALE] 
    : [VOICE_PROFILES.EN_US_MALE, VOICE_PROFILES.EN_GB_MALE];

  const getGenderFromLabel = (label = '') => {
    const l = label.toLowerCase().trim();
    if (l === 'm' || l === 'man' || l.includes('man') || l.includes('boy') || l.includes('father') || l.includes('son') || l.includes('ahmed') || l.includes('carl') || l.includes('harry') || l.includes('matthew') || l.includes('brother') || l.includes('husband')) {
      return 'male';
    }
    if (l === 'w' || l === 'woman' || l.includes('woman') || l.includes('girl') || l.includes('mother') || l.includes('daughter') || l.includes('rose') || l.includes('sister') || l.includes('lisa') || l.includes('anna') || l.includes('friend') || l.includes('assistant') || l.includes('receptionist')) {
      return 'female';
    }
    return null;
  };

  // -------------------------------------------------------------------------
  // PART 2: Person A, Person B, Person C, Person D
  // -------------------------------------------------------------------------
  if (partNumber === 2 || /Person [A-D]:/i.test(cleanText) || /^Segment \d+/i.test(cleanText)) {
    let currentPerson = null;
    let currentContent = [];

    const flushPart2Turn = () => {
      if (currentPerson && currentContent.length > 0) {
        const pLetter = currentPerson.toUpperCase();
        let voiceProfile = femaleProfiles[0];
        let pitch = 1.05;

        if (pLetter === 'A') {
          voiceProfile = femaleProfiles[0];
          pitch = 1.06;
        } else if (pLetter === 'B') {
          voiceProfile = maleProfiles[0];
          pitch = 0.94;
        } else if (pLetter === 'C') {
          voiceProfile = femaleProfiles[1] || femaleProfiles[0];
          pitch = 1.12;
        } else if (pLetter === 'D') {
          voiceProfile = maleProfiles[1] || maleProfiles[0];
          pitch = 0.90;
        }

        const bodyText = currentContent.join(' ').replace(/^Segment \d+ — .*?:?\s*/i, '').trim();
        const spokenText = `Person ${pLetter}: ${bodyText}`;

        turns.push({
          speaker: `Person ${pLetter}`,
          gender: pLetter === 'A' || pLetter === 'C' ? 'female' : 'male',
          voiceProfile,
          pitch,
          rate: 0.97,
          textToSpeak: spokenText
        });
      }
      currentContent = [];
    };

    for (const line of lines) {
      if (/^Segment \d+/i.test(line)) continue;

      const m = line.match(/^(Person [A-D]|[A-D]):\s*(.*)$/i);
      if (m) {
        flushPart2Turn();
        const rawLabel = m[1].replace(/Person\s*/i, '').trim().toUpperCase();
        currentPerson = rawLabel;
        currentContent.push(m[2].trim());
      } else if (currentPerson) {
        currentContent.push(line);
      }
    }
    flushPart2Turn();

    if (turns.length > 0) return turns;
  }

  // -------------------------------------------------------------------------
  // PART 1 & PART 3: Dialogue with Speaker Labels (Man:, Friend:, W:, M:, etc.)
  // -------------------------------------------------------------------------
  let lastGender = 'male';
  const speakerMap = new Map();
  let speakerCount = 0;

  for (const line of lines) {
    if (/^Segment \d+/i.test(line)) continue;

    const m = line.match(/^([A-Za-z0-9\s_]{1,25}):\s*(.*)$/);
    if (m) {
      const rawLabel = m[1].trim();
      let textAfterColon = m[2].trim();

      if (/^Question$/i.test(rawLabel)) {
        if (textAfterColon) {
          turns.push({
            speaker: 'Question',
            gender: 'female',
            voiceProfile: femaleProfiles[0],
            pitch: 1.0,
            rate: 0.98,
            textToSpeak: textAfterColon
          });
        }
        continue;
      }

      if (!textAfterColon) continue;

      let gender = getGenderFromLabel(rawLabel);
      if (!gender) {
        gender = lastGender === 'female' ? 'male' : 'female';
      }
      lastGender = gender;

      const normLabel = rawLabel.toLowerCase();
      if (!speakerMap.has(normLabel)) {
        speakerCount++;
        const voiceProfile = gender === 'female' 
          ? (femaleProfiles[(speakerCount - 1) % femaleProfiles.length] || femaleProfiles[0])
          : (maleProfiles[(speakerCount - 1) % maleProfiles.length] || maleProfiles[0]);
        const pitch = gender === 'female' 
          ? (1.08 + (speakerCount % 2) * 0.04) 
          : (0.96 - (speakerCount % 2) * 0.04);
        speakerMap.set(normLabel, { gender, voiceProfile, pitch });
      }

      const spkConfig = speakerMap.get(normLabel);

      // STRIP speaker label ("Man:", "W:", "Friend:", "Sister:", etc.) from spoken text!
      turns.push({
        speaker: rawLabel,
        gender: spkConfig.gender,
        voiceProfile: spkConfig.voiceProfile,
        pitch: spkConfig.pitch,
        rate: 0.98,
        textToSpeak: textAfterColon
      });
    } else {
      turns.push({
        speaker: 'Speaker',
        gender: lastGender,
        voiceProfile: lastGender === 'female' ? femaleProfiles[0] : maleProfiles[0],
        pitch: lastGender === 'female' ? 1.08 : 0.94,
        rate: 0.98,
        textToSpeak: line
      });
    }
  }

  if (turns.length === 0) {
    turns.push({
      speaker: 'Speaker',
      gender: requestedProfile.includes('female') ? 'female' : 'male',
      voiceProfile: requestedProfile,
      pitch: 1.0,
      rate: 0.98,
      textToSpeak: cleanText
    });
  }

  return turns;
}

/**
 * Global Single Active Audio State Controller
 */
let activeAudioInstance = null;
let activeSpeechUtterance = null;

export function stopGlobalAudio() {
  if (activeAudioInstance) {
    try {
      activeAudioInstance.pause();
      activeAudioInstance.currentTime = 0;
    } catch {}
    activeAudioInstance = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    activeSpeechUtterance = null;
  }
}

export function registerActiveAudio(audioEl) {
  stopGlobalAudio();
  activeAudioInstance = audioEl;
}

export function registerActiveSpeech(utterance) {
  if (activeAudioInstance) {
    try {
      activeAudioInstance.pause();
      activeAudioInstance.currentTime = 0;
    } catch {}
    activeAudioInstance = null;
  }
  activeSpeechUtterance = utterance;
}
