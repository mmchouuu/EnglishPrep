/**
 * APTIS Reading Mock Data Adapter (Phase 6A.1)
 * Scope: 4 Parts (Part 1, Part 2-3, Part 4, Part 5)
 * Security Rule: Answers are stored separately and revealed ONLY after submission.
 */

export const mockReadingData = {
  part1: {
    title: 'Part 1: Sentence Comprehension',
    subtitle: 'Choose the best option (A–D) to complete each sentence.',
    totalQuestions: 143,
    questions: [
      {
        id: 'r-p1-q001',
        sourceKey: 'reading-p1-set001-q001',
        partNumber: 1,
        content: 'She decided to take a break ________ she had been working for hours.',
        prompt: 'She decided to take a break ________ she had been working for hours.',
        options: [
          { key: 'A', text: 'because', value: 'A' },
          { key: 'B', text: 'although', value: 'B' },
          { key: 'C', text: 'so', value: 'C' },
          { key: 'D', text: 'but', value: 'D' }
        ]
      },
      {
        id: 'r-p1-q002',
        sourceKey: 'reading-p1-set001-q002',
        partNumber: 1,
        content: 'The new library is ________ than the old one.',
        prompt: 'The new library is ________ than the old one.',
        options: [
          { key: 'A', text: 'big', value: 'A' },
          { key: 'B', text: 'bigger', value: 'B' },
          { key: 'C', text: 'biggest', value: 'C' },
          { key: 'D', text: 'more big', value: 'D' }
        ]
      },
      {
        id: 'r-p1-q003',
        sourceKey: 'reading-p1-set001-q003',
        partNumber: 1,
        content: 'If you ________ early tomorrow, we can catch the first train.',
        prompt: 'If you ________ early tomorrow, we can catch the first train.',
        options: [
          { key: 'A', text: 'will leave', value: 'A' },
          { key: 'B', text: 'leave', value: 'B' },
          { key: 'C', text: 'leaves', value: 'C' },
          { key: 'D', text: 'are leaving', value: 'D' }
        ]
      },
      {
        id: 'r-p1-q004',
        sourceKey: 'reading-p1-set001-q004',
        partNumber: 1,
        content: 'Many people prefer online shopping ________ it is more convenient.',
        prompt: 'Many people prefer online shopping ________ it is more convenient.',
        options: [
          { key: 'A', text: 'because', value: 'A' },
          { key: 'B', text: 'although', value: 'B' },
          { key: 'C', text: 'despite', value: 'C' },
          { key: 'D', text: 'however', value: 'D' }
        ]
      }
    ],
    solutions: {
      'r-p1-q001': { correctKey: 'A', explanation: '"because" indicates reason for taking a break.' },
      'r-p1-q002': { correctKey: 'B', explanation: 'Comparative form of "big" is "bigger".' },
      'r-p1-q003': { correctKey: 'B', explanation: 'First conditional uses present simple "leave".' },
      'r-p1-q004': { correctKey: 'A', explanation: '"because" introduces the cause of preference.' }
    }
  },

  part2_3: {
    title: 'Part 2–3: Text Cohesion',
    subtitle: 'Improve your reading skills with authentic-style questions and instant feedback.',
    topics: [
      {
        id: 't-work-study',
        name: 'WORK & STUDY',
        setsCount: 3,
        sets: [
          {
            id: 'p2-set-01',
            title: 'Set 1',
            sentencesCount: 6,
            instructions: 'Read the sentences below. Drag and drop them into the correct order to make a coherent text.',
            sentences: [
              { id: 's3', text: 'The company also offered me the chance to attend training courses.' },
              { id: 's1', text: 'I started my new job last month.' },
              { id: 's5', text: 'As a result, I feel much more confident in my role now.' },
              { id: 's4', text: 'At first, it was challenging because I had to learn new software.' },
              { id: 's2', text: 'My colleagues were very friendly and helped me settle in.' },
              { id: 's6', text: 'Overall, it has been a positive experience.' }
            ],
            correctOrder: ['s1', 's2', 's4', 's3', 's5', 's6']
          },
          {
            id: 'p2-set-02',
            title: 'Exercise Set 2',
            sentencesCount: 5,
            instructions: 'Read the sentences below. Drag and drop them into the correct order to make a coherent text.',
            sentences: [
              { id: 's4', text: 'Since then, I have taken part in several interesting projects.' },
              { id: 's1', text: 'Joining the team was a big career step for me.' },
              { id: 's3', text: 'They explained the main procedures very clearly.' },
              { id: 's2', text: 'On my first day, I was introduced to everyone in the office.' },
              { id: 's5', text: 'I am really looking forward to future achievements.' }
            ],
            correctOrder: ['s1', 's2', 's3', 's4', 's5']
          }
        ]
      },
      {
        id: 't-travel',
        name: 'TRAVEL & TRANSPORT',
        setsCount: 3,
        sets: [
          {
            id: 'p2-set-03',
            title: 'Exercise Set 3',
            sentencesCount: 5,
            instructions: 'Read the sentences below. Drag and drop them into the correct order to make a coherent text.',
            sentences: [
              { id: 's2', text: 'The flight was delayed by two hours due to fog.' },
              { id: 's1', text: 'We arrived at the airport early in the morning.' },
              { id: 's4', text: 'Once on board, the captain apologized for the wait.' },
              { id: 's3', text: 'However, the airport staff provided refreshment vouchers.' },
              { id: 's5', text: 'Despite the delay, we reached our destination safely.' }
            ],
            correctOrder: ['s1', 's2', 's3', 's4', 's5']
          }
        ]
      },
      { id: 't-people', name: 'PEOPLE & SOCIETY', setsCount: 3, sets: [] },
      { id: 't-environment', name: 'ENVIRONMENT', setsCount: 3, sets: [] }
    ]
  },

  part4: {
    title: 'Part 4 – Opinion Matching',
    subtitle: 'Read the opinions (A–D) and choose which person best matches each statement (1–7). Each person can be chosen more than once.',
    topicName: 'TOPIC: HEALTHY LIFESTYLES',
    topics: [
      { id: 'p4-t1', name: '1. Healthy Lifestyles' },
      { id: 'p4-t2', name: '2. Education' },
      { id: 'p4-t3', name: '3. Technology' },
      { id: 'p4-t4', name: '4. The Environment' },
      { id: 'p4-t5', name: '5. Work and Careers' }
    ],
    persons: [
      {
        key: 'A',
        name: 'Person A',
        text: 'I try to keep a balanced lifestyle, but I don\'t believe in strict diets. I enjoy exercising a few times a week, mainly cycling, and I think it\'s important to eat food you like in moderation. For me, being healthy also means having time to relax and spend time with friends.'
      },
      {
        key: 'B',
        name: 'Person B',
        text: 'I used to have very unhealthy habits, especially when I was at university. Now I\'m much more careful. I cook most of my meals at home, don\'t eat much processed food, and make sure I get enough sleep. I feel much more energetic and focused than before.'
      },
      {
        key: 'C',
        name: 'Person C',
        text: 'I think people worry too much about healthy living. Of course, exercise and good food are important, but I don\'t like the idea of giving up things I enjoy. Life is about balance, and I believe that being happy is just as important as being physically fit.'
      },
      {
        key: 'D',
        name: 'Person D',
        text: 'For me, a healthy lifestyle is a long-term commitment. I go to the gym regularly, follow a mostly plant-based diet, and avoid sugary drinks. It takes some effort, but I feel better, have more energy, and I think it helps me stay positive, both mentally and physically.'
      }
    ],
    questions: [
      { id: 'p4-q1', num: 1, text: 'This person thinks it\'s important to enjoy life, not just focus on being healthy.', correctPerson: 'C' },
      { id: 'p4-q2', num: 2, text: 'This person changed their habits and now feels better.', correctPerson: 'B' },
      { id: 'p4-q3', num: 3, text: 'This person prefers not to follow a strict diet.', correctPerson: 'A' },
      { id: 'p4-q4', num: 4, text: 'This person believes that mental well-being is part of a healthy lifestyle.', correctPerson: 'D' },
      { id: 'p4-q5', num: 5, text: 'This person avoids certain types of food and drink.', correctPerson: 'D' },
      { id: 'p4-q6', num: 6, text: 'This person thinks people take healthy living too seriously.', correctPerson: 'C' },
      { id: 'p4-q7', num: 7, text: 'This person exercises regularly.', correctPerson: 'D' }
    ]
  },

  part5: {
    title: 'Part 5 – Long Text Comprehension',
    subtitle: 'Read the text on the right. Choose the most suitable heading (A–G) for each paragraph (1–8). There is one extra heading which you do not need to use.',
    topicName: 'TOPIC: SCIENCE & TECHNOLOGY',
    passageTitle: 'How Technology Changes Learning',
    headingOptions: [
      { key: 'A', text: 'The importance of human interaction' },
      { key: 'B', text: 'A more personalised learning experience' },
      { key: 'C', text: 'Challenges and potential risks' },
      { key: 'D', text: 'Learning beyond the classroom' },
      { key: 'E', text: 'How technology has changed education' },
      { key: 'F', text: 'Preparing for the future' },
      { key: 'G', text: 'Different learning styles' }
    ],
    sections: [
      {
        id: 'p5-sec-1',
        key: 'A',
        label: 'Paragraph A',
        text: 'In recent years, technology has transformed the way people learn. From online courses to educational apps, digital tools are now a common part of education at all levels. This change has opened up new possibilities for students and teachers around the world.',
        correctHeadingKey: 'E'
      },
      {
        id: 'p5-sec-2',
        key: 'B',
        label: 'Paragraph B',
        text: 'One of the biggest advantages of technology is that it allows for more personalised learning. Students can learn at their own pace, choose topics that interest them, and receive instant feedback. Adaptive learning platforms use data to suggest activities that match each learner\'s strengths and weaknesses.',
        correctHeadingKey: 'B'
      },
      {
        id: 'p5-sec-3',
        key: 'C',
        label: 'Paragraph C',
        text: 'Technology also makes learning more flexible. With online resources, students can access materials anytime and anywhere. This is particularly helpful for people who cannot attend traditional classrooms, such as those with jobs or family responsibilities.',
        correctHeadingKey: 'D'
      },
      {
        id: 'p5-sec-4',
        key: 'D',
        label: 'Paragraph D',
        text: 'Another benefit is the variety of learning styles that technology can support. Visual learners can watch videos, while auditory learners can listen to podcasts. Interactive simulations and games can make difficult concepts easier to understand.',
        correctHeadingKey: 'G'
      },
      {
        id: 'p5-sec-5',
        key: 'E',
        label: 'Paragraph E',
        text: 'However, there are also challenges. Not everyone has equal access to technology, and this can increase the gap between richer and poorer communities. There are also concerns about students becoming too dependent on digital tools or spending too much time in front of screens.',
        correctHeadingKey: 'C'
      },
      {
        id: 'p5-sec-6',
        key: 'F',
        label: 'Paragraph F',
        text: 'Despite these risks, most experts agree that technology will continue to play a major role in education. As new tools such as artificial intelligence and virtual reality develop, they could make learning even more interactive and realistic.',
        correctHeadingKey: 'F'
      },
      {
        id: 'p5-sec-7',
        key: 'G',
        label: 'Paragraph G',
        text: 'In the end, technology is not a replacement for good teachers, but a powerful tool that can enhance learning. When used wisely, it can help students build the skills they need for the future and open doors to opportunities that were not possible before.',
        correctHeadingKey: 'A'
      }
    ]
  }
};

