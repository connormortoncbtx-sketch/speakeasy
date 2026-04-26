/* eslint-disable */
/* The Bar — single-file React app, JSX compiled in-browser by Babel.
   Loads cocktails.json (run fetch_cocktails.py first), custom-cocktails.json,
   and substitutions.json. Inventory + user-added recipes in localStorage. */

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ===== CONFIG =====

const STORAGE_INVENTORY = 'bar.inventory.v1';
const STORAGE_CUSTOM = 'bar.custom.v1';

const STARTER_PACK = [
  'Vodka', 'Gin', 'Light Rum', 'Tequila', 'Bourbon',
  'Cointreau', 'Triple Sec', 'Sweet Vermouth', 'Dry Vermouth',
  'Simple Syrup', 'Lemon Juice', 'Lime Juice',
  'Angostura Bitters', 'Club Soda', 'Tonic Water',
];

const CATEGORY_META = {
  spirits:   { label: 'Spirits',                order: 1 },
  liqueurs:  { label: 'Liqueurs & Modifiers',   order: 2 },
  wine_beer: { label: 'Wine, Beer & Sparkling', order: 3 },
  mixers:    { label: 'Mixers & Juices',        order: 4 },
  bitters:   { label: 'Bitters',                order: 5 },
  fresh:     { label: 'Fresh & Herbs',          order: 6 },
  pantry:    { label: 'Pantry',                 order: 7 },
  other:     { label: 'Other',                  order: 8 },
};

const DRINK_CATEGORIES = [
  'Cocktail', 'Ordinary Drink', 'Shot', 'Punch / Party Drink',
  'Coffee / Tea', 'Cocoa', 'Beer', 'Soft Drink', 'Other / Unknown',
];

const GLASS_OPTIONS = [
  'Cocktail glass', 'Old-fashioned glass', 'Highball glass', 'Collins glass',
  'Coupe', 'Martini Glass', 'Champagne flute', 'Wine glass', 'Margarita glass',
  'Hurricane glass', 'Mug', 'Copper Mug', 'Shot glass', 'Pint glass',
  'Nick and Nora', 'Other',
];

// ===== HELPERS =====

const titleCase = (s) =>
  s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());

const normalizeIngName = (s) => {
  if (!s) return '';
  return titleCase(s.trim().replace(/\s+/g, ' '));
};

function categorizeIngredient(name) {
  const n = name.toLowerCase();
  if (/bitters/.test(n)) return 'bitters';
  if (/\b(rum|vodka|gin|whisky|whiskey|tequila|bourbon|scotch|brandy|cognac|rye|mezcal|cachaca|aquavit|pisco|grappa|sake|soju)\b/.test(n)) return 'spirits';
  if (/\b(wine|champagne|prosecco|sherry|port|beer|ale|cider|moscato)\b/.test(n)) return 'wine_beer';
  if (/\b(liqueur|vermouth|schnapps|cointreau|campari|aperol|amaretto|kahlua|chartreuse|absinthe|lillet|st-germain|elderflower|sambuca|ouzo|grand marnier|drambuie|frangelico|benedictine|maraschino|curacao|amaro|fernet|cynar|baileys|midori|jagermeister|chambord|tia maria|galliano|advocaat|kummel|anisette|pernod|ricard|cassis|crème|creme de|sloe gin|southern comfort|peach schnapps)\b/.test(n)) return 'liqueurs';
  if (/\b(juice|soda|tonic|cola|ginger beer|ginger ale|syrup|sprite|7up|fanta|red bull|grenadine|orgeat|falernum|lemonade|root beer)\b/.test(n)) return 'mixers';
  if (/\b(milk|cream|tea|coffee|espresso|water|club soda|sparkling water)\b/.test(n)) return 'mixers';
  if (/\b(lemon|lime|orange|cherry|olive|mint|berry|fruit|apple|peach|raspberry|strawberry|grape|pineapple|coconut|banana|kiwi|melon|cucumber|jalapeno|basil|rosemary|sage|cilantro|cranberry|grapefruit|pomegranate|passion fruit|mango|papaya|guava|lychee|fig|pear|plum|apricot|tomato)\b/.test(n)) return 'fresh';
  if (/\b(sugar|salt|honey|egg|spice|pepper|cinnamon|nutmeg|clove|vanilla|chocolate|cocoa|nutella|jam|preserve|ice cream|whipped cream)\b/.test(n)) return 'pantry';
  return 'other';
}

function canonicalizeCocktail(c, brandMap) {
  const ingredients = c.ingredients.map((i) => {
    const norm = normalizeIngName(i.name);
    const generic = brandMap[norm] || brandMap[i.name];
    return { ...i, name: generic || norm };
  });
  return { ...c, ingredients };
}

function ingredientStatus(needName, inventory, subs) {
  if (inventory.has(needName)) return { status: 'have' };
  const alts = subs[needName] || [];
  for (const alt of alts) {
    if (inventory.has(alt)) return { status: 'sub', via: alt };
  }
  return { status: 'miss' };
}

