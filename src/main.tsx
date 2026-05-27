import { createRoot } from "react-dom/client";
import * as React from "react";
import "./styles.css";

type ThemeVariant = "cocktail" | "malt" | "cigar" | "wine" | "beer" | "multi";

type MenuTheme = {
  variant?: ThemeVariant;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
};

type MenuFeatures = {
  showCombos?: boolean;
  showDescriptions?: boolean;
  showTastingNotes?: boolean;
  showServingDetails?: boolean;
};

type MenuProduct = {
  id: string;
  name: string;
  sku?: string | null;
  product_type: "alcohol" | "food" | "cigar" | "other";
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
  currency?: string;
  description?: string;
  tasting_notes?: string;
  servings?: MenuServing[];
};

type MenuServing = {
  label: string;
  serving_ml?: number | null;
  price?: number | null;
  currency?: string;
  sort_order?: number;
};

type MenuSubcategory = {
  id: string;
  name: string;
  slug: string;
  sort_order?: number;
  products: MenuProduct[];
};

type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order?: number;
  subcategories: MenuSubcategory[];
};

type MenuCombo = {
  id: string;
  name: string;
  combo_type: string;
  description?: string;
  price?: number | null;
  currency?: string;
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

type MenuData = {
  schema_version: number;
  version: number;
  generated_at: string;
  bar: {
    id: string;
    name: string;
    slug: string;
    bar_type: ThemeVariant;
    description?: string;
  };
  presentation?: {
    theme?: MenuTheme;
    features?: MenuFeatures;
  };
  categories: MenuCategory[];
  combos: MenuCombo[];
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; slug: string }
  | { kind: "ready"; menu: MenuData }
  | { kind: "error"; slug: string; message: string };

const defaultFeatures: Required<MenuFeatures> = {
  showCombos: true,
  showDescriptions: true,
  showTastingNotes: true,
  showServingDetails: true
};

const themePresets: Record<ThemeVariant, Required<MenuTheme>> = {
  cocktail: {
    variant: "cocktail",
    accent: "#e879f9",
    background: "#130f18",
    surface: "#211827",
    text: "#fff7ed",
    muted: "#c4b5fd"
  },
  malt: {
    variant: "malt",
    accent: "#d8a657",
    background: "#17110d",
    surface: "#241a12",
    text: "#fff7ed",
    muted: "#c9b49a"
  },
  cigar: {
    variant: "cigar",
    accent: "#c08457",
    background: "#18120f",
    surface: "#251a15",
    text: "#fff7ed",
    muted: "#cbb8a7"
  },
  wine: {
    variant: "wine",
    accent: "#e11d48",
    background: "#160d13",
    surface: "#24111b",
    text: "#fff1f2",
    muted: "#f0b6c2"
  },
  beer: {
    variant: "beer",
    accent: "#fbbf24",
    background: "#15120b",
    surface: "#242013",
    text: "#fff7d6",
    muted: "#d7c68a"
  },
  multi: {
    variant: "multi",
    accent: "#38bdf8",
    background: "#101418",
    surface: "#19212a",
    text: "#f8fafc",
    muted: "#a7b6c7"
  }
};

function slugFromLocation() {
  return decodeURIComponent(window.location.pathname.split("/").filter(Boolean)[0] ?? "").trim();
}

async function loadMenu(slug: string): Promise<MenuData> {
  const response = await fetch(`/json/${encodeURIComponent(slug)}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 404 ? "메뉴판을 찾을 수 없습니다." : "메뉴 데이터를 불러오지 못했습니다.");
  }
  return response.json() as Promise<MenuData>;
}

function useMenu(): LoadState {
  const slug = slugFromLocation();
  const [state, setState] = React.useState<LoadState>(slug ? { kind: "loading", slug } : { kind: "idle" });

  React.useEffect(() => {
    if (!slug) {
      setState({ kind: "idle" });
      return;
    }

    let cancelled = false;
    setState({ kind: "loading", slug });
    loadMenu(slug)
      .then((menu) => {
        if (!cancelled) setState({ kind: "ready", menu });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "메뉴 데이터를 불러오지 못했습니다.";
        if (!cancelled) setState({ kind: "error", slug, message });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}

function App() {
  const state = useMenu();

  if (state.kind === "idle") return <EmptyShell title="Bar Setter Menu" message="메뉴 주소가 필요합니다." />;
  if (state.kind === "loading") return <EmptyShell title="Loading" message={`${state.slug} 메뉴를 불러오는 중입니다.`} />;
  if (state.kind === "error") return <EmptyShell title={state.slug} message={state.message} />;
  return <MenuPage menu={state.menu} />;
}

function MenuPage({ menu }: { menu: MenuData }) {
  const theme = resolveTheme(menu);
  const features = { ...defaultFeatures, ...menu.presentation?.features };
  const categoryRefs = React.useRef<Record<string, HTMLElement | null>>({});

  React.useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--bg", theme.background);
    document.documentElement.style.setProperty("--surface", theme.surface);
    document.documentElement.style.setProperty("--text", theme.text);
    document.documentElement.style.setProperty("--muted", theme.muted);
    document.title = `${menu.bar.name} Menu`;
  }, [menu.bar.name, theme]);

  return (
    <main className="menu-page" data-variant={theme.variant}>
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{typeLabel(menu.bar.bar_type)}</span>
          <h1>{menu.bar.name}</h1>
          {features.showDescriptions && menu.bar.description ? <p>{menu.bar.description}</p> : null}
        </div>
        <div className="hero-meta">
          <span>v{menu.version}</span>
          <span>{formatDate(menu.generated_at)}</span>
        </div>
      </header>

      <nav className="category-nav" aria-label="Menu categories">
        {menu.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => categoryRefs.current[category.id]?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            {category.name}
          </button>
        ))}
        {features.showCombos && menu.combos.length ? (
          <button type="button" onClick={() => document.getElementById("combos")?.scrollIntoView({ behavior: "smooth" })}>
            조합
          </button>
        ) : null}
      </nav>

      <section className="menu-layout">
        {menu.categories.map((category) => (
          <section
            key={category.id}
            className="menu-category"
            ref={(node) => {
              categoryRefs.current[category.id] = node;
            }}
          >
            <div className="category-heading">
              <h2>{category.name}</h2>
              <span>{productCount(category)} items</span>
            </div>
            {category.subcategories.map((subcategory) => (
              <section key={subcategory.id} className="subcategory">
                <h3>{subcategory.name}</h3>
                <div className="product-list">
                  {subcategory.products.map((product) => (
                    <ProductCard key={product.id} product={product} features={features} />
                  ))}
                </div>
              </section>
            ))}
          </section>
        ))}
      </section>

      {features.showCombos && menu.combos.length ? <ComboSection combos={menu.combos} /> : null}
    </main>
  );
}

function ProductCard({ product, features }: { product: MenuProduct; features: Required<MenuFeatures> }) {
  return (
    <article className="product-card">
      <div className="product-main">
        <div>
          <h4>{productTitle(product)}</h4>
          <ProductMeta product={product} />
        </div>
        <PriceBlock product={product} features={features} />
      </div>
      {features.showDescriptions && product.description ? <p className="description">{product.description}</p> : null}
      {features.showTastingNotes && product.tasting_notes ? <p className="notes">{product.tasting_notes}</p> : null}
    </article>
  );
}

function ProductMeta({ product }: { product: MenuProduct }) {
  const parts: string[] = [];
  if (product.product_type === "alcohol") {
    if (product.producer) parts.push(product.producer);
    if (product.origin) parts.push(product.origin);
    if (product.vintage) parts.push(product.vintage);
    if (product.abv) parts.push(`${product.abv}%`);
    if (product.cask_info) parts.push(product.cask_info);
  } else if (product.product_type === "cigar") {
    if (product.cigar_vitola) parts.push(product.cigar_vitola);
    if (product.cigar_body) parts.push(bodyLabel(product.cigar_body));
    if (product.cigar_wrapper) parts.push(`Wrapper ${product.cigar_wrapper}`);
    if (product.cigar_binder) parts.push(`Binder ${product.cigar_binder}`);
    if (product.cigar_filler) parts.push(`Filler ${product.cigar_filler}`);
  } else if (product.product_type === "food" && product.food_type) {
    parts.push(foodLabel(product.food_type));
  }

  return parts.length ? <p className="meta">{parts.join(" · ")}</p> : null;
}

function PriceBlock({ product, features }: { product: MenuProduct; features: Required<MenuFeatures> }) {
  if (product.product_type === "alcohol" && product.servings?.length) {
    return (
      <div className="servings">
        {product.servings.map((serving) => (
          <div key={serving.label} className="serving-row">
            <span>{servingLabel(serving.label)}</span>
            <strong>{formatPrice(serving.price, serving.currency)}</strong>
            {features.showServingDetails && serving.serving_ml ? <small>{serving.serving_ml}ml</small> : null}
          </div>
        ))}
      </div>
    );
  }

  return <strong className="single-price">{formatPrice(product.base_price, product.currency)}</strong>;
}

function ComboSection({ combos }: { combos: MenuCombo[] }) {
  return (
    <section id="combos" className="combo-section">
      <div className="category-heading">
        <h2>조합</h2>
        <span>{combos.length} sets</span>
      </div>
      <div className="combo-list">
        {combos.map((combo) => (
          <article key={combo.id} className="combo-card">
            <div className="product-main">
              <div>
                <h4>{combo.name}</h4>
                {combo.description ? <p className="description">{combo.description}</p> : null}
              </div>
              <strong className="single-price">{formatPrice(combo.price, combo.currency)}</strong>
            </div>
            {combo.items?.length ? (
              <ul>
                {combo.items.map((item) => (
                  <li key={`${combo.id}-${item.product_id}`}>
                    {item.product_name}
                    {item.pour_ml ? ` · ${item.pour_ml}ml` : ""}
                    {item.note ? ` · ${item.note}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="empty-shell">
      <section>
        <span className="eyebrow">Bar Setter</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function resolveTheme(menu: MenuData): Required<MenuTheme> {
  const variant = menu.presentation?.theme?.variant ?? menu.bar.bar_type ?? "multi";
  return { ...themePresets[variant], ...menu.presentation?.theme, variant };
}

function productCount(category: MenuCategory) {
  return category.subcategories.reduce((sum, subcategory) => sum + subcategory.products.length, 0);
}

function productTitle(product: MenuProduct) {
  return [product.name, product.vintage].filter(Boolean).join(" ");
}

function formatPrice(value: number | null | undefined, currency = "KRW") {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    cocktail: "Cocktail Bar",
    malt: "Malt Bar",
    cigar: "Cigar Bar",
    wine: "Wine Bar",
    beer: "Beer Bar",
    multi: "Bar Menu"
  };
  return labels[value] ?? "Bar Menu";
}

function servingLabel(value: string) {
  const labels: Record<string, string> = {
    bottle: "Bottle",
    half: "Half",
    shot: "Shot",
    glass: "Glass"
  };
  return labels[value] ?? value;
}

function bodyLabel(value: string) {
  const labels: Record<string, string> = {
    mild: "Mild",
    medium: "Medium",
    medium_full: "Medium Full",
    full: "Full"
  };
  return labels[value] ?? value;
}

function foodLabel(value: string) {
  const labels: Record<string, string> = {
    dish: "푸드",
    dessert: "디저트",
    snack: "스낵",
    pairing: "페어링",
    other: "기타"
  };
  return labels[value] ?? value;
}

createRoot(document.getElementById("root")!).render(<App />);
