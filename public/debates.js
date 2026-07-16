// =====================================================
// CRICKET BUTTERFLY EFFECT — THE GREAT DEBATES
// The arguments cricket fans never stop having.
// momentId links a debate to its butterfly moment (optional).
// =====================================================

const DEBATES = [
  {
    id: "d-goat-sachin-kohli",
    tag: "The GOAT War",
    question: "One innings to save your life. Who bats for you?",
    optionA: { emoji: "🐐", label: "Sachin Tendulkar" },
    optionB: { emoji: "👑", label: "Virat Kohli" }
  },
  {
    id: "d-2019-boundary",
    tag: "The Rule",
    question: "England's 2019 World Cup — won on boundary count. Legitimate?",
    optionA: { emoji: "📜", label: "Rules are rules" },
    optionB: { emoji: "🤝", label: "Should've been shared" },
    momentId: "superover-stokes-deflection"
  },
  {
    id: "d-gibbs-drop",
    tag: "The Drop",
    question: "Did Herschelle Gibbs really drop the 1999 World Cup?",
    optionA: { emoji: "🏆", label: "Yes — SA win it all" },
    optionB: { emoji: "😅", label: "They'd have choked anyway" },
    momentId: "1999-gibbs-drop"
  },
  {
    id: "d-2003-toss",
    tag: "The Toss",
    question: "India bat first in the 2003 final — does the Cup come home?",
    optionA: { emoji: "🏆", label: "Cup comes home" },
    optionB: { emoji: "🦘", label: "That Australia wins anyway" },
    momentId: "2003-ganguly-bats"
  },
  {
    id: "d-dhoni-2011",
    tag: "The Promotion",
    question: "Dhoni promoting himself in the 2011 final — greatest captaincy call ever?",
    optionA: { emoji: "🧠", label: "Greatest call ever" },
    optionB: { emoji: "🦁", label: "Yuvraj finishes it too" },
    momentId: "wc2011-dhoni-promoted"
  },
  {
    id: "d-dhoni-captaincy",
    tag: "Sliding Doors",
    question: "No Tendulkar recommendation in 2007 — does MS Dhoni ever captain India?",
    optionA: { emoji: "✨", label: "Destiny finds a way" },
    optionB: { emoji: "🚪", label: "It never happens" }
  },
  {
    id: "d-bradman-modern",
    tag: "Time Machine",
    question: "Drop Bradman into today's game. Does he still average 99?",
    optionA: { emoji: "🎩", label: "Genius adapts to anything" },
    optionB: { emoji: "🚀", label: "Not against modern pace" }
  },
  {
    id: "d-test-vs-t20",
    tag: "Format War",
    question: "Cricket can only keep one format forever. Which survives?",
    optionA: { emoji: "🏛️", label: "Test cricket" },
    optionB: { emoji: "🎆", label: "T20" }
  },
  {
    id: "d-2023-rohit",
    tag: "The Skier",
    question: "Rohit plays it safe against Maxwell in the 2023 final — India win?",
    optionA: { emoji: "💯", label: "One hundred percent" },
    optionB: { emoji: "🧊", label: "Head wins it anyway" },
    momentId: "2023-head-drop"
  },
  {
    id: "d-ab-2015",
    tag: "The Heartbreak",
    question: "Did cricket owe AB de Villiers a World Cup?",
    optionA: { emoji: "💔", label: "The game owed him one" },
    optionB: { emoji: "⚖️", label: "You earn it, nobody's owed" },
    momentId: "2015-ab-runout"
  },
  {
    id: "d-gabba-2021",
    tag: "The Heist",
    question: "India's 2021 Gabba heist — the greatest Test win of all time?",
    optionA: { emoji: "🏰", label: "Nothing comes close" },
    optionB: { emoji: "🍺", label: "Headingley '81 says hi" },
    momentId: "2021-pant-holes-out"
  },
  {
    id: "d-lara-sachin",
    tag: "The Purist's Pick",
    question: "One Test match to watch from the '90s. Whose bat do you pick?",
    optionA: { emoji: "🎻", label: "Prime Brian Lara" },
    optionB: { emoji: "🎯", label: "Prime Sachin" }
  }
];
