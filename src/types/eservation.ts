export type Reservation = {
  id?: string;            // Firestore doc id
  siteKey: string;        // 例: SITE_KEY
  service: string;        // サービス名
  date: string;           // "2025-08-24"（ISO Date）
  time: string;           // "10:30" など
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt?: any;        // Firestore Timestamp
  updatedAt?: any;        // Firestore Timestamp
};
