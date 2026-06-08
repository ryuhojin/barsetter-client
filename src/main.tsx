import { createRoot } from "react-dom/client";
import * as React from "react";
import "./styles.css";
import { canRequestMenuRefresh, isAndroidMenuApp, loadMenu, requestMenuRefresh, slugFromLocation } from "./menu-routing";
import { defaultFeatures, resolveMenuStyle, resolveTheme, themeVars } from "./menu-theme";
import type {
  LoadState,
  MenuCategory,
  MenuCombo,
  MenuData,
  MenuProduct,
  MenuServing,
  MenuSubcategory
} from "./menu-types";

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

  React.useEffect(() => {
    document.documentElement.classList.toggle("barsetter-android-app", isAndroidMenuApp());
    return () => document.documentElement.classList.remove("barsetter-android-app");
  }, []);

  if (state.kind === "idle") {
    return <EmptyShell title="Bar Setter Menu" message="메뉴 주소가 필요합니다." />;
  }
  if (state.kind === "loading") return <LoadingShell />;
  if (state.kind === "error") return <EmptyShell title={state.slug} message={state.message} />;
  if (state.menu.visibility?.app_only && !isAndroidMenuApp()) {
    return <EmptyShell title={state.menu.bar.name} message="앱 전용 메뉴판입니다." />;
  }
  if (resolveMenuStyle(state.menu) === "clean") return <CleanMenuPage menu={state.menu} />;
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

function useMenuRefreshLongPress(): React.HTMLAttributes<HTMLElement> {
  const timerRef = React.useRef<number | null>(null);
  const touchActiveRef = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    if (!canRequestMenuRefresh()) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      requestMenuRefresh();
    }, 650);
  }, [clearTimer]);

  React.useEffect(() => clearTimer, [clearTimer]);

  return React.useMemo(
    () => ({
      onTouchStart: () => {
        touchActiveRef.current = true;
        startTimer();
      },
      onTouchEnd: clearTimer,
      onTouchCancel: clearTimer,
      onMouseDown: (event) => {
        if (touchActiveRef.current || event.button !== 0) return;
        startTimer();
      },
      onMouseUp: clearTimer,
      onMouseLeave: clearTimer,
      onContextMenu: (event) => {
        if (!canRequestMenuRefresh()) return;
        event.preventDefault();
      }
    }),
    [clearTimer, startTimer]
  );
}

