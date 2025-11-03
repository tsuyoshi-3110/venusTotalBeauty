export type AiSiteConfig = {
  brand: string;                // 店名
  url: string;                  // 公式URL（任意）
  areasByLang: Record<string, string>; // 対応エリア説明（言語別）
  servicesByLang: Record<string, string[]>; // 提供サービス（言語別）
  retail: boolean;              // 物販あり？
  productPageRoute: string;     // 商品一覧ページのルート（例: "/products"）
  languages: {
    default: string;            // 既定UI言語（例: "ja"）
    allowed: string[];          // 許可UI言語（例: ["ja","en",...])
  };
  limits: {
    qaBase: number;             // 共通知識の最大件数
    qaOwner: number;            // 店舗固有知識の最大件数
    qaLearned: number;          // トレーニング知識の最大件数
    menuLines: number;          // メニュー抽出の最大行
    productLines: number;       // 商品抽出の最大行
    keywords: number;           // キーワード最大件数
  };
};