// Data getter functions
export function getReadingMockPart1() {
  return mockReadingData.part1;
}

export function getReadingMockPart2() {
  return {
    title: mockReadingData.part2_3.title,
    subtitle: mockReadingData.part2_3.subtitle,
    topics: mockReadingData.part2_3.topics,
    set: mockReadingData.part2_3.topics[0].sets[0]
  };
}

export function getReadingMockPart4() {
  return mockReadingData.part4;
}

export function getReadingMockPart5() {
  return mockReadingData.part5;
}

// Evaluation helper functions
export function evaluateReadingPart1(questions = [], userAnswers = {}) {
  const questionResults = {};
  let correctCount = 0;
  const solutions = mockReadingData.part1.solutions;

  questions.forEach((q) => {
    const userVal = userAnswers[q.id];
    const solution = solutions[q.id];
    const isCorrect = solution && userVal === solution.correctKey;
    questionResults[q.id] = isCorrect;
    if (isCorrect) correctCount++;
  });

  return {
    score: `${correctCount}/${questions.length}`,
    questionResults
  };
}

export function evaluateReadingPart2(set = {}, userAnswers = {}) {
  const questionResults = {};
  const setId = set.id || 'p2-set-01';
  const userOrder = userAnswers[setId] || set.sentences?.map((s) => s.id) || [];
  const correctOrder = set.correctOrder || [];

  let matches = 0;
  userOrder.forEach((sId, idx) => {
    const isCorrectPos = correctOrder[idx] === sId;
    questionResults[sId] = isCorrectPos;
    if (isCorrectPos) matches++;
  });

  return {
    score: `${matches}/${correctOrder.length}`,
    questionResults
  };
}

export function evaluateReadingPart4(questions = [], userAnswers = {}) {
  const questionResults = {};
  let correctCount = 0;

  questions.forEach((q) => {
    const userVal = userAnswers[q.id];
    const isCorrect = userVal === q.correctPerson;
    questionResults[q.id] = isCorrect;
    if (isCorrect) correctCount++;
  });

  return {
    score: `${correctCount}/${questions.length}`,
    questionResults
  };
}

export function evaluateReadingPart5(sections = [], userAnswers = {}) {
  const questionResults = {};
  let correctCount = 0;

  sections.forEach((sec) => {
    const userVal = userAnswers[sec.id];
    const isCorrect = userVal === sec.correctHeadingKey;
    questionResults[sec.id] = isCorrect;
    if (isCorrect) correctCount++;
  });

  return {
    score: `${correctCount}/${sections.length}`,
    questionResults
  };
}
