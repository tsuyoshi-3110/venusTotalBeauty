export type GoogleSyncSettings = {
  enabled: boolean;              // 口コミ表示ON/OFF（既存）
  accountEmail?: string;
  locationId?: string;           // 例: "locations/12345678901234567890"
  lastSyncAt?: number;
  worksAutoSyncEnabled?: boolean; // ★ 施工実績→写真の自動同期
  worksAlbumTag?: string;         // （任意）"works" など
};
