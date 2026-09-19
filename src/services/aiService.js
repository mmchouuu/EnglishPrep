// AI Evaluation Service for Aptis Writing & Speaking
// Evaluates submissions using standard Aptis scoring rubrics (Grammar, Vocabulary, Task Fulfillment, Fluency/Coherence)

/**
 * Evaluates Aptis Writing submission
 */
export const evaluateWriting = async ({ prompt, part, userText, minWords, maxWords }) => {
  // Simulate AI Processing delay
  await new Promise(res => setTimeout(res, 1200));

  const text = (userText || '').trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  if (wordCount === 0) {
    return {
      error: "Bài làm đang trống. Vui lòng nhập nội dung trước khi chấm điểm AI!"
    };
  }

  // 1. Task Fulfillment Score (0-10)
  let taskScore = 8;
  if (minWords && wordCount < minWords) {
    taskScore = Math.max(3, Math.round((wordCount / minWords) * 8));
  } else if (maxWords && wordCount > maxWords * 1.5) {
    taskScore = 7; // Slightly penalized for exceeding max words significantly
  } else {
    taskScore = Math.min(10, 8 + Math.min(2, Math.floor(wordCount / 20)));
  }

  // 2. Grammar Score (0-10)
  const commonErrors = [];
  let grammarScore = 8;

  // Heuristic grammar checks
  if (!/^[A-Z]/.test(text)) {
    commonErrors.push({ original: text.slice(0, 15) + "...", fix: text.charAt(0).toUpperCase() + text.slice(1, 15) + "...", reason: "Chưa viết hoa chữ cái đầu câu." });
    grammarScore -= 1;
  }
  if (!/[.!?]$/.test(text)) {
    commonErrors.push({ original: text.slice(-15), fix: text.slice(-15) + ".", reason: "Thiếu dấu chấm kết thúc câu." });
    grammarScore -= 1;
  }
  if (/\bi\b/.test(text)) {
    commonErrors.push({ original: "i", fix: "I", reason: "Đại từ nhân xưng 'I' cần viết hoa." });
    grammarScore -= 1;
  }

  // 3. Vocabulary Score (0-10)
  const advancedVocabKeywords = ['however', 'furthermore', 'therefore', 'moreover', 'especially', 'interested', 'prefer', 'suggest', 'appreciate', 'opportunity', 'regarding', 'sincerely'];
  const matchedVocab = advancedVocabKeywords.filter(k => text.toLowerCase().includes(k));
  let vocabScore = Math.min(10, 6 + matchedVocab.length);

  // 4. Coherence & Cohesion (0-10)
  const connectors = ['because', 'although', 'in addition', 'firstly', 'finally', 'also', 'and', 'but', 'so'];
  const matchedConnectors = connectors.filter(c => text.toLowerCase().includes(c));
  let coherenceScore = Math.min(10, 6 + matchedConnectors.length);

  // Total Score (out of 50)
  const totalScore = Math.min(50, Math.round((taskScore + grammarScore + vocabScore + coherenceScore) * 1.25));

  // Determine Aptis Band
  let band = "B1";
  if (totalScore >= 45) band = "C (C1/C2 - Xuất sắc)";
  else if (totalScore >= 36) band = "B2 (Vận dụng linh hoạt)";
  else if (totalScore >= 25) band = "B1 (Đạt chuẩn trung cấp)";
  else band = "A2 (Cần trau dồi thêm)";

  const feedback = [];
  if (wordCount < (minWords || 10)) {
    feedback.push(`• Độ dài bài viết (${wordCount} từ) chưa đạt yêu cầu tối thiểu (${minWords || 10} từ).`);
  } else {
    feedback.push(`• Độ dài bài viết tốt (${wordCount} từ), đáp ứng quy định của Part ${part}.`);
  }

  if (matchedVocab.length > 0) {
    feedback.push(`• Bạn đã sử dụng tốt các từ nối / từ vựng nâng cao: ${matchedVocab.join(', ')}.`);
  } else {
    feedback.push(`• Gợi ý: Hãy bổ sung thêm các từ liên kết như 'Furthermore', 'However', 'Therefore' để tăng điểm Coherence.`);
  }

  return {
    totalScore,
    band,
    scores: {
      taskFulfillment: taskScore,
      grammar: grammarScore,
      vocabulary: vocabScore,
      coherence: coherenceScore
    },
    wordCount,
    matchedVocab,
    commonErrors,
    feedback,
    improvedVersion: generateImprovedWriting(text, part)
  };
};

