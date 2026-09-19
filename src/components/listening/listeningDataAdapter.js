// UI Adapter to ensure full dataset & fallback structures for Aptis Listening Parts 1-4

export const DEFAULT_PART1_QUESTIONS = Array.from({ length: 13 }, (_, i) => {
  const qNum = i + 1;
  return {
    id: `lis-p1-${qNum}`,
    part: 1,
    questionNumber: qNum,
    title: `Question ${qNum}`,
    topic: qNum % 2 === 0 ? "Daily Announcement" : "Short Conversation",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    voiceType: qNum % 2 === 0 ? "en-US" : "en-GB",
    question: `Question ${qNum}: What is the main purpose of the conversation / message?`,
    options: [
      "A. To confirm an existing appointment or reservation",
      "B. To reschedule a meeting due to unforeseen delays",
      "C. To ask for directions to the city center venue",
      "D. To request additional information about membership"
    ],
    correctAnswer: 0,
    transcript: `[AUDIO TRANSCRIPT - QUESTION ${qNum}]\nSpeaker A: "Hello, I am calling to confirm our schedule for today's appointment."\nSpeaker B: "Yes, everything is set for 2:00 PM at the main office."`,
    explanation: `Target answer A is confirmed in the conversation where Speaker A states 'calling to confirm our schedule'.`,
    translation: `Người nói A gọi điện để xác nhận lịch hẹn lúc 2:00 chiều tại văn phòng chính.`
  };
});

export const DEFAULT_PART2_SETS = [
  {
    id: "lis-p2-set-1",
    setNumber: 1,
    part: 2,
    eyebrow: "LISTENING – PART 2",
    title: "Set 1: Sports Club & Activity Selection",
    description: "Listen to 4 speakers describing their activity preferences. Match each speaker (1–4) with the most appropriate option (A–H).",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    transcript: `[AUDIO TRANSCRIPT - PART 2 SET 1]\nSpeaker 1: I need an early morning workout with swimming facilities.\nSpeaker 2: I prefer outdoor team sports on real grass at weekends.\nSpeaker 3: Evening yoga and stretching helps me relax after long office hours.\nSpeaker 4: High-intensity cardio and indoor badminton is ideal for me.`,
    options: [
      { key: "A", label: "24/7 Gym with heated swimming pool" },
      { key: "B", label: "Outdoor friendly football club" },
      { key: "C", label: "Evening Yoga & Meditation classes" },
      { key: "D", label: "Indoor Badminton & Cardio fitness" },
      { key: "E", label: "Weekend Tennis tournament league" },
      { key: "F", label: "Crossfit & Heavy weightlifting arena" },
      { key: "G", label: "Personal Pilates 1-on-1 coaching" },
      { key: "H", label: "Water aerobics & Aqua fitness" }
    ],
    items: [
      { id: 1, speaker: "1. Speaker 1 (Early Morning Worker)", prompt: "Match Speaker 1 preference:", correctAnswer: "A" },
      { id: 2, speaker: "2. Speaker 2 (Outdoor Weekend Sports)", prompt: "Match Speaker 2 preference:", correctAnswer: "B" },
      { id: 3, speaker: "3. Speaker 3 (Evening Relaxation)", prompt: "Match Speaker 3 preference:", correctAnswer: "C" },
      { id: 4, speaker: "4. Speaker 4 (Indoor High Intensity)", prompt: "Match Speaker 4 preference:", correctAnswer: "D" }
    ]
  },
  {
    id: "lis-p2-set-2",
    setNumber: 2,
    part: 2,
    eyebrow: "LISTENING – PART 2",
    title: "Set 2: Transport & Travel Options",
    description: "Listen to commuters choosing transport methods. Match each person to the best travel option.",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    transcript: `[AUDIO TRANSCRIPT - PART 2 SET 2]\nSpeaker 1: Rapid train transit gets me to work without traffic.\nSpeaker 2: Cycling on designated bike paths keeps me fit.\nSpeaker 3: Shared carpooling reduces monthly commuting costs.\nSpeaker 4: Electric scooter rental is convenient for short trips.`,
    options: [
      { key: "A", label: "Express Metro & Suburb Train" },
      { key: "B", label: "City Bicycle Lane Commute" },
      { key: "C", label: "Shared Carpooling Network" },
      { key: "D", label: "Electric Scooter Short Rental" },
      { key: "E", label: "Long-distance Express Coach" },
      { key: "F", label: "Electric Taxi Shuttle" },
      { key: "G", label: "Walking pedestrian paths" },
      { key: "H", label: "Ferry river transport" }
    ],
    items: [
      { id: 5, speaker: "5. Speaker 1 (Express Rail Commuter)", prompt: "Match Speaker 1 preference:", correctAnswer: "A" },
      { id: 6, speaker: "6. Speaker 2 (Eco Fitness Commuter)", prompt: "Match Speaker 2 preference:", correctAnswer: "B" },
      { id: 7, speaker: "7. Speaker 3 (Cost Sharing Driver)", prompt: "Match Speaker 3 preference:", correctAnswer: "C" },
      { id: 8, speaker: "8. Speaker 4 (Micro Mobility Rider)", prompt: "Match Speaker 4 preference:", correctAnswer: "D" }
    ]
  }
];