function classifyCocktail(c, inventory, subs) {
  const breakdown = c.ingredients.map((i) => ({
    ...i,
    ...ingredientStatus(i.name, inventory, subs),
  }));
  const missing = breakdown.filter((b) => b.status === 'miss');
  const subbed = breakdown.filter((b) => b.status === 'sub');
  return { breakdown, missing, subbed };
}

const ls = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};

async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// ===== ICONS =====

function Icon({ size = 16, stroke = 1.5, className = '', children }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
const IPlus    = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>;
const IX       = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>;
const ISearch  = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>;
const ISparkle = (p) => <Icon {...p}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></Icon>;
const ICheck   = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></Icon>;
const ICircle  = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/></Icon>;
const ITrash   = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6M14 11v6"/></Icon>;
const IShuffle = (p) => <Icon {...p}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></Icon>;
const IRefresh = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></Icon>;
const ILibrary = (p) => <Icon {...p}><path d="M16 6l4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></Icon>;
const IHome    = (p) => <Icon {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>;
const IAlert   = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Icon>;
const IMartini = (p) => <Icon {...p}><path d="M3 4h18l-9 11z"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></Icon>;
const IWine    = (p) => <Icon {...p}><path d="M8 22h8"/><path d="M12 16v6"/><path d="M5 2h14v8a7 7 0 11-14 0z"/></Icon>;
const IGlass   = (p) => <Icon {...p}><path d="M5 3l1 18h12l1-18z"/><path d="M5 7h14"/></Icon>;
const IEdit    = (p) => <Icon {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z"/></Icon>;
const ICopy    = (p) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></Icon>;

// ===== UI COMPONENTS =====

function Ornament({ className = '' }) {
  return (
    <div className={`ornament ${className}`}>
      <span className="ornament__line"/><span className="ornament__diamond"/><span className="ornament__line"/>
    </div>
  );
}

function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="fullscreen"><div className="fullscreen__inner">
      <div className="fullscreen__icon is-pulse"><IMartini size={48} stroke={1}/></div>
      <h1 className="fullscreen__title">THE BAR</h1>
      <p className="fullscreen__text">{message}</p>
    </div></div>
  );
}

function ErrorScreen({ title, message, onRetry }) {
  return (
    <div className="fullscreen"><div className="fullscreen__inner">
      <div className="fullscreen__icon fullscreen__icon--err"><IAlert size={48} stroke={1}/></div>
      <h1 className="fullscreen__title">{title}</h1>
      <p className="fullscreen__text">{message}</p>
      {onRetry && <button className="btn btn--primary" onClick={onRetry}><IRefresh size={14}/> Try Again</button>}
    </div></div>
  );
}

function FirstRunScreen() {
  return (
    <div className="fullscreen"><div className="fullscreen__inner">
      <div className="fullscreen__icon"><IMartini size={48} stroke={1}/></div>
      <h1 className="fullscreen__title">EMPTY CATALOG</h1>
      <p className="fullscreen__text">
        Run <code style={{background:'var(--surface-2)',padding:'0.15rem 0.4rem',color:'var(--accent)'}}>python3 fetch_cocktails.py</code> to populate cocktails.json, then commit and refresh.
      </p>
      <p className="fullscreen__text" style={{fontSize:'0.75rem'}}>Or add featured drinks via the in-app form.</p>
    </div></div>
  );
}

function Header({ totalCocktails, onShuffle, onAddRecipe }) {
  return (
    <header className="header">
      <Ornament/>
      <h1 className="header__title">THE BAR</h1>
      <p className="header__sub">{totalCocktails} cocktails in the catalog</p>
      <div className="header__actions">
        <button className="btn btn--ghost" onClick={onShuffle}><IShuffle size={12}/> Surprise Me</button>
        <button className="btn btn--ghost" onClick={onAddRecipe}><IPlus size={12}/> Add Recipe</button>
      </div>
    </header>
  );
}

function ViewToggle({ view, onChange, makeableCount }) {
  return (
    <div className="view-toggle"><div className="view-toggle__inner">
      <button className={`view-toggle__btn ${view === 'home' ? 'is-active' : ''}`} onClick={() => onChange('home')}>
        <IHome size={12}/> My Bar {makeableCount > 0 && `(${makeableCount})`}
      </button>
      <button className={`view-toggle__btn ${view === 'library' ? 'is-active' : ''}`} onClick={() => onChange('library')}>
        <ILibrary size={12}/> Catalog
      </button>
    </div></div>
  );
}

function InventoryStrip({ inventory, onRemove, onOpenAdd }) {
  const items = useMemo(() => [...inventory].sort(), [inventory]);
  const showLimit = 16;
  const shown = items.slice(0, showLimit);
  const more = items.length - showLimit;
  return (
    <section className="section">
      <div className="inv-head">
        <h2 className="section-label">Your Shelf</h2>
        <button className="btn btn--quiet btn--small" onClick={onOpenAdd}>
          <IPlus size={12}/> {items.length === 0 ? 'Stock' : 'Edit'}
        </button>
      </div>
      {items.length === 0 ? (
        <button className="inv-empty" onClick={onOpenAdd}>
          <IPlus size={20} stroke={1.25} className="inv-empty__icon"/><span>Stock your shelf</span>
        </button>
      ) : (
        <div className="chips">
          {shown.map((id) => (
            <button key={id} className="chip" onClick={() => onRemove(id)}>
              {id}<IX size={12} className="chip__x"/>
            </button>
          ))}
          {more > 0 && <button className="chip chip--more" onClick={onOpenAdd}>+{more} more</button>}
        </div>
      )}
    </section>
  );
}

function CocktailCard({ cocktail, onClick, missing, subbed }) {
  const dim = !!missing && missing.length > 0;
  const hasImage = cocktail.image && cocktail.image.startsWith('http');
  return (
    <button onClick={onClick} className={`card ${dim ? 'card--dim' : ''}`}>
      <div className="card__image-wrap">
        {hasImage ? (
          <img className="card__image" src={cocktail.image + '/preview'} alt={cocktail.name} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}/>
        ) : (
          <div className="card__image-fallback"><IGlass size={48} stroke={1}/></div>
        )}
        <div className="card__image-overlay"/>
        {cocktail.alcoholic === 'Non alcoholic' && <span className="card__badge card__badge--no-abv">No ABV</span>}
        {cocktail.iba && <span className="card__badge card__badge--iba">IBA</span>}
        {cocktail.custom && <span className="card__badge card__badge--custom">★</span>}
        {!dim && subbed && subbed.length > 0 && <span className="card__badge card__badge--sub">SUB</span>}
      </div>
      <div className="card__body">
        <h3 className="card__title">{cocktail.name}</h3>
        {missing && missing.length > 0
          ? <p className="card__meta card__meta--need">Need: {missing.map((m) => m.name).join(', ')}</p>
          : <p className="card__meta card__meta--cat">{cocktail.category}</p>}
      </div>
    </button>
  );
}

