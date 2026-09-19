// Seed Question Bank for Aptis 4 Skills & Clubs / Topics
export const initialData = {
  tests: [
    {
      id: "test-aptis-01",
      title: "Aptis Test Master Set 01",
      description: "Bộ đề chuẩn hóa Aptis 4 kỹ năng kèm Lời thoại (Transcript) & Lời giải AI",
      level: "B1 - B2 - C",
      totalQuestions: 60,
      createdAt: new Date().toISOString()
    },
    {
      id: "test-aptis-02",
      title: "Aptis Test Master Set 02",
      description: "Bộ đề ôn tập theo Club & Topic thực tế",
      level: "B1 - B2",
      totalQuestions: 55,
      createdAt: new Date().toISOString()
    }
  ],

  // ================= LISTENING BANK =================
  listening: [
    {
      id: "lis-p1-01",
      testId: "test-aptis-01",
      part: 1,
      topic: "Restaurant Booking",
      title: "Part 1: Message & Short Conversations - Câu 1: Đặt bàn nhà hàng",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      voiceType: "en-GB",
      question: "How many people does the caller want to book a table for, and at what time?",
      options: [
        "A. 4 people at 7:00 PM",
        "B. 2 people at 7:30 PM",
        "C. 6 people at 8:00 PM",
        "D. 4 people at 8:30 PM"
      ],
      correctAnswer: 0,
      transcript: `[AUDIO TRANSCRIPT - LISTENING PART 1 - CÂU 1]
Caller: "Hello, I'd like to book a table for four people for tonight, please. Around 7:00 PM if possible. It's under the name of Sarah."
Receptionist: "Let me check... Yes, we have a table available at 7:00 PM for four in our main dining room. We look forward to seeing you!"`,
      explanation: "Trong đoạn băng, người gọi nêu rõ: 'book a table for four people... Around 7:00 PM' -> Chọn A (4 người lúc 7:00 PM).",
      translation: "Người gọi: Xin chào, tôi muốn đặt bàn cho 4 người vào tối nay lúc 7:00 tối. Tên tôi là Sarah. / Lễ tân: Dạ vâng, chúng tôi còn bàn 4 người lúc 7:00 tối."
    },
    {
      id: "lis-p1-02",
      testId: "test-aptis-01",
      part: 1,
      topic: "Flight Announcement",
      title: "Part 1: Short Messages - Câu 2: Thông báo chuyến bay",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      voiceType: "en-US",
      question: "What is the reason for the flight VN123 delay?",
      options: [
        "A. Mechanical engine failure",
        "B. Heavy fog at destination",
        "C. Shortage of flight crew",
        "D. Security baggage check"
      ],
      correctAnswer: 1,
      transcript: `[AUDIO TRANSCRIPT - LISTENING PART 1 - CÂU 2]
Announcer: "Attention passengers on flight VN123 to London. Due to heavy fog at the destination airport, your flight has been delayed by two hours. We apologize for any inconvenience caused."`,
      explanation: "Thông báo ghi rõ 'Due to heavy fog at the destination airport' (Sương mù dày đặc tại sân bay đến) -> Chọn B.",
      translation: "Xin chú ý các hành khách chuyến bay VN123 đi London. Do sương mù dày đặc tại sân bay đến, chuyến bay bị hoãn 2 tiếng."
    },
    {
      id: "lis-p2-01",
      testId: "test-aptis-01",
      part: 2,
      topic: "Sports Club Selection",
      title: "Part 2: Information Matching - Ghép thông tin câu lạc bộ",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      voiceType: "en-GB",
      question: "Ghép nhu cầu của từng người với câu lạc bộ phù hợp nhất:",
      items: [
        { id: 1, speaker: "Speaker A (Sáng sớm trước khi đi làm)", match: "CLB Gym 24/7 có bể bơi" },
        { id: 2, speaker: "Speaker B (Chơi đồng đội ngoài trời)", match: "CLB Bóng đá giao hữu" },
        { id: 3, speaker: "Speaker C (Lớp học thư giãn buổi tối)", match: "Lớp Yoga & Thiền" }
      ],
      dropdownOptions: ["CLB Gym 24/7 có bể bơi", "CLB Bóng đá giao hữu", "Lớp Yoga & Thiền", "CLB Cầu lông trong nhà"],
      transcript: `[AUDIO TRANSCRIPT - LISTENING PART 2]
Speaker A: "I start work at 8 AM, so I need a gym opening at 5 AM with a pool."
Speaker B: "I love outdoor team sports like weekend football on real grass."
Speaker C: "After long office hours, I need quiet evening stretching to relax."`,
      explanation: "Speaker A -> Gym 24/7 có bể bơi; Speaker B -> Bóng đá ngoài trời; Speaker C -> Yoga & Thiền.",
      translation: "Người A cần gym mở cửa từ 5 sáng có bể bơi; Người B thích đá bóng ngoài trời cuối tuần; Người C cần yoga buổi tối để giãn cơ."
    },
    {
      id: "lis-p3-01",
      testId: "test-aptis-01",
      part: 3,
      topic: "Work From Home Debate",
      title: "Part 3: Opinion Matching - Thảo luận làm việc từ xa",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      voiceType: "en-US",
      question: "Ai là người đưa ra các quan điểm sau (Man, Woman, Both)?",
      statements: [
        { id: 1, text: "Làm việc tại nhà giúp tiết kiệm thời gian di chuyển", answer: "Both" },
        { id: 2, text: "Thiếu tương tác trực tiếp làm giảm sự sáng tạo", answer: "Man" },
        { id: 3, text: "Dễ bị xao nhãng bởi việc nhà trong giờ làm", answer: "Woman" }
      ],
      transcript: `[AUDIO TRANSCRIPT - LISTENING PART 3]
Man: "Working from home saves me 2 hours of commuting daily!"
Woman: "I completely agree about the commute time. But I often get distracted by household chores."
Man: "For me, the main downside is missing face-to-face brainstorming sessions with colleagues."`,
      explanation: "Cả 2 đều đồng ý tiết kiệm thời gian đi lại (Both). Người nam than phiền thiếu tương tác trực tiếp (Man). Người nữ bị xao nhãng việc nhà (Woman).",
      translation: "Nam: Làm ở nhà tiết kiệm 2 tiếng đi lại. / Nữ: Tôi đồng ý về thời gian di chuyển nhưng hay bị phân tâm việc nhà. / Nam: Tôi thấy thiếu thảo luận trực tiếp giảm sáng tạo."
    },
    {
      id: "lis-p4-01",
      testId: "test-aptis-01",
      part: 4,
      topic: "Renewable Energy Lecture",
      title: "Part 4: Extended Monologue - Bài giảng Điện gió",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      voiceType: "en-GB",
      question: "According to the lecturer, what is the most critical factor for a successful wind farm project?",
      options: [
        "A. Geographical location and mean annual wind speed",
        "B. Low manufacturing costs of turbine blades",
        "C. Number of technicians hired",
        "D. Local government subsidies"
      ],
      correctAnswer: 0,
      transcript: `[AUDIO TRANSCRIPT - LISTENING PART 4]
Lecturer: "Welcome back. Today we analyze wind energy investments. Although equipment cost is important, historical data confirms that geographical location and mean annual wind speed are the single most critical factor for long-term power yields."`,
      explanation: "Diễn giả nêu rõ: 'geographical location and mean annual wind speed are the single most critical factor' -> Chọn A.",
      translation: "Vị trí địa lý và tốc độ gió trung bình năm là yếu tố quan trọng hàng đầu quyết định hiệu quả trang trại điện gió."
    }
  ],

  // ================= READING BANK =================
  reading: [
    {
      id: "read-p1-01",
      testId: "test-aptis-01",
      part: 1,
      topic: "Birthday Party Email",
      title: "Part 1: Sentence Completion - Thư mời tiệc sinh nhật",
      textPattern: "Dear Mark,\nI am writing to ___ (1) ___ you to my birthday party next Saturday. The party will ___ (2) ___ at 7 PM at the Blue Restaurant. Please let me know if you can ___ (3) ___ by Wednesday so I can book the table.",
      blanks: [
        { id: 1, options: ["invite", "visit", "tell"], answer: "invite", explanation: "'invite someone to a party' nghĩa là mời ai đến dự tiệc.", translation: "Tôi viết thư này để mời bạn đến dự tiệc sinh nhật." },
        { id: 2, options: ["start", "open", "arrive"], answer: "start", explanation: "Buổi tiệc bắt đầu lúc 7 giờ tối dùng từ 'start'.", translation: "Bữa tiệc sẽ bắt đầu lúc 7 giờ tối." },
        { id: 3, options: ["come", "go", "bring"], answer: "come", explanation: "'come' mang nghĩa đến dự.", translation: "Báo cho tôi biết nếu bạn có thể đến được." }
      ]
    },
    {
      id: "read-p1-02",
      testId: "test-aptis-01",
      part: 1,
      topic: "Shopping & Daily Life",
      title: "Part 1: Sentence Completion - Mua sắm & Đời sống",
      textPattern: "In the morning, I go to the local ___ (1) ___ to buy fresh vegetables. The prices are very ___ (2) ___ and the sellers are friendly. After that, I usually ___ (3) ___ home to cook lunch.",
      blanks: [
        { id: 1, options: ["market", "station", "office"], answer: "market", explanation: "Mua rau củ quả tươi ở 'market' (chợ).", translation: "Vào buổi sáng, tôi đến chợ địa phương để mua rau tươi." },
        { id: 2, options: ["cheap", "expensive", "noisy"], answer: "cheap", explanation: "Giá cả phải chăng / rẻ dùng 'cheap'.", translation: "Giá cả rất rẻ và người bán hàng thân thiện." },
        { id: 3, options: ["return", "leave", "stay"], answer: "return", explanation: "'return home' nghĩa là trở về nhà.", translation: "Sau đó tôi trở về nhà để nấu cơm trưa." }
      ]
    },
    {
      id: "read-p2-01",
      testId: "test-aptis-01",
      part: 2,
      topic: "Job Interview Process",
      title: "Part 2: Text Ordering - Quy trình chuẩn bị phỏng vấn xin việc",
      sentences: [
        { id: "s1", text: "First, research the company thoroughly to understand their products and core values." },
        { id: "s2", text: "Next, prepare concise answers for common interview questions about your experience." },
        { id: "s3", text: "On the day before the interview, choose professional attire and plan your travel route." },
        { id: "s4", text: "Finally, arrive 15 minutes early to stay calm and confident." }
      ],
      correctOrder: ["s1", "s2", "s3", "s4"],
      explanation: "Thứ tự logic: Tìm hiểu công ty -> Chuẩn bị câu trả lời -> Chuẩn bị trang phục hôm trước -> Đến sớm 15 phút.",
      translation: "1. Tìm hiểu kỹ về công ty. 2. Chuẩn bị câu trả lời. 3. Chọn trang phục từ hôm trước. 4. Đến sớm 15 phút."
    },
    {
      id: "read-p3-01",
      testId: "test-aptis-01",
      part: 3,
      topic: "Language Learning Methods",
      title: "Part 3: Opinion Matching - Phương pháp học ngoại ngữ của 4 người",
      persons: [
        { name: "Person A (Alex)", text: "I believe watching movies with English subtitles is the most entertaining way to learn slang and natural intonation." },
        { name: "Person B (Bella)", text: "Grammar rules and daily vocabulary flashcards are essential foundations before attempting complex conversations." },
        { name: "Person C (Charlie)", text: "Joining language exchange clubs to speak with native speakers daily helped me gain confidence quickly." },
        { name: "Person D (Diana)", text: "Reading classic novels and news articles expanded my formal vocabulary for business communication." }
      ],
      questions: [
        { q: "1. Who prefers watching movies to learn slang and natural intonation?", answer: "Person A (Alex)", explanation: "Alex đề cập 'watching movies with English subtitles'." },
        { q: "2. Who emphasizes speaking practice with native speakers in clubs?", answer: "Person C (Charlie)", explanation: "Charlie đề cập 'Joining language exchange clubs to speak with native speakers'." },
        { q: "3. Who focuses on flashcards and grammar fundamentals?", answer: "Person B (Bella)", explanation: "Bella nhấn mạnh 'Grammar rules and daily vocabulary flashcards'." }
      ]
    },
    {
      id: "read-p4-01",
      testId: "test-aptis-01",
      part: 4,
      topic: "History of Artificial Intelligence",
      title: "Part 4: Long Text Comprehension - Lịch sử phát triển Trí tuệ nhân tạo (AI)",
      passage: `Artificial Intelligence (AI) has evolved from a theoretical concept in the 1950s into a foundational technology of modern society. Early pioneers created simple algorithms capable of playing chess, but computing power was severely limited. In recent decades, deep learning algorithms combined with massive data processing have enabled machines to perform complex language translation, medical diagnosis, and autonomous driving.`,
      questions: [
        {
          q: "1. What was the major limitation of AI in the 1950s?",
          options: ["A. Computing power was severely limited", "B. Absence of chess playing algorithms", "C. Lack of interest from scientists"],
          answer: "A. Computing power was severely limited",
          explanation: "Đoạn văn viết: 'computing power was severely limited' (năng lực tính toán bị hạn chế nghiêm trọng).",
          translation: "Hạn chế lớn nhất trong thập niên 1950 là năng lực tính toán của máy tính quá yếu."
        },
        {
          q: "2. What combined with deep learning to create breakthroughs in recent years?",
          options: ["A. Massive data processing", "B. Video game graphics", "C. Ancient dictionary texts"],
          answer: "A. Massive data processing",
          explanation: "Đoạn văn viết: 'deep learning algorithms combined with massive data processing'.",
          translation: "Thuật toán học sâu kết hợp xử lý dữ liệu khối lượng lớn tạo nên đột phá."
        }
      ]
    },
    {
      id: "read-p5-01",
      testId: "test-aptis-01",
      part: 5,
      topic: "Environmental Protection & Recycling",
      title: "Part 5: Paragraph Headings & Dropdown Matching - Bảo vệ môi trường",
      passage: `Paragraph A: Waste reduction begins at home. By minimizing single-use plastics and composting food scraps, households significantly cut down landfill volume.

Paragraph B: Educational campaigns in schools play a crucial role in forming sustainable habits early in life. Children who practice recycling at school often bring these habits home to their families.

Paragraph C: Financial incentives, such as tax rebates for eco-friendly businesses, motivate corporations to adopt green technologies and reduce carbon footprints.`,
      dropdownQuestions: [
        { id: 1, label: "Headline for Paragraph A", options: ["Household Waste Reduction", "School Recycling Programs", "Corporate Eco Taxes"], answer: "Household Waste Reduction" },
        { id: 2, label: "Headline for Paragraph B", options: ["Household Waste Reduction", "School Recycling Programs", "Corporate Eco Taxes"], answer: "School Recycling Programs" },
        { id: 3, label: "Headline for Paragraph C", options: ["Household Waste Reduction", "School Recycling Programs", "Corporate Eco Taxes"], answer: "Corporate Eco Taxes" }
      ],
      explanation: "Đoạn A nói về rác thải gia đình; Đoạn B nói về chương trình tái chế học đường; Đoạn C nói về chính sách ưu đãi thuế sinh thái cho doanh nghiệp."
    }
  ],

  // ================= WRITING BANK (BY CLUB & PARTS) =================
  writing: [
    // CLUB 1: FITNESS & SPORTS CLUB
    {
      id: "writ-club1-p1",
      clubId: "fitness-club",
      clubName: "Fitness & Sports Club",
      part: 1,
      title: "Part 1: Personal Profile Form (5 câu ngắn, 1-5 từ/câu)",
      prompts: [
        "1. What is your favorite sport?",
        "2. How often do you exercise?",
        "3. Where do you usually work out?",
        "4. What time do you prefer to exercise?",
        "5. Who do you exercise with?"
      ],
      minWords: 1,
      maxWords: 5,
      suggestedWords: "Gợi ý: Swimming, Twice a week, Local gym, In the morning, With my friends",
      modelAnswers: `1. Swimming and badminton.
2. Three times a week.
3. At the local gym.
4. Early in the morning.
5. With my best friend.`
    },
    {
      id: "writ-club1-p2",
      clubId: "fitness-club",
      clubName: "Fitness & Sports Club",
      part: 2,
      title: "Part 2: Club Form Filling (20 - 30 từ)",
      prompt: "Please explain why you joined the Fitness & Sports Club and what sports facilities or classes you are most interested in using.",
      minWords: 20,
      maxWords: 30,
      modelAnswers: `I joined the Fitness Club to stay healthy and reduce stress after long working hours. I am particularly interested in the outdoor swimming pool and weekend yoga sessions.`
    },
    {
      id: "writ-club1-p3",
      clubId: "fitness-club",
      clubName: "Fitness & Sports Club",
      part: 3,
      title: "Part 3: Social Club Chat (3 câu hỏi chat trực tuyến, 30-40 từ/câu)",
      questions: [
        "Member Alex: Welcome to our club! How long have you been playing sports and what is your main fitness goal?",
        "Member Sarah: We are introducing new evening Zumba and Boxing classes next week. Which one would you like to join?",
        "Member David: Do you think hiring a personal trainer is necessary for beginners, or can people train effectively on their own?"
      ],
      minWords: 30,
      maxWords: 40,
      modelAnswers: `Q1: I have been playing badminton and running regularly for over three years. My main goal is to improve my cardiovascular endurance and maintain a healthy lifestyle.

Q2: I would definitely love to try the Boxing class! It sounds like a fantastic high-intensity workout to release tension after a long day at the office.

Q3: In my opinion, hiring a personal trainer is very beneficial for beginners to master proper techniques safely. However, dedicated individuals can also learn effectively through online tutorials.`
    },
    {
      id: "writ-club1-p4",
      clubId: "fitness-club",
      clubName: "Fitness & Sports Club",
      part: 4,
      title: "Part 4: Formal & Informal Emails (Thư cho bạn 50 từ & Thư cho Quản lý 120-150 từ)",
      scenario: "You received an email from the Fitness & Sports Club manager announcing that the swimming pool will be closed on weekends for maintenance, while monthly membership fees will increase.",
      taskInformal: "Write an informal email to your friend (about 50 words) sharing your reaction to this notice.",
      taskFormal: "Write a formal email to the Club Manager (120-150 words) expressing disappointment and proposing alternative solutions.",
      minWordsInformal: 40,
      maxWordsInformal: 60,
      minWordsFormal: 120,
      maxWordsFormal: 150,
      modelInformal: `Hi Sarah,
Did you see the latest email from our sports club? They are closing the pool on weekends and raising membership fees! Weekend swimming is the only time I can relax. What are we going to do now?
Best,
Minh`,
      modelFormal: `Dear Club Manager,

I am writing to express my disappointment regarding the recent announcement to close the swimming pool on weekends for maintenance, alongside increasing monthly membership fees. As a loyal member for over two years, I rely heavily on the pool during weekends.

While I understand that facility maintenance is essential for safety, closing the pool on peak weekend days severely inconveniences working members who cannot attend during weekdays. Furthermore, raising fees while reducing service availability feels unreasonable.

Instead of full weekend closures, I would like to suggest scheduling maintenance during weekday morning off-peak hours. Alternatively, the club could offer discounted membership rates during the maintenance period to compensate members.

I hope you will reconsider this decision for the benefit of all club members.

Yours faithfully,
Minh Tran`
    },

    // CLUB 2: BOOK LOVERS CLUB
    {
      id: "writ-club2-p1",
      clubId: "book-club",
      clubName: "Book Lovers Club",
      part: 1,
      title: "Part 1: Personal Profile Form (5 câu ngắn, 1-5 từ/câu)",
      prompts: [
        "1. What type of books do you like?",
        "2. When do you usually read?",
        "3. Where do you buy your books?",
        "4. How many books do you read a month?",
        "5. Who is your favorite author?"
      ],
      minWords: 1,
      maxWords: 5,
      suggestedWords: "Gợi ý: Sci-fi novels, Before sleeping, Online bookstores, Two books, J.K. Rowling",
      modelAnswers: `1. Science fiction and detective novels.
2. Before going to bed.
3. From local bookstores online.
4. About two or three books.
5. J.K. Rowling.`
    },
    {
      id: "writ-club2-p2",
      clubId: "book-club",
      clubName: "Book Lovers Club",
      part: 2,
      title: "Part 2: Club Form Filling (20 - 30 từ)",
      prompt: "Please state why you joined the Book Lovers Club and describe your favorite book that you read recently.",
      minWords: 20,
      maxWords: 30,
      modelAnswers: `I joined this club to share book recommendations with fellow readers. Recently, I read 'Atomic Habits', which taught me practical strategies to build productive daily routines.`
    },
    {
      id: "writ-club2-p3",
      clubId: "book-club",
      clubName: "Book Lovers Club",
      part: 3,
      title: "Part 3: Social Club Chat (3 câu hỏi chat trực tuyến, 30-40 từ/câu)",
      questions: [
        "Member Emma: Welcome! Do you prefer reading traditional paper books or e-books on devices like Kindle?",
        "Member Tom: We are planning a monthly book exchange event. How should we organize it?",
        "Member Grace: Do you think audiobooks are as effective as reading printed text for gaining knowledge?"
      ],
      minWords: 30,
      maxWords: 40,
      modelAnswers: `Q1: I personally prefer reading physical paper books because turning real pages gives a tangible satisfaction, and it reduces screen eye strain after a long workday.

Q2: We can ask each member to bring two gently used books to the monthly meetup, attach short handwritten review notes, and swap them with other readers.

Q3: Yes, I believe audiobooks are equally effective, especially for busy individuals who want to absorb knowledge while commuting or performing household chores.`
    },
    {
      id: "writ-club2-p4",
      clubId: "book-club",
      clubName: "Book Lovers Club",
      part: 4,
      title: "Part 4: Formal & Informal Emails (Thư cho bạn 50 từ & Thư cho Quản lý 120-150 từ)",
      scenario: "The Book Lovers Club management announced that the weekly book discussion venue is moving to a location far from the city center.",
      taskInformal: "Write an informal email to your friend (about 50 words) telling them about the venue change.",
      taskFormal: "Write a formal email to the Club President (120-150 words) expressing concern and suggesting alternative central meeting places.",
      minWordsInformal: 40,
      maxWordsInformal: 60,
      minWordsFormal: 120,
      maxWordsFormal: 150,
      modelInformal: `Hi John,
Have you heard that our book club is relocating meetings to the outskirts of town? It takes over an hour to drive there! I'm really worried I won't be able to attend anymore. What do you think?
Best,
Minh`,
      modelFormal: `Dear Club President,

I am writing to express my concern regarding the recent decision to relocate our weekly book club meetings to the new venue on the northern outskirts of the city. 

While the new venue may offer larger meeting rooms, the long distance presents a major travel obstacle for many long-term members who rely on public transportation. Commuting over an hour each way on weekday evenings will inevitably reduce meeting attendance.

I would like to respectfully suggest considering more centrally located venues, such as reserving quiet room spaces in the central public library or partnering with downtown coffee shops.

Thank you for considering my suggestions, and I hope we can find a location convenient for all members.

Yours sincerely,
Minh Tran`
    }
  ],

  // ================= SPEAKING BANK (BY TOPIC & PARTS) =================
  speaking: [
    // TOPIC 1: HOMETOWN & DAILY HOBBIES
    {
      id: "spk-topic1-p1",
      topicId: "hometown-hobbies",
      topicName: "Hometown & Hobbies",
      part: 1,
      title: "Part 1: Personal Information (3 câu - 30s/câu)",
      prepTime: 0,
      speakTime: 30,
      questions: [
        "1. Please tell me about your hometown.",
        "2. What do you usually do in your free time?",
        "3. What is your favorite season of the year and why?"
      ],
      sampleTranscripts: `Q1 (30s - 46 words): "I was born and raised in Hanoi, the bustling capital city of Vietnam. It is widely renowned for its rich cultural heritage, delicious street food, and historic lakes. What I love most about my hometown is the charming contrast between ancient temples and modern vibrant streets."

Q2 (30s - 48 words): "In my leisure time, I am particularly keen on playing badminton with my close friends at the local sports center, which keeps me physically active. Additionally, I thoroughly enjoy unwinding in the evenings by listening to acoustic music and reading self-help books to broaden my perspective."

Q3 (30s - 47 words): "Without a doubt, my absolute favorite season of the year is autumn. During this period, the weather becomes pleasantly cool and mild, which is ideal for outdoor activities. I love taking evening strolls around the lake when the trees shed their golden leaves, creating a serene atmosphere."`,
      keyVocab: "bustling capital, rich cultural heritage, charming contrast, particularly keen on, unwind, pleasantly cool, serene atmosphere"
    },
    {
      id: "spk-topic1-p2",
      topicId: "hometown-hobbies",
      topicName: "Hometown & Hobbies",
      part: 2,
      title: "Part 2: Describe Picture & Related Questions (Prep 45s, Speak 45s/câu)",
      prepTime: 45,
      speakTime: 45,
      imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80",
      questions: [
        "1. Describe what you see in this picture.",
        "2. Tell me about a time when you worked in a team.",
        "3. Do you think working in a group is better than working individually?"
      ],
      sampleTranscripts: `Q1 (45s - 72 words): "This photo captures a group of university students sitting around a wooden table in a spacious, modern library. In the foreground, two students are actively engaged in discussion while pointing at a laptop screen, whereas others are taking notes. The room is filled with natural sunlight coming through large windows, creating a bright and productive atmosphere. Judging by their focused facial expressions, they seem to be working collaboratively on an important group assignment."

Q2 (45s - 75 words): "I vividly recall a time last semester when my team had to prepare a major marketing presentation for our university course. Initially, we faced difficulty coordinating our schedules, but we resolved it by dividing the workload according to each member's specific strengths. I took responsibility for creating the slides, while my teammates conducted research and rehearsed the speech. Thanks to our seamless cooperation and effective communication, we delivered a convincing presentation and earned the top grade."

Q3 (45s - 76 words): "From my perspective, both working in a group and working individually have their own distinct advantages depending on the context. Group work is incredibly beneficial because it brings together diverse perspectives, fosters brainstorming, and sparks innovative solutions that one person might overlook. On the flip side, working independently allows individuals to make swift decisions without compromise and work at their own pace. Ultimately, I believe a balanced combination of both approaches yields the best results."`,
      keyVocab: "actively engaged, productive atmosphere, work collaboratively, vividly recall, seamless cooperation, diverse perspectives, spark innovative solutions"
    },
    {
      id: "spk-topic1-p3",
      topicId: "hometown-hobbies",
      topicName: "Hometown & Hobbies",
      part: 3,
      title: "Part 3: Compare Two Pictures & Discussion (Prep 45s, Speak 45s/câu)",
      prepTime: 45,
      speakTime: 45,
      image1Url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      image2Url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
      questions: [
        "1. Compare the two different types of holidays shown in the pictures.",
        "2. Which of these two places would you prefer to visit for a vacation?",
        "3. Why do some people prefer adventurous holidays while others prefer relaxing ones?"
      ],
      sampleTranscripts: `Q1 (45s - 74 words): "Comparing the two images, the first picture depicts a tranquil beach holiday with golden sand and crystal-clear water, emphasizing relaxation and leisure. In stark contrast, the second image illustrates an adventurous mountain trek, where hikers are navigating rugged trails surrounded by majestic peaks. While the beach destination offers a calm environment to escape daily routine, the mountain holiday caters to outdoor enthusiasts who crave physical challenge, fresh alpine air, and breathtaking natural scenery."

Q2 (45s - 72 words): "If I had to choose between the two, I would definitely lean towards the beach vacation. Due to my demanding work routine, I often feel overwhelmed by daily stress. Therefore, spending a few days lounging on a quiet shore, listening to the gentle rhythm of ocean waves, and soaking up the warm sunshine sounds like the perfect way to unwind and recharge my batteries completely. It offers the peaceful retreat I truly need."

Q3 (45s - 76 words): "People's vacation choices generally depend on their personality traits and daily lifestyle demands. Thrill-seekers and active individuals often prefer adventurous holidays because conquering challenging mountain trails or trying extreme sports gives them an adrenaline rush and a sense of accomplishment. On the other hand, individuals with hectic desk jobs usually opt for relaxing beach getaways to escape constant noise, slow down their pace of life, and restore their mental and physical well-being in a peaceful setting."`,
      keyVocab: "stark contrast, tranquil beach, majestic peaks, lean towards, recharge batteries, thrill-seekers, adrenaline rush, mental well-being"
    },
    {
      id: "spk-topic1-p4",
      topicId: "hometown-hobbies",
      topicName: "Hometown & Hobbies",
      part: 4,
      title: "Part 4: Personal Experience & Tech Impact (Prep 60s, Speak 120s)",
      prepTime: 60,
      speakTime: 120,
      questions: [
        "1. Describe a memorable event from your childhood.",
        "2. How did you feel during that event?",
        "3. How has modern technology changed children's free time activities compared to the past?"
      ],
      sampleTranscripts: `Q1 & Q2 (Memory & Feelings - 105 words): "One of the most unforgettable experiences from my childhood was learning to ride a bicycle with my father in our neighbourhood park when I was around seven years old. I vividly remember the crisp morning air and how nervous I felt when my father finally let go of the seat. At first, I was utterly terrified of losing balance and crashing onto the pavement. However, as I pedalled faster and realized I was gliding forward entirely on my own, my fear transformed into immense exhilaration, pride, and pure joy. That moment taught me perseverance and built my confidence early on."

Q3 (Tech Impact - 100 words): "Turning to the broader question of how technology has reshaped childhood leisure, I believe modern digital advancements have drastically altered children's recreational habits compared to previous generations. Decades ago, children predominantly spent their free time outdoors playing traditional games like hide-and-seek or football with neighbourhood friends. In contrast, nowadays smartphones, video games, and online video platforms dominate kids' spare time. Although modern gadgets provide interactive educational materials, overreliance on screens significantly reduces physical exercise and hinders the development of real-world social skills."`,
      keyVocab: "unforgettable experience, utterly terrified, immense exhilaration, perseverance, drastically altered, overreliance on screens, hinder social skills"
    },

    // TOPIC 2: TRAVEL & ADVENTURE
    {
      id: "spk-topic2-p1",
      topicId: "travel-adventure",
      topicName: "Travel & Adventure",
      part: 1,
      title: "Part 1: Personal Information (3 câu - 30s/câu)",
      prepTime: 0,
      speakTime: 30,
      questions: [
        "1. Do you like traveling to new places?",
        "2. What is the most beautiful country or city you have ever visited?",
        "3. Do you prefer traveling alone or with friends?"
      ],
      sampleTranscripts: `Q1 (30s - 46 words): "Absolutely! I am genuinely passionate about traveling to new destinations whenever I have the chance. Exploring unfamiliar places allows me to broaden my horizons, immerse myself in diverse cultural traditions, taste authentic local dishes, and create unforgettable memories that enrich my overall outlook on life."

Q2 (30s - 47 words): "Without doubt, the most breathtaking city I have ever had the privilege to visit is Da Nang in central Vietnam. It is renowned for its magnificent Marble Mountains, vibrant Dragon Bridge, and pristine beaches. The harmonious combination of coastal natural beauty and modern infrastructure left a lasting impression on me."

Q3 (30s - 46 words): "Personally, I much prefer traveling alongside close friends rather than embarking on solo journeys. Travelling in a group not only enhances safety when exploring unfamiliar places, but it also allows us to share funny moments, split accommodation expenses, and build lifelong bonds through shared adventures."`,
      keyVocab: "genuinely passionate, broaden horizons, pristine beaches, lasting impression, embarking on journeys, lifelong bonds"
    },
    {
      id: "spk-topic2-p2",
      topicId: "travel-adventure",
      topicName: "Travel & Adventure",
      part: 2,
      title: "Part 2: Describe Picture & Related Questions (Prep 45s, Speak 45s/câu)",
      prepTime: 45,
      speakTime: 45,
      imageUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
      questions: [
        "1. Describe what the person in the picture is doing.",
        "2. Tell me about a trip you took that did not go as planned.",
        "3. What are the benefits of learning about foreign cultures when traveling?"
      ],
      sampleTranscripts: `Q1 (45s - 71 words): "In this photograph, I can see an adventurous hiker standing on a high mountain summit under clear, sunny skies. He is wearing a heavy trekking backpack, durable hiking boots, and holding a paper map to check his route direction. Around him are breathtaking panoramic views of rolling green hills and distant valleys. The serene landscape, combined with his posture, suggests that he has reached a rewarding peak after a long and challenging trek."

Q2 (45s - 76 words): "I remember a mountain trip to Sa Pa last winter that completely deviated from our planned itinerary. Shortly after we arrived, an unexpected torrential rainstorm hit the area, causing minor landslides that blocked our intended hiking trails. Instead of panicking, we decided to stay indoors at a cozy local ethnic homestay. The friendly hosts welcomed us, showed us how to cook delicious traditional dishes, and shared fascinating folklore, turning an unfortunate delay into an unforgettable cultural experience."

Q3 (45s - 74 words): "Immersing oneself in foreign cultures while traveling yields numerous profound benefits. Firstly, it fosters empathy and open-mindedness by allowing travelers to understand different lifestyles, customs, and beliefs from a firsthand perspective. Secondly, engaging with local communities helps break down cultural stereotypes and promotes global tolerance. Ultimately, stepping outside one's comfort zone to experience international traditions enriches personal growth and makes people more adaptable, respectful, and culturally conscious global citizens."`,
      keyVocab: "mountain summit, panoramic views, deviated from itinerary, torrential rainstorm, foster empathy, cultural stereotypes, culturally conscious"
    }
  ]
};
