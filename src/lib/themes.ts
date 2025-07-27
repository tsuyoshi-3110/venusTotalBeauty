
export const THEMES = {
  brandA: "from-[rgba(245,75,202,0.7)] to-[rgba(250,219,159,0.7)]",
  brandB: "from-[rgba(100,149,237,0.7)] to-[rgba(144,238,144,0.7)]",
  brandC: "from-[rgba(147,112,219,0.7)] to-[rgba(255,182,193,0.7)]",
  brandD: "from-[rgba(255,165,0,0.7)] to-[rgba(255,99,71,0.7)]",
  brandE: "from-[rgba(64,224,208,0.7)] to-[rgba(173,255,47,0.7)]",
  brandF: "from-[rgba(255,105,180,0.7)] to-[rgba(135,206,250,0.7)]", // 既存追加

  // ▼ 追加ダーク・モノトーン系
  brandG: "from-[rgba(30,30,30,0.7)] to-[rgba(60,60,60,0.7)]",       // モノトーングレー
  brandH: "from-[rgba(0,0,0,0.7)] to-[rgba(80,0,80,0.7)]",           // ブラック〜ディープパープル
  brandI: "from-[rgba(25,25,25,0.7)] to-[rgba(50,50,50,0.7)]",       // ダークグレー濃淡
} as const;

export type ThemeKey = keyof typeof THEMES;
