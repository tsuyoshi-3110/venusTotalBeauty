export type GoogleSync = {
  enabled: boolean;
  accountEmail?: string;
  hasApiConsent?: boolean;
  locationId?: string;
  lastSyncAt?: number; // epoch ms
};

export type SiteSettingsEditable = {
  siteKey: string;
  name: string;
  phone?: string;
  website?: string;
  address?: {
    postalCode?: string;
    region?: string;     // 都道府県
    locality?: string;   // 市区町村
    street?: string;     // 丁・番地
    countryCode?: string;// "JP"
    lat?: number;
    lng?: number;
  };
  openingHours?: { day: number; open: string; close: string }[]; // 0=Sun … 6=Sat
  images?: string[];
  googleSync?: GoogleSync;
};
