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
  showFeatured?: boolean;
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
  description?: string;
  tasting_notes?: string;
  is_featured?: number;
  servings?: MenuServing[];
};

type MenuServing = {
  label: string;
  serving_ml?: number | null;
  price?: number | null;
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
    website_url?: string;
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
  showFeatured: true,
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
  return decodeSlugToken(window.location.pathname.split("/").filter(Boolean)[0] ?? "");
}

function decodeSlugToken(value: string) {
  const token = decodeURIComponent(value).trim();
  if (!token) return "";

  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes).trim();
    if (/^[a-z0-9가-힣-]+$/i.test(decoded)) return decoded;
  } catch {
    return "";
  }

  return "";
}

async function loadMenu(slug: string): Promise<MenuData> {
  const response = await fetch(`/json/${encodeURIComponent(slug)}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 404 ? "메뉴판을 찾을 수 없습니다." : "메뉴 데이터를 불러오지 못했습니다.");
  }
  const raw = await response.text();
  try {
    return JSON.parse(raw) as MenuData;
  } catch {
    if (raw.trimStart().startsWith("<!doctype") || raw.trimStart().startsWith("<html")) {
      throw new Error("메뉴 JSON 파일을 찾을 수 없습니다. 발행 후 클라이언트 배포가 완료되었는지 확인하세요.");
    }
    throw new Error("메뉴 JSON 형식이 올바르지 않습니다.");
  }
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

  if (state.kind === "idle") {
    return <EmptyShell title="Bar Setter Menu" message="메뉴 주소가 필요합니다." />;
  }
  if (state.kind === "loading") return <LoadingShell />;
  if (state.kind === "error") return <EmptyShell title={state.slug} message={state.message} />;
  return <MenuPage menu={state.menu} />;
}

type MenuView = "events" | "menu" | "wishlist" | "featured";
type PriceFilterId = "all" | "under_50000" | "50000_100000" | "100000_200000" | "over_200000";
type SortMode = "default" | "price_asc" | "price_desc" | "name";
type MenuDialog = "filter" | "sort" | null;

type ProductWithContext = {
  product: MenuProduct;
  category: MenuCategory;
  subcategory: MenuSubcategory;
};

const priceFilterOptions: Array<{
  id: PriceFilterId;
  label: string;
  description: string;
  min?: number;
  max?: number;
}> = [
  { id: "all", label: "전체 가격", description: "모든 가격대" },
  { id: "under_50000", label: "5만 이하", description: "최저 판매가 기준", max: 50000 },
  { id: "50000_100000", label: "5만-10만", description: "최저 판매가 기준", min: 50000, max: 100000 },
  { id: "100000_200000", label: "10만-20만", description: "최저 판매가 기준", min: 100000, max: 200000 },
  { id: "over_200000", label: "20만 이상", description: "최저 판매가 기준", min: 200000 }
];

const sortOptions: Array<{ id: SortMode; label: string; description: string }> = [
  { id: "default", label: "기본순", description: "관리자가 지정한 순서" },
  { id: "price_asc", label: "낮은 가격순", description: "최저 판매가 낮은 순서" },
  { id: "price_desc", label: "높은 가격순", description: "최저 판매가 높은 순서" },
  { id: "name", label: "이름순", description: "가나다 / A-Z 순서" }
];

function MenuPage({ menu }: { menu: MenuData }) {
  const theme = resolveTheme(menu);
  const themeStyle = themeVars(theme);
  const features = { ...defaultFeatures, ...menu.presentation?.features };
  const allProducts = React.useMemo(() => productsWithContext(menu), [menu]);
  const featuredProducts = React.useMemo(() => allProducts.filter((item) => item.product.is_featured), [allProducts]);
  const [view, setView] = React.useState<MenuView>("menu");
  const [activeCategoryId, setActiveCategoryId] = React.useState("all");
  const [activeSubcategoryId, setActiveSubcategoryId] = React.useState("all");
  const [selectedItem, setSelectedItem] = React.useState<ProductWithContext | null>(null);
  const [query, setQuery] = React.useState("");
  const [priceFilter, setPriceFilter] = React.useState<PriceFilterId>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("default");
  const [activeDialog, setActiveDialog] = React.useState<MenuDialog>(null);
  const { wishlistIds, toggleWishlist } = useWishlist(menu.bar.slug);

  React.useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--bg", theme.background);
    document.documentElement.style.setProperty("--surface", theme.surface);
    document.documentElement.style.setProperty("--text", theme.text);
    document.documentElement.style.setProperty("--muted", theme.muted);
    document.title = `${menu.bar.name} Menu`;
  }, [menu.bar.name, theme]);

  const visibleProducts = React.useMemo(() => {
    const search = normalizeSearch(query);
    let products =
      view === "wishlist"
        ? allProducts.filter((item) => wishlistIds.has(item.product.id))
        : view === "featured"
          ? featuredProducts
          : allProducts;

    if (view === "menu" && activeCategoryId !== "all") {
      products = products.filter((item) => item.category.id === activeCategoryId);
    }

    if (view === "menu" && activeSubcategoryId !== "all") {
      products = products.filter((item) => item.subcategory.id === activeSubcategoryId);
    }

    if (search) {
      products = products.filter((item) => productSearchText(item).includes(search));
    }

    products = products.filter((item) => matchesPriceFilter(item.product, priceFilter));
    return sortProducts(products, sortMode);
  }, [activeCategoryId, activeSubcategoryId, allProducts, featuredProducts, priceFilter, query, sortMode, view, wishlistIds]);

  const availableSubcategories = React.useMemo(() => {
    if (activeCategoryId === "all") {
      return menu.categories.flatMap((category) => category.subcategories);
    }
    return menu.categories.find((category) => category.id === activeCategoryId)?.subcategories ?? [];
  }, [activeCategoryId, menu.categories]);

  return (
    <main className="customer-menu-page" data-variant={theme.variant} style={themeStyle}>
      <header className="menu-app-header">
        <div className="bar-title-block">
          {menu.bar.website_url ? (
            <a className="bar-title-link" href={menu.bar.website_url} target="_blank" rel="noreferrer">
              <h1>{menu.bar.name}</h1>
            </a>
          ) : (
            <h1>{menu.bar.name}</h1>
          )}
          {features.showDescriptions && menu.bar.description ? <p>{menu.bar.description}</p> : null}
        </div>
      </header>

      {selectedItem ? (
        <ProductDetail
          item={selectedItem}
          isWishlisted={wishlistIds.has(selectedItem.product.id)}
          onBack={() => setSelectedItem(null)}
          onToggleWishlist={toggleWishlist}
        />
      ) : (
        <>
          <section className="menu-control-panel" aria-label="Menu controls">
            {view !== "events" ? (
              <label className="search-field">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="메뉴를 검색해보세요"
                  type="search"
                />
              </label>
            ) : null}

            {view === "menu" ? (
              <nav className="category-tabs" aria-label="대분류">
                <button
                  type="button"
                  className={activeCategoryId === "all" ? "is-active" : ""}
                  onClick={() => {
                    setActiveCategoryId("all");
                    setActiveSubcategoryId("all");
                  }}
                >
                  전체
                </button>
                {menu.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={activeCategoryId === category.id ? "is-active" : ""}
                    onClick={() => {
                      setActiveCategoryId(category.id);
                      setActiveSubcategoryId("all");
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
            ) : null}

            {view === "menu" && availableSubcategories.length ? (
              <nav className="subcategory-tabs" aria-label="서브카테고리">
                <button
                  type="button"
                  className={activeSubcategoryId === "all" ? "is-active" : ""}
                  onClick={() => setActiveSubcategoryId("all")}
                >
                  전체
                </button>
                {availableSubcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    type="button"
                    className={activeSubcategoryId === subcategory.id ? "is-active" : ""}
                    onClick={() => setActiveSubcategoryId(subcategory.id)}
                  >
                    {subcategory.name}
                  </button>
                ))}
              </nav>
            ) : null}
          </section>

          <section className="content-panel">
            <div className="section-heading">
              <span className="result-count">
                {view === "events" ? `총 ${menu.combos.length}개` : `총 ${visibleProducts.length}개`}
              </span>
              {view !== "events" ? (
                <div className="list-tools" aria-label="목록 도구">
                  <button
                    type="button"
                    className={priceFilter === "all" ? "tool-chip" : "tool-chip is-active"}
                    onClick={() => setActiveDialog("filter")}
                  >
                    <Icon name="filter" />
                    <span>필터</span>
                  </button>
                  <button
                    type="button"
                    className={sortMode === "default" ? "tool-chip" : "tool-chip is-active"}
                    onClick={() => setActiveDialog("sort")}
                  >
                    <Icon name="sort" />
                    <span>정렬</span>
                  </button>
                </div>
              ) : null}
            </div>

            {view === "events" ? (
              features.showCombos ? <ComboSection combos={menu.combos} /> : <EmptyState title="이벤트가 없습니다." />
            ) : (
              <ProductList
                items={visibleProducts}
                wishlistIds={wishlistIds}
                onOpen={setSelectedItem}
                onToggleWishlist={toggleWishlist}
                emptyTitle={
                  view === "wishlist"
                    ? "저장한 메뉴가 없습니다."
                    : view === "featured"
                      ? "추천 메뉴가 없습니다."
                      : "표시할 메뉴가 없습니다."
                }
              />
            )}
          </section>

          {activeDialog === "filter" ? (
            <OptionDialog title="가격 필터" onClose={() => setActiveDialog(null)}>
              <div className="option-list">
                {priceFilterOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={priceFilter === option.id ? "option-button is-selected" : "option-button"}
                    onClick={() => {
                      setPriceFilter(option.id);
                      setActiveDialog(null);
                    }}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </OptionDialog>
          ) : null}

          {activeDialog === "sort" ? (
            <OptionDialog title="정렬" onClose={() => setActiveDialog(null)}>
              <div className="option-list">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={sortMode === option.id ? "option-button is-selected" : "option-button"}
                    onClick={() => {
                      setSortMode(option.id);
                      setActiveDialog(null);
                    }}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </OptionDialog>
          ) : null}
        </>
      )}

      <BottomNav
        activeView={view}
        comboCount={menu.combos.length}
        featuredCount={featuredProducts.length}
        wishlistCount={wishlistIds.size}
        onChange={(nextView) => {
          setView(nextView);
          setSelectedItem(null);
          setQuery("");
          setActiveDialog(null);
        }}
      />
    </main>
  );
}

function themeVars(theme: Required<MenuTheme>) {
  return {
    "--accent": theme.accent,
    "--bg": theme.background,
    "--surface": theme.surface,
    "--text": theme.text,
    "--muted": theme.muted
  } as React.CSSProperties;
}

function OptionDialog({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="option-backdrop" role="presentation" onClick={onClose}>
      <section className="option-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="option-dialog-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ProductList({
  items,
  wishlistIds,
  onOpen,
  onToggleWishlist,
  emptyTitle
}: {
  items: ProductWithContext[];
  wishlistIds: Set<string>;
  onOpen: (item: ProductWithContext) => void;
  onToggleWishlist: (productId: string) => void;
  emptyTitle: string;
}) {
  if (!items.length) return <EmptyState title={emptyTitle} />;

  return (
    <div className="product-feed">
      {items.map((item) => (
        <ProductCard
          key={`${item.category.id}-${item.subcategory.id}-${item.product.id}`}
          item={item}
          isWishlisted={wishlistIds.has(item.product.id)}
          onOpen={onOpen}
          onToggleWishlist={onToggleWishlist}
        />
      ))}
    </div>
  );
}

function ProductCard({
  item,
  isWishlisted,
  onOpen,
  onToggleWishlist
}: {
  item: ProductWithContext;
  isWishlisted: boolean;
  onOpen: (item: ProductWithContext) => void;
  onToggleWishlist: (productId: string) => void;
}) {
  const { product } = item;

  return (
    <article className={product.is_featured ? "product-card featured" : "product-card"}>
      <button
        type="button"
        className={isWishlisted ? "wishlist-toggle is-active" : "wishlist-toggle"}
        onClick={() => onToggleWishlist(product.id)}
        aria-label={isWishlisted ? "위시리스트에서 제거" : "위시리스트에 저장"}
      >
        <Icon name="bookmark" filled={isWishlisted} />
      </button>
      <button type="button" className="product-open" onClick={() => onOpen(item)}>
        <div className="product-info">
          <div className="product-title-line">
            <h3>{productTitle(product)}</h3>
            {product.product_type === "alcohol" && product.abv ? <span>{product.abv}%</span> : null}
          </div>
          <ProductMeta product={product} />
        </div>
        <PriceBlock product={product} />
      </button>
    </article>
  );
}

function ProductMeta({ product }: { product: MenuProduct }) {
  const parts: string[] = [];
  if (product.product_type === "alcohol") {
    if (product.cask_info) parts.push(product.cask_info);
    if (product.origin) parts.push(product.origin);
  } else if (product.product_type === "cigar") {
    if (product.cigar_vitola) parts.push(product.cigar_vitola);
  }

  return parts.length ? <p className="meta">{parts.join(" · ")}</p> : null;
}

function ProductDetail({
  item,
  isWishlisted,
  onBack,
  onToggleWishlist
}: {
  item: ProductWithContext;
  isWishlisted: boolean;
  onBack: () => void;
  onToggleWishlist: (productId: string) => void;
}) {
  const { product, category, subcategory } = item;
  const detailRows = productDetailRows(product);

  return (
    <section className="detail-page">
      <div className="detail-actions">
        <button type="button" className="back-button" onClick={onBack}>
          목록
        </button>
        <button
          type="button"
          className={isWishlisted ? "wishlist-toggle detail-wishlist is-active" : "wishlist-toggle detail-wishlist"}
          onClick={() => onToggleWishlist(product.id)}
          aria-label={isWishlisted ? "위시리스트에서 제거" : "위시리스트에 저장"}
        >
          <Icon name="bookmark" filled={isWishlisted} />
        </button>
      </div>

      <article className="detail-card">
        <div className="detail-path">
          <span>{category.name}</span>
          <span>{subcategory.name}</span>
          {product.is_featured ? <strong>추천</strong> : null}
        </div>
        <h2>{productTitle(product)}</h2>

        <div className="detail-price-panel">
          <PriceBlock product={product} />
        </div>

        {detailRows.length ? (
          <section className="detail-section">
            <h3>정보</h3>
            <dl className="detail-grid">
              {detailRows.map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        ) : null}

        {product.tasting_notes ? (
          <section className="detail-section">
            <h3>노트</h3>
            <p>{product.tasting_notes}</p>
          </section>
        ) : null}

        {product.description ? (
          <section className="detail-section">
            <h3>설명</h3>
            <p>{product.description}</p>
          </section>
        ) : null}
      </article>
    </section>
  );
}

function PriceBlock({ product }: { product: MenuProduct }) {
  if (product.product_type === "alcohol" && product.servings?.length) {
    const servings = [...product.servings].sort((a, b) => servingSortOrder(a.label) - servingSortOrder(b.label));
    return (
      <div className="servings">
        {servings.map((serving) => (
          <div key={serving.label} className="serving-row">
            <span>{servingLabel(serving.label)}</span>
            <strong>{formatMenuPrice(serving.price)}</strong>
          </div>
        ))}
      </div>
    );
  }

  return <strong className="single-price">{formatMenuPrice(product.base_price)}</strong>;
}

function ComboSection({ combos }: { combos: MenuCombo[] }) {
  if (!combos.length) return <EmptyState title="등록된 이벤트가 없습니다." />;

  return (
    <div className="combo-list">
      {combos.map((combo) => (
        <article key={combo.id} className="combo-card">
          <div>
            <div className="combo-card-top">
              <span>{comboTypeLabel(combo.combo_type)}</span>
              <ComboPrice combo={combo} />
            </div>
            <h3>{combo.name}</h3>
            {combo.description ? <p className="description">{combo.description}</p> : null}
          </div>
          {combo.items?.length ? (
            <ul>
              {combo.items.map((item) => (
                <li key={`${combo.id}-${item.product_id}`}>
                  <span>{item.product_name}</span>
                  {item.pour_ml ? <small>{item.pour_ml}ml</small> : null}
                  {item.note ? <small>{item.note}</small> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ComboPrice({ combo }: { combo: MenuCombo }) {
  const discountedPrice = comboDiscountedPrice(combo);
  if (discountedPrice === null || discountedPrice === combo.price) {
    return <strong className="combo-single-price">{formatPrice(combo.price)}</strong>;
  }

  return (
    <div className="combo-price">
      <div className="combo-price-row combo-price-original">
        <span>원가</span>
        <del>{formatPrice(combo.price)}</del>
      </div>
      <div className="combo-price-row combo-price-sale">
        <span>할인가</span>
        <strong>{formatPrice(discountedPrice)}</strong>
      </div>
    </div>
  );
}

function BottomNav({
  activeView,
  comboCount,
  featuredCount,
  wishlistCount,
  onChange
}: {
  activeView: MenuView;
  comboCount: number;
  featuredCount: number;
  wishlistCount: number;
  onChange: (view: MenuView) => void;
}) {
  const items: Array<{ view: MenuView; label: string; icon: IconName; count?: number }> = [
    { view: "events", label: "이벤트", icon: "gift", count: comboCount },
    { view: "menu", label: "메뉴", icon: "bottle" },
    { view: "wishlist", label: "위시리스트", icon: "bookmark", count: wishlistCount },
    { view: "featured", label: "추천", icon: "star", count: featuredCount }
  ];

  return (
    <nav className="bottom-nav" aria-label="메뉴 하단 탐색">
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          className={activeView === item.view ? "is-active" : ""}
          onClick={() => onChange(item.view)}
        >
          <Icon name={item.icon} filled={activeView === item.view && (item.icon === "star" || item.icon === "bookmark")} />
          <span>{item.label}</span>
          {item.count ? <em>{item.count}</em> : null}
        </button>
      ))}
    </nav>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
    </div>
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

function LoadingShell() {
  return <main className="loading-shell" aria-label="메뉴 로딩 중" />;
}

function resolveTheme(menu: MenuData): Required<MenuTheme> {
  const variant = menu.presentation?.theme?.variant ?? menu.bar.bar_type ?? "multi";
  const base = themePresets[variant];
  const configured = menu.presentation?.theme ?? {};
  const accent = normalizeHexColor(configured.accent) ?? base.accent;
  const derived = configured.accent ? paletteFromAccent(accent) : {};
  return { ...base, ...derived, ...configured, accent, variant };
}

function paletteFromAccent(accent: string): Partial<Required<MenuTheme>> {
  return {
    background: mixHex("#050506", accent, 0.025),
    surface: mixHex("#141516", accent, 0.055),
    text: "#fffaf2",
    muted: mixHex("#e8e0d5", accent, 0.18)
  };
}

function normalizeHexColor(value?: string) {
  if (!value) return null;
  const next = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(next) ? next.toLowerCase() : null;
}

function mixHex(base: string, accent: string, amount: number) {
  const left = hexToRgb(base);
  const right = hexToRgb(accent);
  if (!left || !right) return base;
  return rgbToHex({
    r: Math.round(left.r + (right.r - left.r) * amount),
    g: Math.round(left.g + (right.g - left.g) * amount),
    b: Math.round(left.b + (right.b - left.b) * amount)
  });
}

function hexToRgb(value: string) {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(value);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16)
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function productsWithContext(menu: MenuData) {
  const products: ProductWithContext[] = [];
  for (const category of menu.categories) {
    for (const subcategory of category.subcategories) {
      for (const product of subcategory.products) {
        products.push({ product, category, subcategory });
      }
    }
  }
  return products;
}

function matchesPriceFilter(product: MenuProduct, filterId: PriceFilterId) {
  const option = priceFilterOptions.find((item) => item.id === filterId);
  if (!option || option.id === "all") return true;

  const price = productDisplayPrice(product);
  if (price === null) return false;
  if (option.min !== undefined && price < option.min) return false;
  if (option.max !== undefined && price > option.max) return false;
  return true;
}

function sortProducts(products: ProductWithContext[], sortMode: SortMode) {
  const next = [...products];
  if (sortMode === "price_asc") {
    return next.sort((a, b) => comparePrice(a.product, b.product, "asc"));
  }
  if (sortMode === "price_desc") {
    return next.sort((a, b) => comparePrice(a.product, b.product, "desc"));
  }
  if (sortMode === "name") {
    return next.sort((a, b) => a.product.name.localeCompare(b.product.name, "ko-KR"));
  }
  return next;
}

function comparePrice(a: MenuProduct, b: MenuProduct, direction: "asc" | "desc") {
  const left = productDisplayPrice(a);
  const right = productDisplayPrice(b);
  if (left === null && right === null) return a.name.localeCompare(b.name, "ko-KR");
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

function productDisplayPrice(product: MenuProduct) {
  const servingPrices = product.servings?.map((serving) => serving.price).filter((price): price is number => typeof price === "number") ?? [];
  if (servingPrices.length) return Math.min(...servingPrices);
  return typeof product.base_price === "number" ? product.base_price : null;
}

function useWishlist(barSlug: string) {
  const storageKey = React.useMemo(() => `barsetter:wishlist:${barSlug}`, [barSlug]);
  const [wishlistIds, setWishlistIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setWishlistIds(new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []));
    } catch {
      setWishlistIds(new Set());
    }
  }, [storageKey]);

  const toggleWishlist = React.useCallback(
    (productId: string) => {
      setWishlistIds((current) => {
        const next = new Set(current);
        if (next.has(productId)) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        try {
          window.localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // Storage can be unavailable in private browsing. The in-memory state still works for this session.
        }
        return next;
      });
    },
    [storageKey]
  );

  return { wishlistIds, toggleWishlist };
}

function productSearchText(item: ProductWithContext) {
  const { product, category, subcategory } = item;
  return normalizeSearch(
    [
      category.name,
      subcategory.name,
      product.name,
      product.sku,
      product.producer,
      product.origin,
      product.vintage,
      product.cask_info,
      product.food_type ? foodLabel(product.food_type) : "",
      product.cigar_vitola,
      product.cigar_wrapper,
      product.cigar_binder,
      product.cigar_filler,
      product.cigar_body ? bodyLabel(product.cigar_body) : "",
      product.description,
      product.tasting_notes
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function productDetailRows(product: MenuProduct): Array<[string, string]> {
  const rows: Array<[string, string]> = [];

  if (product.product_type === "alcohol") {
    if (product.producer) rows.push(["생산자", product.producer]);
    if (product.origin) rows.push(["원산지", product.origin]);
    if (product.vintage) rows.push(["빈티지/연산", product.vintage]);
    if (product.abv) rows.push(["도수", `${product.abv}%`]);
    if (product.cask_info) rows.push(["캐스크", product.cask_info]);
    if (product.volume_ml) rows.push(["기준 용량", `${product.volume_ml}ml`]);
  } else if (product.product_type === "cigar") {
    if (product.cigar_vitola) rows.push(["비톨라", product.cigar_vitola]);
    if (product.cigar_body) rows.push(["바디", bodyLabel(product.cigar_body)]);
    if (product.cigar_wrapper) rows.push(["래퍼", product.cigar_wrapper]);
    if (product.cigar_binder) rows.push(["바인더", product.cigar_binder]);
    if (product.cigar_filler) rows.push(["필러", product.cigar_filler]);
  } else if (product.product_type === "food") {
    if (product.food_type) rows.push(["분류", foodLabel(product.food_type)]);
  }

  if (product.sku) rows.push(["SKU", product.sku]);
  return rows;
}

function productTitle(product: MenuProduct) {
  return product.name;
}

function formatMenuPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return (value / 10000).toFixed(1);
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function comboDiscountedPrice(combo: MenuCombo) {
  if (combo.price === null || combo.price === undefined || !combo.discount_type || combo.discount_type === "none") {
    return combo.price ?? null;
  }

  const discountValue = combo.discount_value ?? 0;
  if (combo.discount_type === "percent") {
    return Math.max(0, Math.round(combo.price * (1 - discountValue / 100)));
  }
  if (combo.discount_type === "amount") {
    return Math.max(0, combo.price - discountValue);
  }
  return combo.price;
}

function servingLabel(value: string) {
  const labels: Record<string, string> = {
    bottle: "Bottle",
    half: "Half",
    shot: "Glass",
    glass: "Glass"
  };
  return labels[value] ?? value;
}

function servingSortOrder(value: string) {
  const order: Record<string, number> = {
    half: 0,
    glass: 1,
    shot: 1,
    bottle: 2
  };
  return order[value] ?? 99;
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

function comboTypeLabel(value: string) {
  const labels: Record<string, string> = {
    tasting: "Tasting",
    tasting_set: "Tasting Set",
    discount: "Discount",
    combo: "Combo",
    pairing: "Pairing",
    event: "Event"
  };
  return labels[value] ?? value;
}

type IconName = "search" | "gift" | "bottle" | "bookmark" | "star" | "filter" | "sort";

function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  const common = {
    "aria-hidden": true,
    className: filled ? "is-filled" : undefined,
    focusable: false,
    viewBox: "0 0 24 24"
  };

  if (name === "search") {
    return (
      <svg {...common}>
        <path d="m21 21-4.35-4.35" />
        <circle cx="11" cy="11" r="7" />
      </svg>
    );
  }

  if (name === "gift") {
    return (
      <svg {...common}>
        <path d="M20 12v8H4v-8" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 7v13" />
        <path d="M12 7H8.5a2.5 2.5 0 1 1 2.1-3.85L12 7Z" />
        <path d="M12 7h3.5a2.5 2.5 0 1 0-2.1-3.85L12 7Z" />
      </svg>
    );
  }

  if (name === "bottle") {
    return (
      <svg {...common}>
        <path d="M10 2h4" />
        <path d="M10 2v5l-2 3v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10l-2-3V2" />
        <path d="M8 14h8" />
      </svg>
    );
  }

  if (name === "bookmark") {
    return (
      <svg {...common} fill={filled ? "currentColor" : "none"}>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }

  if (name === "filter") {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M7 12h10" />
        <path d="M10 17h4" />
      </svg>
    );
  }

  if (name === "sort") {
    return (
      <svg {...common}>
        <path d="m8 5-3 3 3 3" />
        <path d="M5 8h14" />
        <path d="m16 13 3 3-3 3" />
        <path d="M19 16H5" />
      </svg>
    );
  }

  return (
    <svg {...common} fill={filled ? "currentColor" : "none"}>
      <path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" />
    </svg>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
