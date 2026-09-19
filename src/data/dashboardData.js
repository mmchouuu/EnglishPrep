export const heroData = {
  eyebrow: "APTIS TEST PREPARATION",
  heading: "Practice Aptis",
  subtitle: "Choose a skill, part and practice mode."
};

export const initialSkillCards = [
  {
    id: "listening",
    skillKey: "listening",
    title: "Listening Practice",
    description: "Multiple-choice listening with audio and transcripts.",
    icon: "Headphones",
    accent: "blue",
    duration: "20 mins",
    parts: ["Part 1", "Part 2", "Part 3", "Part 4"],
    defaultPart: "Part 1",
    modes: [
      { id: "full", label: "Full Practice", icon: "List" },
      { id: "topic", label: "By Topic", icon: "Tag" }
    ],
    defaultMode: "full",
    route: "listening"
  },
  {
    id: "reading",
    skillKey: "reading",
    title: "Reading Practice",
    description: "Sentence completion, text reordering, and matching passages.",
    icon: "FileText",
    accent: "emerald",
    duration: "35 mins",
    parts: ["Part 1", "Part 2–3", "Part 4", "Part 5"],
    defaultPart: "Part 1",
    modes: [
      { id: "full", label: "Full Practice", icon: "List" },
      { id: "topic", label: "By Topic", icon: "Tag" }
    ],
    defaultMode: "full",
    route: "reading"
  },
  {
    id: "writing",
    skillKey: "writing",
    title: "Writing Practice",
    description: "Word count, timer, and automated essay evaluation.",
    icon: "PenLine",
    accent: "purple",
    duration: "50 mins",
    parts: ["Part 1", "Part 2", "Part 3", "Part 4"],
    defaultPart: "Part 1",
    modes: [
      { id: "full", label: "Full Practice", icon: "List" },
      { id: "club", label: "By Club", icon: "Users" }
    ],
    defaultMode: "full",
    route: "writing"
  },
  {
    id: "speaking",
    skillKey: "speaking",
    title: "Speaking Practice",
    description: "Microphone recorder, timer simulation, and model answers.",
    icon: "Mic",
    accent: "orange",
    duration: "12 mins",
    parts: ["Part 1", "Part 2", "Part 3", "Part 4"],
    defaultPart: "Part 1",
    modes: [
      { id: "full", label: "Full Practice", icon: "List" },
      { id: "topic", label: "By Topic", icon: "Tag" }
    ],
    defaultMode: "full",
    route: "speaking"
  }
];