/**
 * Evaluates Aptis Speaking submission
 */
export const evaluateSpeaking = async ({ prompt, part, transcript }) => {
  await new Promise(res => setTimeout(res, 1200));

  const text = (transcript || '').trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  if (wordCount === 0) {
    return {
      error: "Chưa ghi nhận được bài nói hoặc bản dịch giọng nói (Transcript). Vui lòng phát biểu hoặc nhập lời nói của bạn!"
    };
  }

  // Fluency & Hesitation (0-10)
  let fluencyScore = Math.min(10, 5 + Math.floor(wordCount / 8));

  // Vocabulary & Expression (0-10)
  const goodSpeakingVocab = ['vibrant', 'breathtaking', 'enjoyable', 'personally', 'prefer', 'opinion', 'recharge', 'leisure', 'atmosphere', 'opportunity', 'challenge'];
  const matchedVocab = goodSpeakingVocab.filter(w => text.toLowerCase().includes(w));
  let vocabScore = Math.min(10, 6 + matchedVocab.length);

  // Grammar Range (0-10)
  let grammarScore = Math.min(10, 6 + (text.includes('because') ? 1 : 0) + (text.includes('if') ? 1 : 0) + (text.includes('would') ? 1 : 0));

  // Task Relevance (0-10)
  let taskScore = Math.min(10, 6 + Math.floor(wordCount / 10));

  const totalScore = Math.min(50, Math.round((fluencyScore + vocabScore + grammarScore + taskScore) * 1.25));

  let band = "B1";
  if (totalScore >= 45) band = "C (C1/C2 - Phát âm & Phản xạ xuất sắc)";
  else if (totalScore >= 36) band = "B2 (Trôi chảy & Nhịp điệu tự nhiên)";
  else if (totalScore >= 25) band = "B1 (Đạt phản xạ cơ bản)";
  else band = "A2 (Cần tăng phản xạ & từ vựng)";

  const feedback = [
    `• Tốc độ và phản xạ bài nói: Ghi nhận ~${wordCount} từ nói ra.`,
    matchedVocab.length > 0
      ? `• Bạn đã đưa vào câu nói các từ vựng ăn điểm: ${matchedVocab.join(', ')}.`
      : `• Nên sử dụng các tính từ miêu tả cảm xúc & không gian tốt hơn (như breathtaking, enjoyable, vibrant...).`,
    `• Giữ nhịp điệu phát âm đều đặn, chú ý nhấn trọng âm từ và nối âm tự nhiên.`
  ];

  return {
    totalScore,
    band,
    scores: {
      fluency: fluencyScore,
      vocabulary: vocabScore,
      grammar: grammarScore,
      taskRelevance: taskScore
    },
    wordCount,
    matchedVocab,
    feedback,
    transcript: text
  };
};

function generateImprovedWriting(original, part) {
  if (!original) return '';
  return `[GỢI Ý NÂNG CẤP CÂU VĂN BỞI AI]:\n` +
    original +
    `\n\n✨ [Bản tối ưu Band B2/C]: "` +
    original
      .replace(/i like/gi, 'I am particularly fond of')
      .replace(/good/gi, 'exceptional')
      .replace(/bad/gi, 'unfavorable')
      .replace(/very/gi, 'substantially') +
    `"`;
}
isEstimateBadge: true
  };
};
