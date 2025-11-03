type OgType = "website" | "article";
export type PageDef = {
  path: string;
  title: string;
  description: string;
  ogType: OgType;
  ogImage?: string;
};