export const DEFAULT_PART3_SETS = [
  {
    id: "lis-p3-set-1",
    setNumber: 1,
    totalSets: 2,
    part: 3,
    eyebrow: "PART 3 – OPINION MATCHING",
    topic: "Work From Home & Flexible Hours Debate",
    description: "Read the statements below. Listen to a conversation between a man and a woman discussing working remotely, then decide who holds each opinion (Man, Woman, or Both).",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    transcript: `[AUDIO TRANSCRIPT - PART 3 SET 1]\nMan: Working from home saves me almost 2 hours of daily commuting time.\nWoman: I completely agree on commuting. However, household chores often distract me during work hours.\nMan: My biggest struggle is missing face-to-face brainstorming sessions with team members.\nWoman: I feel online project management tools actually increase daily accountability.\nMan: Having flexible working hours helps maintain better work-life balance.\nWoman: Yes, flexible schedules are definitely beneficial for both of us.`,
    statements: [
      { id: 1, text: "1. Working remotely saves valuable daily commuting time.", correctAnswer: "Both" },
      { id: 2, text: "2. Lack of direct face-to-face interaction reduces creative collaboration.", correctAnswer: "Man" },
      { id: 3, text: "3. Household duties can easily interrupt focused work tasks.", correctAnswer: "Woman" },
      { id: 4, text: "4. Digital project tools make individual task tracking clearer.", correctAnswer: "Woman" },
      { id: 5, text: "5. Flexible work schedules improve overall work-life harmony.", correctAnswer: "Both" },
      { id: 6, text: "6. Clear boundaries are required to prevent overworking at night.", correctAnswer: "Man" }
    ]
  },
  {
    id: "lis-p3-set-2",
    setNumber: 2,
    totalSets: 2,
    part: 3,
    eyebrow: "PART 3 – OPINION MATCHING",
    topic: "Online Education vs Traditional University",
    description: "Listen to two university lecturers discussing online learning degrees vs campus lectures.",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    transcript: `[AUDIO TRANSCRIPT - PART 3 SET 2]\nWoman: Online courses allow students from remote areas to access high-quality education.\nMan: True, accessibility is great. But campus student clubs build essential social networking skills.\nWoman: Recording lectures allows students to review complex concepts at their own pace.\nMan: I agree that lecture recordings are a great learning resource for everyone.`,
    statements: [
      { id: 7, text: "7. Distance learning expands higher education access worldwide.", correctAnswer: "Woman" },
      { id: 8, text: "8. On-campus student societies foster crucial social connections.", correctAnswer: "Man" },
      { id: 9, text: "9. On-demand recorded lectures help students revise difficult topics.", correctAnswer: "Both" },
      { id: 10, text: "10. In-person laboratory sessions are indispensable for science degrees.", correctAnswer: "Both" },
      { id: 11, text: "11. Self-disciplined learners thrive in self-paced digital environments.", correctAnswer: "Woman" },
      { id: 12, text: "12. Tuition fees should reflect reduced physical campus facility usage.", correctAnswer: "Man" }
    ]
  }
];

export const DEFAULT_PART4_TOPICS = [
  {
    topicId: "education-learning",
    topicName: "EDUCATION & LEARNING",
    iconName: "BookOpen",
    sets: [
      {
        id: "lis-p4-set-1",
        setNumber: 1,
        part: 4,
        type: "Monologue",
        questionRange: "Questions 1–2",
        topicName: "Education & Learning",
        title: "Lecture: Modern Educational Technologies",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        transcript: `[AUDIO TRANSCRIPT - PART 4 SET 1]\nLecturer: Welcome everyone. Today's talk focuses on integrating artificial intelligence into university curricula. While automated grading saves professor time, personalized adaptive learning platforms provide immediate feedback customized to each student's pace. The main challenge remains ensuring equal internet infrastructure access across rural school districts.`,
        questions: [
          {
            id: "p4-q1",
            questionNumber: 1,
            question: "1. According to the speaker, what is the primary advantage of adaptive learning platforms?",
            options: [
              "A. Providing customized immediate feedback based on student pace",
              "B. Completely replacing human professors in classroom settings",
              "C. Lowering overall university tuition fees by half",
              "D. Standardizing nationwide exam testing systems"
            ],
            correctAnswer: 0
          },
          {
            id: "p4-q2",
            questionNumber: 2,
            question: "2. What key obstacle does the speaker highlight regarding ed-tech adoption?",
            options: [
              "A. High cost of printed textbooks",
              "B. Unequal internet infrastructure access in rural areas",
              "C. Lack of interest from undergraduate students",
              "D. Opposition from university administrative boards"
            ],
            correctAnswer: 1
          }
        ]
      }
    ]
  },
  {
    topicId: "environment-science",
    topicName: "ENVIRONMENT & SCIENCE",
    iconName: "Globe",
    sets: [
      {
        id: "lis-p4-set-2",
        setNumber: 2,
        part: 4,
        type: "Monologue",
        questionRange: "Questions 3–4",
        topicName: "Environment & Science",
        title: "Presentation: Renewable Wind Energy Infrastructure",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        transcript: `[AUDIO TRANSCRIPT - PART 4 SET 2]\nSpeaker: Offshore wind farms have seen exponential growth due to consistent oceanic wind currents. Although turbine installation requires significant upfront investment, long-term operational efficiency far exceeds inland wind farms. Environmental impact studies confirm negligible harm to marine ecosystems when placed outside migration corridors.`,
        questions: [
          {
            id: "p4-q3",
            questionNumber: 3,
            question: "3. What factor makes offshore wind power generation superior to inland wind turbines?",
            options: [
              "A. Consistent oceanic wind currents and higher operational efficiency",
              "B. Lower installation costs of ocean floor foundations",
              "C. Simpler maintenance procedures during storm seasons",
              "D. Immediate proximity to urban residential power grids"
            ],
            correctAnswer: 0
          },
          {
            id: "p4-q4",
            questionNumber: 4,
            question: "4. What condition is necessary to minimize offshore wind farm environmental impact?",
            options: [
              "A. Installing soundproof barriers around generator hubs",
              "B. Positioning turbines outside marine animal migration corridors",
              "C. Operating turbines only during nighttime off-peak hours",
              "D. Painting turbine blades in fluorescent neon colors"
            ],
            correctAnswer: 1
          }
        ]
      }
    ]
  }
];

