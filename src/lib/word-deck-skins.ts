import type { WordDeckBackground } from "./word-deck";

/** A skin pairs the table with both sides of the cards. No remote assets needed. */
export const WORD_DECK_SKINS: Record<Exclude<WordDeckBackground, "CUSTOM">, {
  label: string; icon: string; background: string; card?: string; back?: string; ink?: string; accent?: string;
}> = {
  MIDNIGHT: { label: "Midnight", icon: "♠", background: "radial-gradient(circle at 18% 18%,rgba(45,212,191,.24),transparent 32%),radial-gradient(circle at 82% 12%,rgba(99,102,241,.28),transparent 35%),linear-gradient(145deg,#0f172a,#111827 52%,#172554)" },
  EMERALD: { label: "Emerald", icon: "♠", background: "radial-gradient(circle at 80% 20%,rgba(253,224,71,.24),transparent 28%),linear-gradient(145deg,#064e3b,#047857 54%,#0f766e)" },
  VIOLET: { label: "Violet", icon: "♠", background: "radial-gradient(circle at 20% 10%,rgba(244,114,182,.28),transparent 30%),linear-gradient(145deg,#312e81,#6d28d9 55%,#701a75)" },
  SUNSET: { label: "Sunset", icon: "♠", background: "radial-gradient(circle at 70% 18%,rgba(254,240,138,.34),transparent 28%),linear-gradient(145deg,#7c2d12,#ea580c 55%,#9f1239)" },
  FOOD: { label: "Food", icon: "🍋", background: "radial-gradient(ellipse at 15% 15%,#cd6c3855,transparent 50%),repeating-linear-gradient(0deg,#ffffff04 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,#ffffff04 0 1px,transparent 1px 32px),linear-gradient(135deg,#49221b,#793b28 60%,#a85d32)", card: "#fff8e8", back: "#a4462d", ink: "#49221b", accent: "#c75b36" },
  CHORES: { label: "Chores", icon: "🧹", background: "radial-gradient(circle at 12% 18%,#7ee7d440,transparent 30%),radial-gradient(circle at 88% 85%,#a7f3d025,transparent 35%),linear-gradient(145deg,#063e47,#146474 60%,#204c67)", card: "#f0fffb", back: "#167880", ink: "#123c41", accent: "#16877c" },
  TALK: { label: "Talk · Discussion", icon: "💬", background: "radial-gradient(ellipse at 85% 10%,#ffb69c35,transparent 40%),radial-gradient(ellipse at 10% 90%,#d7bcff30,transparent 40%),linear-gradient(145deg,#30204f,#654272 60%,#88576e)", card: "#fff4f5", back: "#755085", ink: "#482d51", accent: "#a05b91" },
  WEATHER: { label: "Weather", icon: "🌤️", background: "radial-gradient(circle at 85% 18%,#ffdc8b55,transparent 22%),radial-gradient(ellipse at 10% 90%,#b9e3ff30,transparent 40%),linear-gradient(155deg,#173454,#32648b 60%,#6896ac)", card: "#f3faff", back: "#356889", ink: "#1c3d56", accent: "#397fab" },
};