function CleanMenuPage({ menu }: { menu: MenuData }) {
  const theme = resolveTheme(menu);
  const refreshLongPress = useMenuRefreshLongPress();
  const allCleanProducts = React.useMemo(() => productsWithContext(menu), [menu]);
  const validProductIds = React.useMemo(() => new Set(allCleanProducts.map((item) => item.product.id)), [allCleanProducts]);
  const cleanProductsById = React.useMemo(() => new Map(allCleanProducts.map((item) => [item.product.id, item])), [allCleanProducts]);
  const validComboIds = React.useMemo(() => new Set(menu.combos.map((combo) => combo.id)), [menu.combos]);
  const cleanCombosById = React.useMemo(() => new Map(menu.combos.map((combo) => [combo.id, combo])), [menu.combos]);
  const validScreens = React.useMemo(() => new Set(["intro", "index", "events", ...menu.categories.map((category) => category.id)]), [menu.categories]);
  const [screen, setScreenState] = React.useState<"intro" | "index" | "events" | string>(() => cleanScreenFromHistory(validScreens) ?? "intro");
  const [selectedCleanProductId, setSelectedCleanProductId] = React.useState<string | null>(() => cleanProductIdFromHistory(validProductIds));
  const [selectedCleanComboId, setSelectedCleanComboId] = React.useState<string | null>(() => cleanComboIdFromHistory(validComboIds));
  const [cleanQuery, setCleanQuery] = React.useState("");
  const selectedCategory = menu.categories.find((category) => category.id === screen);
  const selectedCleanItem = selectedCleanProductId ? cleanProductsById.get(selectedCleanProductId) ?? null : null;
  const selectedCleanCombo = selectedCleanComboId ? cleanCombosById.get(selectedCleanComboId) ?? null : null;
  const selectedProducts = selectedCategory ? productsWithContext({ ...menu, categories: [selectedCategory] }) : [];
  const normalizedCleanQuery = normalizeSearch(cleanQuery);
  const filteredCleanProducts = normalizedCleanQuery
    ? selectedProducts.filter((item) => productSearchText(item).includes(normalizedCleanQuery))
    : selectedProducts;
  const cleanTopFeaturedProducts = filteredCleanProducts.filter((item) => item.product.is_top_featured);
  const cleanRegularProducts = filteredCleanProducts.filter((item) => !item.product.is_top_featured);
  const filteredCleanCombos = normalizedCleanQuery
    ? menu.combos.filter((combo) => comboSearchText(combo).includes(normalizedCleanQuery))
    : menu.combos;

  React.useEffect(() => {
    document.title = `${menu.bar.name} Menu`;
  }, [menu.bar.name]);

  React.useEffect(() => {
    if (!cleanScreenFromHistory(validScreens)) {
      replaceCleanHistoryState(screen, false);
    }

    const handlePopState = () => {
      setScreenState(cleanScreenFromHistory(validScreens) ?? "intro");
      setSelectedCleanProductId(cleanProductIdFromHistory(validProductIds));
      setSelectedCleanComboId(cleanComboIdFromHistory(validComboIds));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [screen, validComboIds, validProductIds, validScreens]);

  const setScreen = React.useCallback(
    (nextScreen: "intro" | "index" | "events" | string) => {
      const normalized = validScreens.has(nextScreen) ? nextScreen : "intro";
      setScreenState(normalized);
      setSelectedCleanProductId(null);
      setSelectedCleanComboId(null);
      setCleanQuery("");
      pushCleanHistoryState(normalized, false);
    },
    [validScreens]
  );

  const openCleanDetail = React.useCallback(
    (item: ProductWithContext) => {
      setSelectedCleanProductId(item.product.id);
      setSelectedCleanComboId(null);
      pushCleanHistoryState(screen, false, { productId: item.product.id });
    },
    [screen]
  );

  const closeCleanDetail = React.useCallback(() => {
    if (selectedCleanProductId && cleanProductIdFromHistory(validProductIds)) {
      window.history.back();
      return;
    }
    setSelectedCleanProductId(null);
    replaceCleanHistoryState(screen, false);
  }, [screen, selectedCleanProductId, validProductIds]);

  const openCleanComboDetail = React.useCallback(
    (combo: MenuCombo) => {
      setSelectedCleanComboId(combo.id);
      setSelectedCleanProductId(null);
      pushCleanHistoryState(screen, false, { comboId: combo.id });
    },
    [screen]
  );

  const closeCleanComboDetail = React.useCallback(() => {
    if (selectedCleanComboId && cleanComboIdFromHistory(validComboIds)) {
      window.history.back();
      return;
    }
    setSelectedCleanComboId(null);
    replaceCleanHistoryState(screen, false);
  }, [screen, selectedCleanComboId, validComboIds]);

  if (screen === "intro") {
    return (
      <main className="clean-menu-page" style={themeVars(theme)}>
        <section className="clean-intro">
          <div>
            <h1 className="refreshable-bar-title" {...refreshLongPress}>{menu.bar.name}</h1>
            {menu.bar.description ? <p>{menu.bar.description}</p> : null}
          </div>
          <button type="button" onClick={() => setScreen("index")}>
            메뉴판 보기
          </button>
        </section>
      </main>
    );
  }

  if (screen === "index") {
    return (
      <main className="clean-menu-page" style={themeVars(theme)}>
        <section className="clean-category-screen">
          <button type="button" className="clean-text-button" onClick={() => setScreen("intro")}>
            소개
          </button>
          <div className="clean-category-title">
            <h1 className="refreshable-bar-title" {...refreshLongPress}>{menu.bar.name}</h1>
            <p>카테고리를 선택하세요</p>
          </div>
          <nav className="clean-category-list" aria-label="메뉴 카테고리">
            {menu.combos.length ? (
              <button type="button" onClick={() => setScreen("events")}>
                <span>Event</span>
                <small>{menu.combos.length}</small>
              </button>
            ) : null}
            {menu.categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setScreen(category.id)}>
                <span>{category.name}</span>
                <small>{categoryProductCount(category)}</small>
              </button>
            ))}
          </nav>
        </section>
      </main>
    );
  }

  if (screen === "events") {
    if (selectedCleanCombo) {
      return <CleanComboDetailPage combo={selectedCleanCombo} onBack={closeCleanComboDetail} style={themeVars(theme)} />;
    }

    return (
      <main className="clean-menu-page clean-list-page" style={themeVars(theme)}>
        <CleanListHeader
          title="Event"
          count={filteredCleanCombos.length}
          onBack={() => setScreen("index")}
          searchValue={cleanQuery}
          onSearchChange={setCleanQuery}
        />
        <div className="clean-menu-list">
          {filteredCleanCombos.length ? (
            filteredCleanCombos.map((combo) => (
              <article key={combo.id} className="clean-menu-row">
                <button type="button" className="clean-menu-row-button" onClick={() => openCleanComboDetail(combo)}>
                  <div>
                    <h2>{combo.name}</h2>
                    {combo.description ? <p>{combo.description}</p> : null}
                  </div>
                  <strong>{formatCleanPrice(comboDiscountedPrice(combo) ?? combo.price)}</strong>
                </button>
              </article>
            ))
          ) : (
            <CleanEmptyState title={cleanQuery ? "검색 결과가 없습니다." : "등록된 이벤트가 없습니다."} />
          )}
        </div>
      </main>
    );
  }

  if (selectedCleanItem) {
    return (
      <CleanProductDetailPage
        item={selectedCleanItem}
        onBack={closeCleanDetail}
        style={themeVars(theme)}
      />
    );
  }

  return (
    <main className="clean-menu-page clean-list-page" style={themeVars(theme)}>
      <CleanListHeader
        title={selectedCategory?.name ?? "Menu"}
        count={filteredCleanProducts.length}
        onBack={() => setScreen("index")}
        searchValue={cleanQuery}
        onSearchChange={setCleanQuery}
      />
      <div className="clean-menu-list">
        {filteredCleanProducts.length ? (
          <>
            {cleanTopFeaturedProducts.length ? (
              <section className="clean-featured-section" aria-label="주요 메뉴">
                <div className="clean-featured-list">
                  {cleanTopFeaturedProducts.map((item) => (
                    <CleanFeaturedProduct
                      key={`${item.category.id}-${item.subcategory.id}-${item.product.id}`}
                      item={item}
                      onOpen={openCleanDetail}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {cleanRegularProducts.map((item) => {
              const price = cleanProductPrice(item.product);
              return (
                <article key={`${item.category.id}-${item.subcategory.id}-${item.product.id}`} className="clean-menu-row">
                  <button type="button" className="clean-menu-row-button" onClick={() => openCleanDetail(item)}>
                    <div>
                      <div className="clean-menu-row-title">
                        <h2>{productTitle(item.product)}</h2>
                        {item.product.is_featured ? <span>추천</span> : null}
                        {item.product.is_beginner ? <span className="beginner-badge">입문</span> : null}
                      </div>
                      <p>{item.subcategory.name}</p>
                    </div>
                    <div className="clean-price">
                      <span>{price.label}</span>
                      <strong>{price.value}</strong>
                    </div>
                  </button>
                </article>
              );
            })}
          </>
        ) : (
          <CleanEmptyState title={cleanQuery ? "검색 결과가 없습니다." : "등록된 메뉴가 없습니다."} />
        )}
      </div>
    </main>
  );
}

function CleanFeaturedProduct({ item, onOpen }: { item: ProductWithContext; onOpen: (item: ProductWithContext) => void }) {
  const { product } = item;
  const price = cleanProductPrice(product);
  const metaParts = cleanFeaturedMetaParts(item);
  const summary = cleanFeaturedSummary(product);
  const hasBadges = Boolean(product.is_featured || product.is_beginner);

  return (
    <article className="clean-featured-card">
      <button type="button" className="clean-featured-card-button" onClick={() => onOpen(item)}>
        <div className="clean-featured-body">
          {hasBadges ? (
            <div className="clean-featured-kicker">
              {product.is_featured ? <span>추천</span> : null}
              {product.is_beginner ? <span className="beginner-badge">입문</span> : null}
            </div>
          ) : null}
          <div className="clean-featured-title-row">
            <div className="clean-featured-copy">
              <h2>{productTitle(product)}</h2>
              {metaParts.length ? <p className="clean-featured-meta">{metaParts.join(" · ")}</p> : null}
              {summary ? <p className="clean-featured-summary">{summary}</p> : null}
            </div>
            <div className="clean-price">
              <span>{price.label}</span>
              <strong>{price.value}</strong>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}

function CleanProductDetailPage({ item, onBack, style }: { item: ProductWithContext; onBack: () => void; style: React.CSSProperties }) {
  const { product, category, subcategory } = item;
  const detailRows = productDetailRows(product);
  const detailCardRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    if (!detailCardRef.current) return;
    detailCardRef.current.scrollLeft = 0;
    detailCardRef.current.scrollTop = 0;
  }, [product.id]);

  return (
    <main className="clean-menu-page clean-detail-page" style={style}>
      <header className="clean-detail-header">
        <button type="button" className="clean-text-button" onClick={onBack}>
          뒤로가기
        </button>
        <p>
          {category.name} / {subcategory.name}
        </p>
      </header>

      <article ref={detailCardRef} className="clean-detail-card">
        <div className="clean-detail-title">
          <h1>{productTitle(product)}</h1>
          {product.is_featured || product.is_beginner ? (
            <div className="clean-detail-badges">
              {product.is_featured ? <span>추천</span> : null}
              {product.is_beginner ? <span className="beginner-badge">입문</span> : null}
            </div>
          ) : null}
        </div>

        <ProductDetailImage product={product} variant="clean" />

        <section className="clean-detail-section clean-detail-price-section">
          <h2>가격</h2>
          <CleanDetailPrice product={product} />
        </section>

        {detailRows.length ? (
          <section className="clean-detail-section">
            <h2>정보</h2>
            <dl>
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
          <section className="clean-detail-section">
            <h2>노트</h2>
            <p>{product.tasting_notes}</p>
          </section>
        ) : null}

        {product.description ? (
          <section className="clean-detail-section">
            <h2>설명</h2>
            <p>{product.description}</p>
          </section>
        ) : null}
      </article>
    </main>
  );
}

function CleanComboDetailPage({ combo, onBack, style }: { combo: MenuCombo; onBack: () => void; style: React.CSSProperties }) {
  const items = combo.items ?? [];
  const detailCardRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    if (!detailCardRef.current) return;
    detailCardRef.current.scrollLeft = 0;
    detailCardRef.current.scrollTop = 0;
  }, [combo.id]);

  return (
    <main className="clean-menu-page clean-detail-page" style={style}>
      <header className="clean-detail-header">
        <button type="button" className="clean-text-button" onClick={onBack}>
          뒤로가기
        </button>
        <p>Event</p>
      </header>

      <article ref={detailCardRef} className="clean-detail-card">
        <div className="clean-detail-title">
          <h1>{combo.name}</h1>
        </div>

        <section className="clean-detail-section clean-detail-price-section">
          <h2>가격</h2>
          <CleanComboDetailPrice combo={combo} />
        </section>

        {items.length ? (
          <section className="clean-detail-section">
            <h2>구성 상품</h2>
            <ul className="clean-combo-item-list">
              {items.map((item, index) => {
                const summary = comboItemSummary(item);
                return (
                  <li key={`${item.product_id}-${index}`}>
                    <strong>{item.product_name}</strong>
                    {summary ? <span>{summary}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {combo.description ? (
          <section className="clean-detail-section">
            <h2>설명</h2>
            <p>{combo.description}</p>
          </section>
        ) : null}
      </article>
    </main>
  );
}

function CleanComboDetailPrice({ combo }: { combo: MenuCombo }) {
  const discountedPrice = comboDiscountedPrice(combo);
  const hasDiscount = discountedPrice !== null && combo.price !== null && combo.price !== undefined && discountedPrice !== combo.price;

  if (hasDiscount) {
    return (
      <dl className="clean-detail-price-list">
        <dt>
          <span>원가</span>
        </dt>
        <dd>
          <del>{formatCleanPrice(combo.price)}</del>
        </dd>
        <dt>
          <span>할인가</span>
        </dt>
        <dd>{formatCleanPrice(discountedPrice)}</dd>
      </dl>
    );
  }

  return (
    <div className="clean-detail-price-empty">
      <span>Price</span>
      <strong>{formatCleanPrice(discountedPrice ?? combo.price)}</strong>
    </div>
  );
}

function CleanDetailPrice({ product }: { product: MenuProduct }) {
  const rows = cleanDetailPriceRows(product);

  if (!rows.length) {
    return (
      <div className="clean-detail-price-empty">
        <span>Price</span>
        <strong>가격 미정</strong>
      </div>
    );
  }

  return (
    <dl className="clean-detail-price-list">
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <dt>
            <span>{row.label}</span>
            {row.subLabel ? <small>{row.subLabel}</small> : null}
          </dt>
          <dd>{row.price}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function CleanListHeader({
  title,
  count,
  onBack,
  searchValue,
  onSearchChange
}: {
  title: string;
  count: number;
  onBack: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <header className="clean-list-header">
      <button type="button" className="clean-text-button clean-list-back" onClick={onBack}>
        뒤로가기
      </button>
      <div className="clean-list-title">
        <h1>{title}</h1>
      </div>
      <label className={searchValue ? "clean-search-button is-active" : "clean-search-button"}>
        <Icon name="search" />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="검색어 입력"
          type="search"
        />
      </label>
      <p className="clean-list-count">총 {count}개</p>
    </header>
  );
}
function CleanEmptyState({ title }: { title: string }) {
  return (
    <div className="clean-empty-state">
      <p>{title}</p>
    </div>
  );
}

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
  const refreshLongPress = useMenuRefreshLongPress();
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
  const feedScrollPositions = React.useRef<Record<string, number>>({});
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
  const productListScrollKey = React.useMemo(
    () => [view, activeCategoryId, activeSubcategoryId, query, priceFilter, sortMode].join("|"),
    [activeCategoryId, activeSubcategoryId, priceFilter, query, sortMode, view]
  );

  return (
    <main className="customer-menu-page" data-variant={theme.variant} style={themeStyle}>
      <header className="menu-app-header">
        <div className="bar-title-block">
          {menu.bar.website_url ? (
            <a className="bar-title-link" href={menu.bar.website_url} target="_blank" rel="noreferrer">
              <h1 className="refreshable-bar-title" {...refreshLongPress}>{menu.bar.name}</h1>
            </a>
          ) : (
            <h1 className="refreshable-bar-title" {...refreshLongPress}>{menu.bar.name}</h1>
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
                scrollKey={productListScrollKey}
                scrollPositions={feedScrollPositions}
                onOpen={setSelectedItem}
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

function cleanScreenFromHistory(validScreens: ReadonlySet<string>) {
  const state = window.history.state;
  if (!state || typeof state !== "object") return null;
  const screen = (state as { barsetterCleanScreen?: unknown }).barsetterCleanScreen;
  return typeof screen === "string" && validScreens.has(screen) ? screen : null;
}

function cleanProductIdFromHistory(validProductIds: ReadonlySet<string>) {
  const state = window.history.state;
  if (!state || typeof state !== "object") return null;
  const productId = (state as { barsetterCleanProductId?: unknown }).barsetterCleanProductId;
  return typeof productId === "string" && validProductIds.has(productId) ? productId : null;
}

function cleanComboIdFromHistory(validComboIds: ReadonlySet<string>) {
  const state = window.history.state;
  if (!state || typeof state !== "object") return null;
  const comboId = (state as { barsetterCleanComboId?: unknown }).barsetterCleanComboId;
  return typeof comboId === "string" && validComboIds.has(comboId) ? comboId : null;
}

type CleanHistoryDetail = {
  productId?: string | null;
  comboId?: string | null;
};

function replaceCleanHistoryState(screen: string, searchOpen: boolean, detail: CleanHistoryDetail = {}) {
  const state = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
  window.history.replaceState(
    {
      ...state,
      barsetterCleanScreen: screen,
      barsetterCleanSearchOpen: searchOpen,
      barsetterCleanProductId: detail.productId ?? null,
      barsetterCleanComboId: detail.comboId ?? null
    },
    "",
    window.location.href
  );
}

function pushCleanHistoryState(screen: string, searchOpen: boolean, detail: CleanHistoryDetail = {}) {
  const state = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
  window.history.pushState(
    {
      ...state,
      barsetterCleanScreen: screen,
      barsetterCleanSearchOpen: searchOpen,
      barsetterCleanProductId: detail.productId ?? null,
      barsetterCleanComboId: detail.comboId ?? null
    },
    "",
    window.location.href
  );
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
  scrollKey,
  scrollPositions,
  onOpen,
  emptyTitle
}: {
  items: ProductWithContext[];
  scrollKey: string;
  scrollPositions: React.MutableRefObject<Record<string, number>>;
  onOpen: (item: ProductWithContext) => void;
  emptyTitle: string;
}) {
  const feedRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const restoreFrame = window.requestAnimationFrame(() => {
      feed.scrollTop = scrollPositions.current[scrollKey] ?? 0;
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, [scrollKey, scrollPositions]);

  const handleOpen = React.useCallback(
    (item: ProductWithContext) => {
      if (feedRef.current) {
        scrollPositions.current[scrollKey] = feedRef.current.scrollTop;
      }
      onOpen(item);
    },
    [onOpen, scrollKey, scrollPositions]
  );

  if (!items.length) return <EmptyState title={emptyTitle} />;

  return (
    <div
      ref={feedRef}
      className="product-feed"
      onScroll={(event) => {
        scrollPositions.current[scrollKey] = event.currentTarget.scrollTop;
      }}
    >
      {items.map((item) => (
        <ProductCard
          key={`${item.category.id}-${item.subcategory.id}-${item.product.id}`}
          item={item}
          onOpen={handleOpen}
        />
      ))}
    </div>
  );
}

function ProductCard({
  item,
  onOpen
}: {
  item: ProductWithContext;
  onOpen: (item: ProductWithContext) => void;
}) {
  const { product } = item;

  return (
    <article className={product.is_featured ? "product-card featured" : "product-card"}>
      <button
        type="button"
        className={isSinglePriceDisplayProduct(product) ? "product-open single-price-product" : "product-open"}
        onClick={() => onOpen(item)}
      >
        <div className="product-info">
          <div className="product-title-line">
            <h3>{productTitle(product)}</h3>
            {product.is_beginner ? <span className="beginner-badge">입문</span> : null}
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
  const parts = productListMetaParts(product);

  return parts.length ? <p className="meta">{parts.join(" · ")}</p> : null;
}

function productListMetaParts(product: MenuProduct) {
  const parts: string[] = [];
  if (product.product_type === "alcohol") {
    const details = product.details ?? {};
    if (product.alcohol_type) parts.push(alcoholTypeLabel(product.alcohol_type));
    for (const key of alcoholListDetailKeys(product.alcohol_type)) {
      const value = detailValue(details[key]);
      if (value) parts.push(value);
    }
    if (product.cask_info) parts.push(product.cask_info);
    if (product.origin) parts.push(product.origin);
  } else if (product.product_type === "cigar") {
    if (product.cigar_vitola) parts.push(product.cigar_vitola);
  }

  return parts.slice(0, 4);
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
          {product.is_beginner ? <strong className="beginner-badge">입문</strong> : null}
        </div>
        <h2>{productTitle(product)}</h2>

        <ProductDetailImage product={product} variant="default" />

        <div className="detail-price-panel">
          <PriceBlock product={product} variant="detail" />
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

function ProductDetailImage({ product, variant }: { product: MenuProduct; variant: "default" | "clean" }) {
  const imageUrl = product.image?.url?.trim();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) return null;

  return (
    <figure className={variant === "clean" ? "clean-detail-image" : "detail-product-image"}>
      <img
        src={imageUrl}
        alt={`${productTitle(product)} 이미지`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </figure>
  );
}

function PriceBlock({ product, variant = "list" }: { product: MenuProduct; variant?: "list" | "detail" }) {
  if (product.product_type === "alcohol" && product.servings?.length) {
    const servings = pricedServings(product.servings);
    if (!servings.length) return <PriceUnavailable variant={variant} />;
    if (variant === "list") {
      const serving = representativeServing(product, servings);
      if (!serving) return <PriceUnavailable variant={variant} />;
      return (
        <div className="single-price-block">
          <span>{servingLabel(serving.label)}</span>
          <strong className="single-price">{formatMenuPrice(serving.price)}</strong>
        </div>
      );
    }
    const singlePriceServing = servings.length === 1 && servings[0].label === "price" ? servings[0] : null;
    if (singlePriceServing) {
      return (
        <div className={variant === "detail" ? "single-price-block detail-single-price" : "single-price-block"}>
          <span>PRICE</span>
          {variant === "detail" && singlePriceServing.serving_ml ? (
            <small className="serving-ml">{formatServingMl(singlePriceServing.serving_ml)}</small>
          ) : null}
          <strong className="single-price">{formatMenuPrice(singlePriceServing.price)}</strong>
        </div>
      );
    }
    const countClass = `servings serving-count-${Math.min(servings.length, 3)}`;

    return (
      <div className={variant === "detail" ? `${countClass} detail-servings` : countClass}>
        {servings.map((serving) => (
          <div key={serving.label} className="serving-row">
            <span>{servingLabel(serving.label)}</span>
            {variant === "detail" ? <small className="serving-ml">{formatServingMl(serving.serving_ml)}</small> : null}
            <strong>{formatMenuPrice(serving.price)}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (isNativeSinglePriceProduct(product)) {
    if (!isPriced(product.base_price)) return <PriceUnavailable variant={variant} />;
    return (
      <div className={variant === "detail" ? "single-price-block detail-single-price" : "single-price-block"}>
        <span>PRICE</span>
        <strong className="single-price">{formatMenuPrice(product.base_price)}</strong>
      </div>
    );
  }

  if (!isPriced(product.base_price)) return <PriceUnavailable variant={variant} />;
  return <strong className="single-price">{formatMenuPrice(product.base_price)}</strong>;
}

function PriceUnavailable({ variant = "list" }: { variant?: "list" | "detail" }) {
  return (
    <div className={variant === "detail" ? "price-unavailable detail-price-unavailable" : "price-unavailable"}>
      <span>PRICE</span>
      <strong>가격 미정</strong>
    </div>
  );
}

function isNativeSinglePriceProduct(product: MenuProduct) {
  return product.product_type !== "alcohol";
}

function isSinglePriceDisplayProduct(product: MenuProduct) {
  if (isNativeSinglePriceProduct(product)) return true;
  return representativeServing(product, pricedServings(product.servings)) !== null;
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

function categoryProductCount(category: MenuCategory) {
  return category.subcategories.reduce((sum, subcategory) => sum + subcategory.products.length, 0);
}

function cleanFeaturedMetaParts(item: ProductWithContext) {
  const { product, subcategory } = item;
  const parts: string[] = [];
  pushUnique(parts, subcategory.name);
  pushUnique(parts, product.producer);
  for (const part of productListMetaParts(product)) pushUnique(parts, part);
  if (product.abv) pushUnique(parts, `${product.abv}%`);
  if (product.volume_ml) pushUnique(parts, `${product.volume_ml}${product.unit || "ml"}`);
  return parts.slice(0, 5);
}

function cleanFeaturedSummary(product: MenuProduct) {
  return (product.tasting_notes?.trim() || product.description?.trim() || "").replace(/\s+/g, " ");
}

function pushUnique(parts: string[], value: string | number | null | undefined) {
  const normalized = typeof value === "number" ? String(value) : value?.trim();
  if (normalized && !parts.includes(normalized)) parts.push(normalized);
}

function cleanProductPrice(product: MenuProduct) {
  if (product.product_type === "alcohol") {
    const servings = pricedServings(product.servings);
    const serving = representativeServing(product, servings);
    return {
      label: serving ? servingLabel(serving.label) : "Price",
      value: serving ? formatCleanPrice(serving.price) : "가격 미정"
    };
  }

  return {
    label: "Price",
    value: isPriced(product.base_price) ? formatCleanPrice(product.base_price) : "가격 미정"
  };
}

function cleanDetailPriceRows(product: MenuProduct) {
  if (product.product_type === "alcohol") {
    return pricedServings(product.servings).map((serving) => ({
      label: servingLabel(serving.label),
      subLabel: serving.serving_ml ? formatServingMl(serving.serving_ml) : "",
      price: formatCleanPrice(serving.price)
    }));
  }

  if (!isPriced(product.base_price)) return [];
  return [
    {
      label: "Price",
      subLabel: product.volume_ml ? `${product.volume_ml}${product.unit ? product.unit : "ml"}` : "",
      price: formatCleanPrice(product.base_price)
    }
  ];
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
  const serving = representativeServing(product, pricedServings(product.servings));
  if (serving && isPriced(serving.price)) return serving.price;
  return typeof product.base_price === "number" ? product.base_price : null;
}

function representativeServing(product: MenuProduct, servings: MenuServing[]) {
  if (!servings.length) return null;
  const preferred = product.list_price_label?.trim();
  if (preferred) {
    const matched = servings.find((serving) => serving.label === preferred);
    if (matched) return matched;
  }
  const glass = servings.find((serving) => serving.label === "glass");
  if (glass) return glass;
  return servings[0];
}

function pricedServings(servings: MenuServing[] | undefined) {
  return (servings ?? [])
    .filter((serving) => isPriced(serving.price))
    .sort((a, b) => servingSortOrder(a.label) - servingSortOrder(b.label));
}

function isPriced(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
      product.producer,
      product.origin,
      product.alcohol_type ? alcoholTypeLabel(product.alcohol_type) : "",
      product.vintage,
      product.cask_info,
      ...Object.values(product.details ?? {}).map((value) => detailValue(value)),
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

function comboSearchText(combo: MenuCombo) {
  return normalizeSearch(
    [
      combo.name,
      combo.description,
      combo.combo_type ? comboTypeLabel(combo.combo_type) : "",
      ...(combo.items ?? []).flatMap((item) => [item.product_name, item.note])
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function comboItemSummary(item: NonNullable<MenuCombo["items"]>[number]) {
  return [
    item.quantity && item.quantity !== 1 ? `${item.quantity}개` : "",
    item.pour_ml ? `${item.pour_ml}ml` : "",
    item.note
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function productDetailRows(product: MenuProduct): Array<[string, string]> {
  const rows: Array<[string, string]> = [];

  if (product.product_type === "alcohol") {
    if (product.alcohol_type) rows.push(["주류 종류", alcoholTypeLabel(product.alcohol_type)]);
    if (product.producer) rows.push(["생산자", product.producer]);
    if (product.origin) rows.push(["원산지", product.origin]);
    if (product.vintage) rows.push(["빈티지/연산", product.vintage]);
    if (product.abv) rows.push(["도수", `${product.abv}%`]);
    if (product.cask_info) rows.push(["캐스크", product.cask_info]);
    if (product.volume_ml) rows.push(["기준 용량", `${product.volume_ml}ml`]);
    rows.push(...alcoholDetailRows(product));
  } else if (product.product_type === "cigar") {
    if (product.cigar_vitola) rows.push(["비톨라", product.cigar_vitola]);
    if (product.cigar_body) rows.push(["바디", bodyLabel(product.cigar_body)]);
    if (product.cigar_wrapper) rows.push(["래퍼", product.cigar_wrapper]);
    if (product.cigar_binder) rows.push(["바인더", product.cigar_binder]);
    if (product.cigar_filler) rows.push(["필러", product.cigar_filler]);
  } else if (product.product_type === "food") {
    if (product.food_type) rows.push(["분류", foodLabel(product.food_type)]);
  }
  return rows;
}

function alcoholDetailRows(product: MenuProduct): Array<[string, string]> {
  const details = product.details ?? {};
  return alcoholDetailLabels(product.alcohol_type)
    .map(([key, label]) => [label, detailValue(details[key])] as [string, string])
    .filter(([, value]) => Boolean(value));
}

function alcoholListDetailKeys(value?: string) {
  const keys: Record<string, string[]> = {
    whisky: ["region", "distillery"],
    wine: ["grape", "appellation"],
    beer: ["beer_style", "brewery"],
    cocktail: ["base_spirit", "glassware"],
    brandy: ["region", "grade"],
    rum: ["style", "age"],
    gin: ["style", "botanicals"],
    vodka: ["base"],
    tequila: ["class", "agave"],
    liqueur: ["flavor"]
  };
  return keys[value ?? ""] ?? ["style"];
}

function alcoholDetailLabels(value?: string): Array<[string, string]> {
  const labels: Record<string, Array<[string, string]>> = {
    whisky: [["region", "지역"], ["distillery", "증류소"], ["bottler", "병입자"], ["peated", "피트"], ["cask_finish", "피니시"]],
    wine: [["grape", "품종"], ["appellation", "아펠라시옹"], ["wine_style", "스타일"], ["sweetness", "당도"], ["body", "바디"]],
    beer: [["brewery", "브루어리"], ["beer_style", "스타일"], ["ibu", "IBU"], ["package", "패키지"]],
    cocktail: [["base_spirit", "베이스"], ["ingredients", "재료"], ["glassware", "글라스"], ["garnish", "가니시"]],
    brandy: [["region", "지역"], ["grade", "등급"], ["grape", "품종"]],
    rum: [["style", "스타일"], ["age", "숙성"], ["raw_material", "원료"]],
    gin: [["style", "스타일"], ["botanicals", "보태니컬"]],
    vodka: [["base", "원료"], ["distillation", "증류/여과"]],
    tequila: [["class", "등급"], ["agave", "아가베"]],
    liqueur: [["flavor", "향/맛"], ["base", "베이스"]],
    other: [["style", "스타일"], ["detail", "상세"]]
  };
  return labels[value ?? ""] ?? labels.other;
}

function detailValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function productTitle(product: MenuProduct) {
  return product.name;
}

function formatMenuPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return (value / 10000).toFixed(1);
}

function formatCleanPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "가격 미정";
  return formatMenuPrice(value);
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
    price: "Price",
    bottle: "Bottle",
    half: "Half",
    glass: "Glass",
    shot: "Shot",
    dram: "Dram",
    stick: "Stick",
    plate: "Plate"
  };
  return labels[value] ?? value;
}

function formatServingMl(value?: number | null) {
  return typeof value === "number" ? `${value}ml` : "-";
}

function servingSortOrder(value: string) {
  const order: Record<string, number> = {
    price: -1,
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

function alcoholTypeLabel(value: string) {
  const labels: Record<string, string> = {
    whisky: "위스키",
    wine: "와인",
    beer: "맥주",
    cocktail: "칵테일",
    brandy: "브랜디",
    rum: "럼",
    gin: "진",
    vodka: "보드카",
    tequila: "데킬라",
    liqueur: "리큐르",
    other: "기타 주류"
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