function MakeableSection({ cocktails, onSelect }) {
  if (cocktails.length === 0) return null;
  return (
    <section className="section">
      <div className="sec-header">
        <ISparkle size={16}/>
        <h2 className="section-label">Tonight's Menu</h2>
        <div className="sec-header__rule"/>
        <span className="sec-header__count">{cocktails.length}</span>
      </div>
      <div className="grid">
        {cocktails.map((c) => (
          <CocktailCard key={c.id} cocktail={c} onClick={() => onSelect(c)} subbed={c._subbed}/>
        ))}
      </div>
    </section>
  );
}

function AlmostThereSection({ cocktails, onSelect }) {
  if (cocktails.length === 0) return null;
  return (
    <section className="section">
      <div className="sec-header">
        <IWine size={16}/>
        <h2 className="section-label section-label--quiet">One or Two Bottles Away</h2>
        <div className="sec-header__rule sec-header__rule--quiet"/>
        <span className="sec-header__count">{cocktails.length}</span>
      </div>
      <div className="grid">
        {cocktails.slice(0, 24).map((c) => (
          <CocktailCard key={c.id} cocktail={c} onClick={() => onSelect(c)} missing={c._missing}/>
        ))}
      </div>
    </section>
  );
}

function FirstTimeEmpty({ onOpenAdd, onShuffle }) {
  return (
    <section className="section"><div className="empty">
      <div className="empty__icon"><IMartini size={40} stroke={1}/></div>
      <h3 className="empty__title">BEGIN</h3>
      <p className="empty__text">Tell us what's on your shelf, and we'll show you what to pour.</p>
      <div className="empty__actions">
        <button className="btn btn--primary" onClick={onOpenAdd}>Stock Shelf</button>
        <button className="btn btn--ghost" onClick={onShuffle}><IShuffle size={12}/> Random</button>
      </div>
    </div></section>
  );
}

function NoMatchesEmpty({ onOpenAdd }) {
  return (
    <section className="section"><div className="empty empty--quiet">
      <div className="empty__icon"><IGlass size={32} stroke={1}/></div>
      <p className="empty__text" style={{margin:'0 0 1rem',fontStyle:'italic'}}>Nothing matches your shelf yet.</p>
      <button className="btn btn--quiet" onClick={onOpenAdd}><IPlus size={14}/> Add more ingredients</button>
    </div></section>
  );
}

// ----- LIBRARY VIEW -----

