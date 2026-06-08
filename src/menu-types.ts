export type ThemeVariant = "cocktail" | "malt" | "cigar" | "wine" | "beer" | "multi";
export type MenuStyle = "luxury" | "clean";

export type MenuTheme = {
  variant?: ThemeVariant;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
};

export type MenuFeatures = {
  showFeatured?: boolean;
  showCombos?: boolean;
  showDescriptions?: boolean;
  showTastingNotes?: boolean;
  showServingDetails?: boolean;
};

export type MenuProduct = {
  id: string;
  name: string;
  product_type: "alcohol" | "food" | "cigar" | "other";
  alcohol_type?: string;
  food_type?: string | null;
  cigar_vitola?: string;
  cigar_wrapper?: string;
  cigar_binder?: string;
  cigar_filler?: string;
  cigar_body?: string | null;
  base_price?: number | null;
  origin?: string;
  producer?: string;
  abv?: number | null;
  vintage?: string;
  cask_info?: string;
  volume_ml?: number | null;
  unit?: string;
  list_price_label?: string;
  description?: string;
  tasting_notes?: string;
  details?: Record<string, string | number | null | undefined>;
  image?: MenuProductImage | null;
  is_featured?: number;
  is_top_featured?: number;
  is_beginner?: number;
  servings?: MenuServing[];
};

export type MenuProductImage = {
  url: string;
  public_id?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string;
  updated_at?: string | null;
};

export type MenuServing = {
  label: string;
  serving_ml?: number | null;
  price?: number | null;
  sort_order?: number;
};

export type MenuSubcategory = {
  id: string;
  name: string;
  slug: string;
  sort_order?: number;
  products: MenuProduct[];
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order?: number;
  subcategories: MenuSubcategory[];
};

export type MenuCombo = {
  id: string;
  name: string;
  combo_type: string;
  description?: string;
  price?: number | null;
  discount_type?: string;
  discount_value?: number | null;
  items?: Array<{
    product_id: string;
    product_name: string;
    quantity?: number;
    pour_ml?: number | null;
    note?: string;
  }>;
};

export type MenuData = {
  schema_version: number;
  version: number;
  generated_at: string;
  bar: {
    id: string;
    name: string;
    slug: string;
    bar_type: ThemeVariant;
    description?: string;
    website_url?: string;
  };
  presentation?: {
    style?: MenuStyle;
    theme?: MenuTheme;
    features?: MenuFeatures;
  };
  visibility?: {
    app_only?: boolean;
  };
  categories: MenuCategory[];
  combos: MenuCombo[];
};

export type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; slug: string }
  | { kind: "ready"; menu: MenuData }
  | { kind: "error"; slug: string; message: string };