export function adaptListeningData(bankItems, partNumber) {
  const pNum = Number(partNumber);
  const rawItems = (bankItems || []).filter(item => Number(item.part) === pNum);

  if (pNum === 1) {
    if (rawItems.length >= 13) {
      return rawItems.map((item, idx) => ({
        id: item.id || `lis-p1-${idx + 1}`,
        part: 1,
        questionNumber: idx + 1,
        title: item.title || `Question ${idx + 1}`,
        topic: item.topic || "Conversation",
        audioUrl: item.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        voiceType: item.voiceType || "en-GB",
        question: item.question || `Question ${idx + 1}`,
        options: item.options || DEFAULT_PART1_QUESTIONS[0].options,
        correctAnswer: item.correctAnswer ?? 0,
        transcript: item.transcript || "",
        explanation: item.explanation || "",
        translation: item.translation || ""
      }));
    }
    // Mix raw items with default to guarantee 13 questions
    return DEFAULT_PART1_QUESTIONS.map((def, idx) => {
      if (rawItems[idx]) {
        const item = rawItems[idx];
        return {
          ...def,
          id: item.id || def.id,
          question: item.question || def.question,
          options: item.options || def.options,
          correctAnswer: item.correctAnswer ?? def.correctAnswer,
          audioUrl: item.audioUrl || def.audioUrl,
          transcript: item.transcript || def.transcript,
          explanation: item.explanation || def.explanation,
          translation: item.translation || def.translation
        };
      }
      return def;
    });
  }

  if (pNum === 2) {
    if (rawItems.length > 0 && rawItems[0].items && rawItems[0].dropdownOptions) {
      return rawItems.map((item, setIdx) => ({
        id: item.id || `lis-p2-set-${setIdx + 1}`,
        setNumber: setIdx + 1,
        part: 2,
        eyebrow: "LISTENING – PART 2",
        title: item.title || `Set ${setIdx + 1}: Dynamic Information Matching`,
        description: item.question || "Listen to speakers and match their choices.",
        audioUrl: item.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        transcript: item.transcript || "",
        options: (item.dropdownOptions || []).map((opt, i) => ({
          key: String.fromCharCode(65 + i),
          label: opt
        })),
        items: (item.items || []).map((it, idx) => ({
          id: it.id || idx + 1,
          speaker: it.speaker || `Speaker ${idx + 1}`,
          prompt: `Match speaker ${idx + 1} choice:`,
          correctAnswer: it.match
        }))
      }));
    }
    return DEFAULT_PART2_SETS;
  }

  if (pNum === 3) {
    if (rawItems.length > 0 && rawItems[0].statements) {
      return rawItems.map((item, setIdx) => ({
        id: item.id || `lis-p3-set-${setIdx + 1}`,
        setNumber: setIdx + 1,
        totalSets: rawItems.length,
        part: 3,
        eyebrow: "PART 3 – OPINION MATCHING",
        topic: item.topic || `Opinion Matching Set ${setIdx + 1}`,
        description: item.question || "Listen to the discussion between Man and Woman and select their opinions.",
        audioUrl: item.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        transcript: item.transcript || "",
        statements: (item.statements || []).map((st, i) => ({
          id: st.id || i + 1,
          text: st.text || `Statement ${i + 1}`,
          correctAnswer: st.answer || "Both"
        }))
      }));
    }
    return DEFAULT_PART3_SETS;
  }

  if (pNum === 4) {
    if (rawItems.length > 0 && rawItems[0].options) {
      return DEFAULT_PART4_TOPICS;
    }
    return DEFAULT_PART4_TOPICS;
  }

  return [];
}