function LibraryView({
  cocktails, inventory, subs,
  search, onSearch, categoryFilter, onCategoryFilter,
  alcoholicFilter, onAlcoholicFilter, ownedOnly, onOwnedOnly,
  categories, onSelect,
}) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 48;

  useEffect(() => { setPage(1); }, [search, categoryFilter, alcoholicFilter, ownedOnly]);

  const filtered = useMemo(() => {
    let list = cocktails;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.ingredients.some((i) => i.name.toLowerCase().includes(q))
      );
    }
    if (categoryFilter !== 'all') list = list.filter((c) => c.category === categoryFilter);
    if (alcoholicFilter === 'alcoholic') list = list.filter((c) => c.alcoholic === 'Alcoholic');
    else if (alcoholicFilter === 'non') list = list.filter((c) => c.alcoholic !== 'Alcoholic');
    if (ownedOnly) {
      list = list.filter((c) => classifyCocktail(c, inventory, subs).missing.length === 0);
    }
    return list;
  }, [cocktails, search, categoryFilter, alcoholicFilter, ownedOnly, inventory, subs]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  return (
    <section className="section">
      <div className="filters">
        <div className="search">
          <ISearch size={16} className="search__icon"/>
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search cocktails or ingredients..."/>
        </div>
        <div className="filter-row">
          <select value={categoryFilter} onChange={(e) => onCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={alcoholicFilter} onChange={(e) => onAlcoholicFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="alcoholic">Alcoholic</option>
            <option value="non">Non-alcoholic</option>
          </select>
          <button className={`filter-toggle ${ownedOnly ? 'is-active' : ''}`} onClick={() => onOwnedOnly(!ownedOnly)}>Can Make</button>
          <span className="filter-count">{filtered.length} {filtered.length === 1 ? 'cocktail' : 'cocktails'}</span>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="empty empty--quiet" style={{margin:'2rem 0'}}>
          <p className="empty__text" style={{margin:0,fontStyle:'italic'}}>Nothing matches those filters.</p>
        </div>
      ) : (
        <>
          <div className="grid">
            {visible.map((c) => {
              const { missing, subbed } = classifyCocktail(c, inventory, subs);
              return (
                <CocktailCard key={c.id} cocktail={c} onClick={() => onSelect(c)}
                  missing={missing.length > 0 ? missing : null}
                  subbed={subbed.length > 0 ? subbed : null}/>
              );
            })}
          </div>
          {visible.length < filtered.length && (
            <div className="load-more-wrap">
              <button className="btn btn--ghost" onClick={() => setPage((p) => p + 1)}>
                Load More ({filtered.length - visible.length} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ----- ADD INGREDIENT MODAL -----

function AddIngredientModal({ inventory, onToggle, onClose, onClearAll, onApplyStarter, onAddCustom, ingredientList }) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [customInput, setCustomInput] = useState('');

  const handleAddCustom = () => {
    const name = customInput.trim();
    if (!name) return;
    onAddCustom(name);
    setCustomInput('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredientList
      .filter((ing) => !q || ing.name.toLowerCase().includes(q))
      .filter((ing) => activeCat === 'all' || ing.category === activeCat);
  }, [ingredientList, search, activeCat]);

  const grouped = useMemo(() => {
    const result = {};
    for (const ing of filtered) (result[ing.category] = result[ing.category] || []).push(ing);
    return result;
  }, [filtered]);

  const sortedCats = useMemo(() =>
    Object.keys(grouped).sort((a, b) => (CATEGORY_META[a]?.order || 99) - (CATEGORY_META[b]?.order || 99)),
    [grouped]);

  const catChips = ['all', ...Object.keys(CATEGORY_META)];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2 className="modal__title">EDIT SHELF</h2>
            <p className="modal__sub">{inventory.size} selected · {ingredientList.length} available</p>
          </div>
          <button className="modal__close" onClick={onClose}><IX size={20}/></button>
        </div>
        <div style={{padding:'0.75rem 1.25rem',borderBottom:'1px solid var(--border)',display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
          <button className="btn btn--ghost btn--small" onClick={onApplyStarter}>
            <ISparkle size={12}/> Starter Pack
          </button>
          <div style={{flex:'1 1 14rem',display:'flex',gap:'0.25rem',minWidth:'12rem'}}>
            <input
              type="text"
              placeholder="Add custom ingredient..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
              style={{flex:1,padding:'0.4rem 0.6rem',background:'var(--surface-2)',border:'1px solid var(--border)',color:'var(--ink)',fontSize:'0.75rem'}}
            />
            <button
              className="btn btn--ghost btn--small"
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              style={{padding:'0.4rem 0.6rem'}}
              aria-label="Add custom ingredient"
            ><IPlus size={12}/></button>
          </div>
        </div>
        <div style={{padding:'0.75rem 1.25rem',borderBottom:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          <div className="search">
            <ISearch size={16} className="search__icon"/>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients..."/>
          </div>
          <div className="cat-chips">
            {catChips.map((c) => {
              const label = c === 'all' ? 'All' : CATEGORY_META[c]?.label || c;
              return (
                <button key={c} className={`cat-chip ${activeCat === c ? 'is-active' : ''}`} onClick={() => setActiveCat(c)}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="modal__body" style={{padding:'1rem 1.25rem'}}>
          {sortedCats.length === 0 ? (
            <p style={{textAlign:'center',padding:'2rem',color:'var(--ink-faint)',fontStyle:'italic'}}>No matches.</p>
          ) : (
            sortedCats.map((cat) => (
              <div key={cat} className="cat-block">
                <h3 className="cat-block__head">
                  {CATEGORY_META[cat]?.label || cat}
                  <span className="cat-block__count">{grouped[cat].length}</span>
                </h3>
                <div className="ing-grid">
                  {grouped[cat].map((ing) => {
                    const has = inventory.has(ing.name);
                    return (
                      <button key={ing.name} className={`ing-row ${has ? 'is-on' : ''}`} onClick={() => onToggle(ing.name)}>
                        {has
                          ? <ICheck size={16} className="ing-row__check"/>
                          : <ICircle size={16} className="ing-row__check ing-row__check--off"/>}
                        <span className="ing-row__name">{ing.name}</span>
                        <span className="ing-row__count">{ing.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--quiet btn--danger" onClick={onClearAll} disabled={inventory.size === 0}>
            <ITrash size={14}/> Clear all
          </button>
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ----- RECIPE MODAL -----

function RecipeModal({ cocktail, inventory, subs, onClose, onEdit, onDelete }) {
  const { breakdown } = useMemo(() => classifyCocktail(cocktail, inventory, subs), [cocktail, inventory, subs]);
  const steps = useMemo(() => {
    if (!cocktail.instructions) return [];
    const raw = cocktail.instructions.split(/(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
    return raw.length > 0 ? raw : [cocktail.instructions];
  }, [cocktail.instructions]);
  const hasImage = cocktail.image && cocktail.image.startsWith('http');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--lg" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close modal__close--floating" onClick={onClose}><IX size={20}/></button>
        <div className="modal__body">
          {hasImage && (
            <div className="recipe-hero">
              <img src={cocktail.image} alt={cocktail.name}/>
              <div className="recipe-hero__fade"/>
            </div>
          )}
          <div className="recipe-title-block">
            <Ornament/>
            <h2 className="recipe-title">{cocktail.name}</h2>
            <div className="recipe-tags">
              {cocktail.glass && <span className="recipe-tag recipe-tag--accent">{cocktail.glass}</span>}
              <span className="recipe-tag">{cocktail.category}</span>
              {cocktail.alcoholic && <span className="recipe-tag">{cocktail.alcoholic}</span>}
              {cocktail.iba && <span className="recipe-tag">IBA · {cocktail.iba}</span>}
              {cocktail.custom && <span className="recipe-tag recipe-tag--accent">★ Custom</span>}
            </div>
            {cocktail.tags && cocktail.tags.length > 0 && (
              <div className="recipe-tags" style={{marginTop:'0.5rem'}}>
                {cocktail.tags.slice(0, 5).map((t) => (
                  <span key={t} style={{fontSize:'0.625rem',fontStyle:'italic',color:'var(--ink-mute-2)'}}>#{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="recipe-section">
            <h3 className="recipe-section__head">Build</h3>
            <ul className="build-list">
              {breakdown.map((b, i) => (
                <li key={i} className={`build-row ${b.status === 'have' ? 'is-have' : b.status === 'sub' ? 'is-sub' : ''}`}>
                  <span className="build-row__measure">{b.measure || '—'}</span>
                  <span className="build-row__name">
                    {b.name}
                    {b.status === 'sub' && <span className="build-row__sub-note"> · using {b.via}</span>}
                  </span>
                  {(b.status === 'have' || b.status === 'sub') && <ICheck size={14} className="build-row__check"/>}
                </li>
              ))}
            </ul>
          </div>
          <div className="recipe-divider"/>
          <div className="recipe-section">
            <h3 className="recipe-section__head">Method</h3>
            <ol className="method-list">
              {steps.map((step, i) => (
                <li key={i} className="method-row">
                  <span className="method-row__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="method-row__text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {cocktail.custom && cocktail.source === 'local' && (
            <div className="recipe-section" style={{borderTop:'1px solid var(--border)',display:'flex',gap:'0.5rem'}}>
              <button className="btn btn--ghost btn--small" onClick={() => onEdit(cocktail)}>
                <IEdit size={12}/> Edit
              </button>
              <button className="btn btn--quiet btn--small btn--danger" onClick={() => onDelete(cocktail)}>
                <ITrash size={12}/> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- CUSTOM RECIPE FORM -----

function IngredientInputRow({ ingredient, ingredientNames, onChange, onRemove }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);

  const suggestions = useMemo(() => {
    const q = ingredient.name.toLowerCase().trim();
    if (!q) return [];
    return ingredientNames
      .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .slice(0, 8);
  }, [ingredient.name, ingredientNames]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="ing-input-row">
      <input className="form-input" placeholder="2 oz" value={ingredient.measure}
        onChange={(e) => onChange({ measure: e.target.value })}/>
      <div ref={wrapRef} style={{position:'relative'}}>
        <input className="form-input" placeholder="Bourbon" value={ingredient.name}
          onChange={(e) => { onChange({ name: e.target.value }); setShowSuggest(true); setActiveIdx(0); }}
          onFocus={() => setShowSuggest(true)}
          onKeyDown={(e) => {
            if (!suggestions.length || !showSuggest) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' && suggestions[activeIdx]) {
              e.preventDefault();
              onChange({ name: suggestions[activeIdx] });
              setShowSuggest(false);
            } else if (e.key === 'Escape') setShowSuggest(false);
          }}/>
        {showSuggest && suggestions.length > 0 && (
          <div className="suggest-list">
            {suggestions.map((s, i) => (
              <button key={s} className={`suggest-item ${i === activeIdx ? 'is-selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); onChange({ name: s }); setShowSuggest(false); }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {onRemove
        ? <button className="ing-input-row__remove" onClick={onRemove} aria-label="Remove"><IX size={14}/></button>
        : <div/>}
    </div>
  );
}

function CustomRecipeForm({ existing, ingredientNames, onSave, onClose, onShowToast }) {
  const isEdit = !!existing;
  const [form, setForm] = useState(() => existing ? {
    ...existing,
    ingredients: existing.ingredients.length ? existing.ingredients : [{ name: '', measure: '' }],
    tags: (existing.tags || []).join(', '),
  } : {
    id: '', name: '', category: 'Cocktail', alcoholic: 'Alcoholic',
    glass: 'Cocktail glass', instructions: '', image: '', iba: '', tags: '',
    ingredients: [{ name: '', measure: '' }],
  });

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setIng = (idx, patch) => setForm((f) => ({
    ...f, ingredients: f.ingredients.map((i, j) => j === idx ? { ...i, ...patch } : i),
  }));
  const addIng = () => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: '', measure: '' }] }));
  const removeIng = (idx) => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, j) => j !== idx) }));

  const buildPayload = () => ({
    id: isEdit ? existing.id : `custom-${Date.now()}`,
    name: form.name.trim(),
    category: form.category,
    alcoholic: form.alcoholic,
    glass: form.glass,
    instructions: form.instructions.trim(),
    image: form.image.trim(),
    iba: form.iba.trim(),
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    ingredients: form.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: normalizeIngName(i.name), measure: i.measure.trim() })),
    custom: true,
    source: 'local',
  });

  const validate = (p) => {
    if (!p.name) return 'Name is required.';
    if (p.ingredients.length === 0) return 'Add at least one ingredient.';
    if (!p.instructions) return 'Add some method instructions.';
    return null;
  };

  const handleSave = () => {
    const payload = buildPayload();
    const err = validate(payload);
    if (err) { alert(err); return; }
    onSave(payload);
    onClose();
  };

  const handleExport = async () => {
    const payload = buildPayload();
    const err = validate(payload);
    if (err) { alert(err); return; }
    const clean = { ...payload, source: 'custom-file' };
    const json = JSON.stringify(clean, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      onShowToast('Copied JSON to clipboard');
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${payload.id}.json`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2 className="modal__title">{isEdit ? 'EDIT RECIPE' : 'NEW RECIPE'}</h2>
            <p className="modal__sub">Saved to your device</p>
          </div>
          <button className="modal__close" onClick={onClose}><IX size={20}/></button>
        </div>
        <div className="modal__body" style={{padding:'1.25rem'}}>
          <div className="form-field">
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Big Tex's Smoked Old Fashioned"/>
          </div>
          <div className="form-row-cols-2">
            <div className="form-field">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={(e) => update({ category: e.target.value })}>
                {DRINK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Alcoholic</label>
              <select className="form-select" value={form.alcoholic} onChange={(e) => update({ alcoholic: e.target.value })}>
                <option value="Alcoholic">Alcoholic</option>
                <option value="Non alcoholic">Non alcoholic</option>
                <option value="Optional alcohol">Optional alcohol</option>
              </select>
            </div>
          </div>
          <div className="form-row-cols-2">
            <div className="form-field">
              <label className="form-label">Glass</label>
              <select className="form-select" value={form.glass} onChange={(e) => update({ glass: e.target.value })}>
                {GLASS_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">IBA Class</label>
              <input className="form-input" value={form.iba}
                onChange={(e) => update({ iba: e.target.value })} placeholder="(optional)"/>
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Image URL</label>
            <input className="form-input" value={form.image}
              onChange={(e) => update({ image: e.target.value })} placeholder="https://..."/>
          </div>
          <div className="form-field">
            <label className="form-label">Ingredients ({form.ingredients.length})</label>
            {form.ingredients.map((ing, idx) => (
              <IngredientInputRow key={idx} ingredient={ing} ingredientNames={ingredientNames}
                onChange={(patch) => setIng(idx, patch)}
                onRemove={form.ingredients.length > 1 ? () => removeIng(idx) : null}/>
            ))}
            <button className="btn btn--ghost btn--small" onClick={addIng}><IPlus size={12}/> Add ingredient</button>
          </div>
          <div className="form-field">
            <label className="form-label">Method *</label>
            <textarea className="form-textarea" value={form.instructions}
              onChange={(e) => update({ instructions: e.target.value })}
              placeholder="Combine in a mixing glass with ice. Stir for 30 seconds. Strain into a chilled coupe..."/>
          </div>
          <div className="form-field">
            <label className="form-label">Tags (comma-separated)</label>
            <input className="form-input" value={form.tags}
              onChange={(e) => update({ tags: e.target.value })}
              placeholder="stirred, smoky, after-dinner"/>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--quiet btn--small" onClick={handleExport}>
            <ICopy size={14}/> Export JSON
          </button>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSave}>{isEdit ? 'Update' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

// ===== ROOT =====

function App() {
  const [catalog, setCatalog] = useState([]);
  const [substitutions, setSubstitutions] = useState({});
  const [brandMap, setBrandMap] = useState({});
  const [loadState, setLoadState] = useState('loading');
  const [loadErr, setLoadErr] = useState('');

  const [inventory, setInventory] = useState(() => new Set(ls.get(STORAGE_INVENTORY, [])));
  const [customLocal, setCustomLocal] = useState(() => ls.get(STORAGE_CUSTOM, []));

  const [view, setView] = useState('home');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [alcoholicFilter, setAlcoholicFilter] = useState('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => { ls.set(STORAGE_INVENTORY, [...inventory]); }, [inventory]);
  useEffect(() => { ls.set(STORAGE_CUSTOM, customLocal); }, [customLocal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [main, customFile, subs] = await Promise.all([
          fetchJSON('./cocktails.json').catch(() => ({ cocktails: [] })),
          fetchJSON('./custom-cocktails.json').catch(() => ({ cocktails: [] })),
          fetchJSON('./substitutions.json').catch(() => ({ brandToGeneric: {}, substitutions: {} })),
        ]);
        if (cancelled) return;

        const brand = subs.brandToGeneric || {};
        const subRules = subs.substitutions || {};
        // strip _comment keys if present
        delete brand._comment; delete subRules._comment;

        const combined = [
          ...(main.cocktails || []).map((c) => ({ ...c, custom: false, source: 'main' })),
          ...(customFile.cocktails || []).map((c) => ({ ...c, custom: true, source: 'custom-file' })),
        ].map((c) => canonicalizeCocktail(c, brand));

        setCatalog(combined);
        setBrandMap(brand);
        setSubstitutions(subRules);
        setLoadState(combined.length === 0 ? 'empty' : 'ok');
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e.message || String(e));
          setLoadState('err');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const allCocktails = useMemo(() => {
    const localOnes = customLocal.map((c) => canonicalizeCocktail(c, brandMap));
    return [...catalog, ...localOnes].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, customLocal, brandMap]);

  const toggle = useCallback((name) => {
    setInventory((prev) => {
      const next = new Set(prev);
      const canonical = brandMap[name] || name;
      if (next.has(canonical)) next.delete(canonical);
      else next.add(canonical);
      return next;
    });
  }, [brandMap]);

  const addToInventory = useCallback((rawName) => {
    const norm = normalizeIngName(rawName);
    if (!norm) return;
    const canonical = brandMap[norm] || norm;
    setInventory((prev) => {
      if (prev.has(canonical)) {
        showToast(`'${canonical}' already on shelf`);
        return prev;
      }
      const next = new Set(prev);
      next.add(canonical);
      showToast(`Added ${canonical}`);
      return next;
    });
  }, [brandMap, showToast]);

  const clearAll = useCallback(() => setInventory(new Set()), []);

  const ingredientList = useMemo(() => {
    const idx = new Map();
    for (const c of allCocktails) {
      for (const i of c.ingredients) {
        const existing = idx.get(i.name);
        if (existing) existing.count++;
        else idx.set(i.name, { name: i.name, count: 1, category: categorizeIngredient(i.name) });
      }
    }
    for (const inv of inventory) {
      if (!idx.has(inv)) idx.set(inv, { name: inv, count: 0, category: categorizeIngredient(inv) });
    }
    return [...idx.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [allCocktails, inventory]);

  const ingredientNames = useMemo(() => ingredientList.map((i) => i.name), [ingredientList]);

  const categories = useMemo(() => {
    const s = new Set();
    for (const c of allCocktails) if (c.category) s.add(c.category);
    return [...s].sort();
  }, [allCocktails]);

  const { makeable, almostThere } = useMemo(() => {
    const make = [];
    const almost = [];
    if (inventory.size === 0) return { makeable: make, almostThere: almost };
    for (const c of allCocktails) {
      if (c.ingredients.length === 0) continue;
      const { missing, subbed } = classifyCocktail(c, inventory, substitutions);
      if (missing.length === 0) make.push({ ...c, _subbed: subbed });
      else if (missing.length <= 2 && c.ingredients.length - missing.length >= 1) {
        almost.push({ ...c, _missing: missing });
      }
    }
    make.sort((a, b) => a.name.localeCompare(b.name));
    almost.sort((a, b) => a._missing.length - b._missing.length || a.name.localeCompare(b.name));
    return { makeable: make, almostThere: almost };
  }, [allCocktails, inventory, substitutions]);

  const applyStarterPack = useCallback(() => {
    setInventory((prev) => {
      const next = new Set(prev);
      for (const name of STARTER_PACK) {
        const canon = brandMap[name] || name;
        next.add(canon);
      }
      return next;
    });
  }, [brandMap]);

  const handleShuffle = useCallback(() => {
    const pool = makeable.length > 0 ? makeable : allCocktails;
    if (pool.length === 0) return;
    setSelected(pool[Math.floor(Math.random() * pool.length)]);
  }, [makeable, allCocktails]);

  const handleSaveRecipe = useCallback((recipe) => {
    setCustomLocal((prev) => {
      const idx = prev.findIndex((c) => c.id === recipe.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = recipe; return next; }
      return [...prev, recipe];
    });
    showToast(editingRecipe ? 'Recipe updated' : 'Recipe saved');
    setEditingRecipe(null);
  }, [editingRecipe, showToast]);

  const handleDeleteRecipe = useCallback((recipe) => {
    if (!confirm(`Delete "${recipe.name}"?`)) return;
    setCustomLocal((prev) => prev.filter((c) => c.id !== recipe.id));
    setSelected(null);
    showToast('Recipe deleted');
  }, [showToast]);

  const handleEditRecipe = useCallback((recipe) => {
    setSelected(null);
    setEditingRecipe(recipe);
    setShowRecipeForm(true);
  }, []);

  if (loadState === 'loading') return <LoadingScreen message="Reading the catalog..."/>;
  if (loadState === 'err') return (
    <ErrorScreen title="LOAD FAILED" message={`Couldn't read catalog data: ${loadErr}`}
      onRetry={() => window.location.reload()}/>
  );
  if (loadState === 'empty' && customLocal.length === 0) return <FirstRunScreen/>;

  return (
    <>
      <div className="app">
        <Header totalCocktails={allCocktails.length} onShuffle={handleShuffle}
          onAddRecipe={() => { setEditingRecipe(null); setShowRecipeForm(true); }}/>
        <ViewToggle view={view} onChange={setView} makeableCount={makeable.length}/>

        {view === 'home' && (
          <>
            <InventoryStrip inventory={inventory} onRemove={toggle} onOpenAdd={() => setShowAdd(true)}/>
            {inventory.size === 0 ? (
              <FirstTimeEmpty onOpenAdd={() => setShowAdd(true)} onShuffle={handleShuffle}/>
            ) : (
              <>
                <MakeableSection cocktails={makeable} onSelect={setSelected}/>
                {makeable.length === 0 && <NoMatchesEmpty onOpenAdd={() => setShowAdd(true)}/>}
                <AlmostThereSection cocktails={almostThere} onSelect={setSelected}/>
              </>
            )}
          </>
        )}

        {view === 'library' && (
          <LibraryView cocktails={allCocktails} inventory={inventory} subs={substitutions}
            search={search} onSearch={setSearch}
            categoryFilter={categoryFilter} onCategoryFilter={setCategoryFilter}
            alcoholicFilter={alcoholicFilter} onAlcoholicFilter={setAlcoholicFilter}
            ownedOnly={ownedOnly} onOwnedOnly={setOwnedOnly}
            categories={categories} onSelect={setSelected}/>
        )}

        <div className="footer">
          <Ornament/>
          <span className="footer__label">Catalog · TheCocktailDB + Custom</span>
        </div>
      </div>

      {showAdd && (
        <AddIngredientModal inventory={inventory} onToggle={toggle} onClose={() => setShowAdd(false)}
          onClearAll={clearAll} onApplyStarter={applyStarterPack} onAddCustom={addToInventory} ingredientList={ingredientList}/>
      )}
      {selected && (
        <RecipeModal cocktail={selected} inventory={inventory} subs={substitutions}
          onClose={() => setSelected(null)} onEdit={handleEditRecipe} onDelete={handleDeleteRecipe}/>
      )}
      {showRecipeForm && (
        <CustomRecipeForm existing={editingRecipe} ingredientNames={ingredientNames}
          onSave={handleSaveRecipe}
          onClose={() => { setShowRecipeForm(false); setEditingRecipe(null); }}
          onShowToast={showToast}/>
      )}
      <Toast message={toast}/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
