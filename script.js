/**
 * ChatSpend – NLP Expense Tracker
 * script.js – Full frontend logic with localStorage fallback
 *
 * Architecture:
 *  - All data lives in localStorage (keys: chatspend_*)
 *  - When BACKEND_URL is set, CRUD calls go to Google Apps Script webhook
 *  - Dialogflow bot responses are also reflected here via postMessage / custom event
 */

/* ============================================================
   CONFIGURATION
   ============================================================ */

/**
 * SETUP: After deploying your Google Apps Script as a Web App,
 * paste the URL below. Leave empty to use localStorage-only mode.
 */
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbwhMKobiZwivpKejvM_b528lv7mNeUqfdaT7UEjG5S_S5bQSS5hQvLF0ameuc2U3BxT/exec'; // e.g. 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'

/* ============================================================
   CONSTANTS & DEFAULTS
   ============================================================ */

const DEFAULT_CATEGORIES = [
  {
    name: 'Food',
    icon: '🍕',
    keywords: [
      // Common
      'food', 'pizza', 'burger', 'coffee', 'tea', 'chai', 'lunch', 'dinner', 'breakfast', 'snack',
      'restaurant', 'cafe', 'meal', 'bread', 'pepsi', 'cola', 'juice', 'water', 'milk',
      'egg', 'chicken', 'fish', 'mutton', 'beef', 'pork', 'biryani', 'curry', 'dal',
      'roti', 'naan', 'dosa', 'idli', 'samosa', 'chaat', 'vada', 'pav', 'sandwich',
      'pasta', 'noodle', 'maggi', 'soup', 'cake', 'cookie', 'chocolate',
      'swiggy', 'zomato', 'dominos', 'kfc', 'mcdonalds', 'subway', 'starbucks',
      'biscuit', 'chips', 'popcorn', 'soda', 'lassi', 'buttermilk', 'paneer', 'tofu',
      // Indian sweets & desserts
      'kulfi', 'ice cream', 'icecream', 'gelato', 'sorbet',
      'jalebi', 'gulab jamun', 'rasgulla', 'kheer', 'halwa', 'mithai', 'sweet', 'sweets',
      'burfi', 'barfi', 'ladoo', 'laddoo', 'peda', 'rabri', 'shrikhand', 'payasam',
      'modak', 'karanji', 'chakli', 'murukku', 'namkeen', 'mathri',
      'rasmalai', 'kalakand', 'sandesh', 'mishti', 'chikki', 'gajak', 'revri',
      'dhokla', 'khandvi', 'thepla', 'paratha', 'upma', 'poha', 'sevpuri',
      'faluda', 'sharbat', 'nimbu pani', 'cold coffee', 'milkshake', 'smoothie',
    ],
  },
  {
    name: 'Groceries',
    icon: '🛒',
    keywords: [
      'grocery', 'groceries', 'vegetable', 'vegetables', 'fruit', 'fruits',
      'carrot', 'potato', 'onion', 'tomato', 'spinach', 'cabbage', 'cauliflower',
      'broccoli', 'peas', 'beans', 'corn', 'mushroom', 'garlic', 'ginger', 'chilli',
      'lemon', 'lime', 'cucumber', 'pumpkin', 'radish', 'beetroot', 'lettuce',
      'apple', 'banana', 'mango', 'orange', 'grapes', 'strawberry', 'watermelon',
      'papaya', 'pineapple', 'guava', 'pomegranate', 'kiwi', 'peach', 'pear', 'plum',
      'lentil', 'lentils', 'dal', 'pulse', 'pulses', 'rice', 'wheat', 'flour', 'atta',
      'maida', 'semolina', 'suji', 'oats', 'quinoa', 'barley', 'sugar', 'salt', 'oil',
      'ghee', 'butter', 'cheese', 'curd', 'yogurt', 'paneer', 'tofu', 'soya',
      'spice', 'spices', 'masala', 'turmeric', 'cumin', 'coriander', 'pepper',
      'mustard', 'cardamom', 'clove', 'cinnamon', 'saffron', 'basmati', 'poha',
      'supermarket', 'bigbasket', 'blinkit', 'zepto', 'dunzo', 'kirana', 'market',
    ],
  },
  {
    name: 'Toiletries',
    icon: '🧴',
    keywords: [
      'toiletries', 'toiletry', 'shampoo', 'conditioner', 'soap', 'bodywash',
      'facewash', 'face wash', 'moisturizer', 'lotion', 'sunscreen', 'cream',
      'toothbrush', 'toothpaste', 'mouthwash', 'floss', 'razor', 'shaving', 'foam',
      'deodorant', 'perfume', 'cologne', 'aftershave', 'talcum', 'powder',
      'tissue', 'toilet paper', 'sanitary', 'pad', 'tampon', 'napkin', 'cotton',
      'hairbrush', 'comb', 'hairclip', 'hairpin', 'dye', 'henna', 'nail polish',
      'lipstick', 'makeup', 'mascara', 'foundation', 'blush', 'eyeliner',
      'skincare', 'serum', 'toner', 'cleanser', 'scrub', 'exfoliant',
      'dettol', 'savlon', 'bandage', 'antiseptic', 'vaseline', 'petroleum jelly',
    ],
  },
  {
    name: 'Transport',
    icon: '🚌',
    keywords: [
      'transport', 'uber', 'ola', 'auto', 'bus', 'metro', 'train', 'cab', 'taxi',
      'fuel', 'petrol', 'diesel', 'parking', 'ticket', 'fare', 'rapido', 'bike',
      'flight', 'travel', 'rickshaw', 'tram', 'ferry', 'boat', 'ship', 'toll',
      'highway', 'road', 'vehicle', 'car', 'scooter', 'cycle', 'bicycle',
      'irctc', 'makemytrip', 'goibibo', 'redbus', 'blablacar', 'yulu', 'bounce',
    ],
  },
  {
    name: 'Shopping',
    icon: '🛍️',
    keywords: [
      'shopping', 'clothes', 'shirt', 'pants', 'jeans', 'dress', 'kurta', 'saree',
      'shoes', 'sandals', 'sneakers', 'boots', 'socks', 'underwear', 'bra',
      'jacket', 'coat', 'hoodie', 'sweater', 'tshirt', 'shorts', 'skirt',
      'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'tata cliq',
      'mall', 'store', 'shop', 'boutique', 'bazaar', 'exhibition', 'fair',
      'bag', 'purse', 'wallet', 'watch', 'sunglasses', 'jewellery', 'ring',
      'earring', 'necklace', 'bracelet', 'belt', 'hat', 'cap', 'scarf',
      'laptop', 'phone', 'mobile', 'tablet', 'headphone', 'earphone', 'speaker',
      'charger', 'cable', 'power bank', 'keyboard', 'mouse', 'pen drive',
      'furniture', 'curtain', 'cushion', 'bedsheet', 'pillow', 'blanket',
      'gift', 'toy', 'stationery', 'pen', 'notebook', 'diary', 'book',
    ],
  },
  {
    name: 'Entertainment',
    icon: '🎬',
    keywords: [
      'entertainment', 'movie', 'cinema', 'theatre', 'concert', 'show', 'event',
      'netflix', 'spotify', 'amazon prime', 'hotstar', 'youtube', 'disney',
      'gaming', 'game', 'playstation', 'xbox', 'steam', 'pubg', 'minecraft',
      'sports', 'cricket', 'football', 'badminton', 'tennis', 'gym', 'fitness',
      'club', 'pub', 'bar', 'nightout', 'party', 'picnic', 'outing', 'trip',
      'zoo', 'museum', 'park', 'amusement', 'arcade', 'bowling', 'karaoke',
      'bookmyshow', 'paytm insider', 'ticket', 'subscription', 'membership',
    ],
  },
  {
    name: 'Bills',
    icon: '📄',
    keywords: [
      'bill', 'bills', 'electricity', 'water bill', 'internet', 'wifi', 'broadband',
      'phone bill', 'mobile bill', 'postpaid', 'prepaid', 'recharge', 'dth',
      'rent', 'maintenance', 'society', 'housing', 'emi', 'loan', 'mortgage',
      'insurance', 'premium', 'policy', 'tax', 'challan', 'fine', 'penalty',
      'subscription', 'netflix bill', 'spotify bill', 'adobe', 'microsoft',
      'gas', 'cylinder', 'lpg', 'piped gas', 'mahanagar gas',
    ],
  },
  {
    name: 'Healthcare',
    icon: '💊',
    keywords: [
      'health', 'healthcare', 'medicine', 'medicines', 'tablet', 'capsule', 'syrup',
      'doctor', 'physician', 'specialist', 'consultant', 'clinic', 'hospital',
      'pharmacy', 'chemist', 'medplus', 'apollo pharmacy', 'netmeds', '1mg',
      'medical', 'test', 'pathology', 'blood test', 'xray', 'scan', 'mri', 'ct scan',
      'dental', 'dentist', 'teeth', 'eye', 'optical', 'glasses', 'spectacles',
      'vaccine', 'vaccination', 'injection', 'iv', 'drip', 'surgery', 'operation',
      'physiotherapy', 'therapy', 'counselling', 'mental health', 'psychiatrist',
      'gym supplement', 'protein', 'whey', 'vitamins', 'multivitamin', 'omega',
    ],
  },
  {
    name: 'Education',
    icon: '📚',
    keywords: [
      'education', 'school', 'college', 'university', 'tuition', 'coaching',
      'course', 'class', 'lesson', 'lecture', 'workshop', 'seminar', 'training',
      'udemy', 'coursera', 'unacademy', 'byjus', 'vedantu', 'khan academy',
      'books', 'textbook', 'notebook', 'stationery', 'exam', 'fee', 'admission',
      'library', 'lab', 'project', 'assignment', 'certificate', 'degree',
    ],
  },
  {
    name: 'Others',
    icon: '🗂️',
    keywords: [],
  },
];

const CATEGORY_COLORS = [
  '#7c3aed', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
  '#f97316', '#6366f1', '#84cc16', '#a78bfa',
  '#e11d48', '#0891b2',
];

/* ============================================================
   STATE (in-memory, synced to localStorage)
   ============================================================ */
let state = {
  transactions: [],
  customCategories: [],   // { name, keywords, icon }
  budget: {},   // { [monthKey]: amount }
};

// Undo buffer – stores last deleted transaction
let undoBuffer = null;
const recentChatEventSignatures = new Map();
const CHAT_EVENT_DEDUPE_WINDOW_MS = 12000;
const pendingCategorySync = new Set();

/* ============================================================
   STORAGE HELPERS
   ============================================================ */

/** Load all state from localStorage */
function loadState() {
  try {
    state.transactions = JSON.parse(localStorage.getItem('chatspend_transactions') || '[]');
    state.customCategories = JSON.parse(localStorage.getItem('chatspend_categories') || '[]');
    state.budget = JSON.parse(localStorage.getItem('chatspend_budget') || '{}');
  } catch (e) {
    console.error('ChatSpend: Failed to load state', e);
  }
}

/** Persist all state to localStorage */
function saveState() {
  localStorage.setItem('chatspend_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('chatspend_categories', JSON.stringify(state.customCategories));
  localStorage.setItem('chatspend_budget', JSON.stringify(state.budget));
}

/* ============================================================
   DATE UTILITIES
   ============================================================ */

/** Returns 'dd-mm-yyyy' for today */
function todayDDMMYYYY() {
  const d = new Date();
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Returns 'mmm-yyyy' e.g. 'Apr-2026' */
function currentMonthKey() {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]}-${d.getFullYear()}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function normalizeCategoryName(value) {
  return capitalize((value || '').toString().trim());
}

function normalizePaymentMethod(value) {
  const lower = (value || '').toString().trim().toLowerCase();
  if (lower === 'cash') return 'Cash';
  if (lower === 'card' || lower === 'debit' || lower === 'credit') return 'Card';
  return 'UPI';
}

/* ============================================================
   CATEGORY ENGINE
   ============================================================ */

/** Returns all categories (custom first, then defaults) */
function getAllCategories() {
  return [
    ...state.customCategories,
    ...DEFAULT_CATEGORIES,
  ];
}

/**
 * Detect category from an item title/text.
 * Priority: custom categories → default categories → auto-create new category.
 * @param {string} text - item name / description
 * @returns {string} category name (always non-null)
 */
function detectCategory(text) {
  if (!text) return 'Others';
  const lower = text.toLowerCase().trim();

  // 1. Check custom categories (name match OR keyword match)
  for (const cat of state.customCategories) {
    if (lower.includes(cat.name.toLowerCase())) return cat.name;
    if (!cat.keywords) continue;
    const kws = cat.keywords.map(k => k.toLowerCase()).filter(Boolean);
    if (kws.some(kw => lower.includes(kw))) return cat.name;
  }

  // 2. Check default categories
  for (const cat of DEFAULT_CATEGORIES) {
    if (cat.name === 'Others') continue;
    if (lower.includes(cat.name.toLowerCase())) return cat.name;
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.name;
  }

  // 3. No match found — auto-create a new category from the item title
  //    Capitalize the text (use first word if multi-word, else full)
  const newCatName = capitalize(lower.split(' ')[0]); // e.g. "carrots" → "Carrots"
  const alreadyExists = state.customCategories.some(
    c => c.name.toLowerCase() === newCatName.toLowerCase()
  );
  if (!alreadyExists && newCatName.length >= 2) {
    const keywordString = lower;
    state.customCategories.push({
      name: newCatName,
      keywords: [lower],      // add the full phrase as a keyword for future matches
      icon: '🏷️',
      autoCreated: true,      // flag as auto-created
    });
    saveState();
    // Keep backend category sheet aligned with local auto-created categories.
    syncCategoryToBackend(newCatName, keywordString);
  }
  return newCatName;
}

/** Get emoji icon for a category name */
function getCategoryIcon(name) {
  const all = getAllCategories();
  const found = all.find(c => c.name.toLowerCase() === name.toLowerCase());
  return found?.icon || '🏷️';
}

/** Get color for a category (consistent mapping) */
function getCategoryColor(name) {
  const all = getAllCategories();
  const idx = all.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  return CATEGORY_COLORS[((idx >= 0 ? idx : 0)) % CATEGORY_COLORS.length];
}

/* ============================================================
   PAYMENT DETECTION
   ============================================================ */

/** Detect payment method from natural language */
function detectPayment(text) {
  if (!text) return 'UPI';
  const lower = text.toLowerCase();
  if (/\bcash\b/.test(lower)) return 'Cash';
  if (/\bcard\b|\bdebit\b|\bcredit\b/.test(lower)) return 'Card';
  if (/\bupi\b|\bgpay\b|\bpaytm\b|\bphonepe\b/.test(lower)) return 'UPI';
  return 'UPI'; // default
}


/* ============================================================
   TRANSACTION CRUD (localStorage)
   ============================================================ */

/** Generate a unique ID */
function generateId() {
  return 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

/** Add a new transaction */
function addTransaction({ id = null, amount, title, category, payment = 'UPI', date = null, month = null, timestamp = null }) {
  const cat = normalizeCategoryName(category || detectCategory(title));
  const d = date || todayDDMMYYYY();
  const m = month || currentMonthKey();
  const tx = {
    id: id || generateId(),
    amount: parseFloat(amount),
    title: capitalize(title || 'Unnamed'),
    category: cat,
    payment: normalizePaymentMethod(payment),
    date: d,
    month: m,
    timestamp: timestamp || new Date().toISOString(),
  };
  state.transactions.unshift(tx); // newest first
  saveState();
  return tx;
}

function hasEquivalentTransaction(candidate) {
  if (!candidate) return false;

  // Strong dedupe by explicit id (preferred when coming from backend payload).
  if (candidate.id && state.transactions.some(t => t.id === candidate.id)) return true;

  // Fallback dedupe by core fields when id is unavailable.
  const amount = parseFloat(candidate.amount);
  const title = capitalize(candidate.title || 'Unnamed');
  const category = normalizeCategoryName(candidate.category || detectCategory(candidate.title || ''));
  const payment = normalizePaymentMethod(candidate.payment || 'UPI');
  const date = candidate.date || todayDDMMYYYY();
  const month = candidate.month || currentMonthKey();

  return state.transactions.some(t =>
    t.amount === amount &&
    t.title === title &&
    normalizeCategoryName(t.category) === category &&
    normalizePaymentMethod(t.payment) === payment &&
    t.date === date &&
    t.month === month
  );
}

function pruneRecentChatEventSignatures() {
  const now = Date.now();
  for (const [sig, ts] of recentChatEventSignatures.entries()) {
    if (now - ts > CHAT_EVENT_DEDUPE_WINDOW_MS) recentChatEventSignatures.delete(sig);
  }
}

function isDuplicateChatEvent(signature) {
  if (!signature) return false;
  pruneRecentChatEventSignatures();
  if (recentChatEventSignatures.has(signature)) return true;
  recentChatEventSignatures.set(signature, Date.now());
  return false;
}

/** Update a transaction by ID */
function updateTransaction(id, changes) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;
  state.transactions[idx] = { ...state.transactions[idx], ...changes };
  saveState();
  return state.transactions[idx];
}

/** Delete a transaction by ID */
function deleteTransaction(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return false;
  undoBuffer = { ...state.transactions[idx] }; // save for undo
  state.transactions.splice(idx, 1);
  saveState();
  return true;
}

/** Delete the most recent transaction */
function deleteLastTransaction() {
  if (state.transactions.length === 0) return null;
  const last = state.transactions[0];
  deleteTransaction(last.id);
  return last;
}

/** Undo last deletion */
function undoLastDelete() {
  if (!undoBuffer) return false;
  state.transactions.unshift(undoBuffer);
  saveState();
  undoBuffer = null;
  return true;
}

/** Find transactions by title (fuzzy) */
function findTransactionsByTitle(query) {
  const q = query.toLowerCase();
  return state.transactions.filter(t => t.title.toLowerCase().includes(q));
}

/** Get current month's budget */
function getCurrentBudget() {
  return state.budget[currentMonthKey()] || 0;
}

/** Get total spent this month */
function getMonthlySpent() {
  const m = currentMonthKey();
  return state.transactions
    .filter(t => t.month === m)
    .reduce((sum, t) => sum + t.amount, 0);
}

/* ============================================================
   BACKEND BRIDGE
   Tries to sync with Google Apps Script; falls back to localStorage
   ============================================================ */

/**
 * Call Google Apps Script backend with fallback to localStorage.
 * @param {string} action - e.g. 'addExpense', 'deleteExpense'
 * @param {object} payload - data to send
 * @returns {Promise<object>} response or local result
 */
async function callBackend(action, payload = {}, options = {}) {
  const { fallbackToLocal = true } = options;
  if (!BACKEND_URL) {
    // Pure localStorage mode
    return handleLocalAction(action, payload);
  }

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using localStorage:', err.message);
    if (fallbackToLocal) {
      return handleLocalAction(action, payload);
    }
    return { success: false, error: err.message || 'Backend unavailable' };
  }
}

function normalizeTransactionObject(tx) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthRegex = /^[A-Z][a-z]{2}-\d{4}$/;
  const parsedDateFromDate = tx.date ? new Date(tx.date) : null;
  const parsedDateFromTs = tx.timestamp ? new Date(tx.timestamp) : null;
  const bestDate = parsedDateFromDate && !isNaN(parsedDateFromDate.getTime())
    ? parsedDateFromDate
    : (parsedDateFromTs && !isNaN(parsedDateFromTs.getTime()) ? parsedDateFromTs : null);
  const normalizedDate = bestDate
    ? `${pad(bestDate.getDate())}-${pad(bestDate.getMonth() + 1)}-${bestDate.getFullYear()}`
    : (tx.date || todayDDMMYYYY());
  const normalizedMonth = (typeof tx.month === 'string' && monthRegex.test(tx.month))
    ? tx.month
    : (bestDate ? `${months[bestDate.getMonth()]}-${bestDate.getFullYear()}` : currentMonthKey());

  return {
    id: tx.id || generateId(),
    amount: Number(tx.amount || 0),
    title: capitalize(tx.title || 'Unnamed'),
    category: normalizeCategoryName(tx.category || 'Others'),
    payment: normalizePaymentMethod(tx.payment || 'UPI'),
    date: normalizedDate,
    month: normalizedMonth,
    timestamp: tx.timestamp || new Date().toISOString(),
  };
}

function normalizeCategoryObject(c) {
  return {
    name: capitalize((c?.name || '').toString().trim()),
    keywords: Array.isArray(c?.keywords)
      ? c.keywords.map(k => (k || '').toString().trim().toLowerCase()).filter(Boolean)
      : [],
    icon: c?.icon || '🏷️',
  };
}

function mergeCustomCategories(localCategories, backendCategories) {
  const mergedMap = new Map();

  const add = (cat) => {
    const normalized = normalizeCategoryObject(cat);
    if (!normalized.name) return;
    const key = normalized.name.toLowerCase();
    if (!mergedMap.has(key)) {
      mergedMap.set(key, normalized);
      return;
    }
    const existing = mergedMap.get(key);
    const keywordSet = new Set([...(existing.keywords || []), ...(normalized.keywords || [])]);
    existing.keywords = Array.from(keywordSet);
    if ((!existing.icon || existing.icon === '🏷️') && normalized.icon) existing.icon = normalized.icon;
    mergedMap.set(key, existing);
  };

  (backendCategories || []).forEach(add);
  (localCategories || []).forEach(add);

  return Array.from(mergedMap.values());
}

async function syncStateFromBackend() {
  if (!BACKEND_URL) return;
  const localCategoriesBeforeSync = Array.isArray(state.customCategories)
    ? JSON.parse(JSON.stringify(state.customCategories))
    : [];
  const localBudgetBeforeSync = (state.budget && typeof state.budget === 'object')
    ? { ...state.budget }
    : {};
  const res = await callBackend('getState', {}, { fallbackToLocal: false });
  if (!res || !res.success) return;

  if (Array.isArray(res.transactions)) {
    state.transactions = res.transactions.map(normalizeTransactionObject);
    state.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  if (res.budget && typeof res.budget === 'object') {
    state.budget = { ...res.budget };
  }

  let backendCategories = [];
  if (Array.isArray(res.categories)) {
    backendCategories = res.categories.map(normalizeCategoryObject).filter(c => c.name);
  }
  const mergedCategories = mergeCustomCategories(localCategoriesBeforeSync, backendCategories);
  state.customCategories = mergedCategories;

  // Backfill categories missing from backend so existing local custom categories
  // also appear in the Google Sheet.
  const backendNameSet = new Set(backendCategories.map(c => c.name.toLowerCase()));
  mergedCategories.forEach(cat => {
    if (!backendNameSet.has(cat.name.toLowerCase())) {
      syncCategoryToBackend(cat.name, (cat.keywords || []).join(','));
    }
  });

  // Backfill budgets missing from backend (common when budget was set locally first).
  const backendBudgetKeys = new Set(Object.keys(state.budget || {}));
  Object.entries(localBudgetBeforeSync || {}).forEach(([monthKey, amount]) => {
    const amt = parseFloat(amount);
    if (!monthKey || Number.isNaN(amt) || amt <= 0) return;
    if (backendBudgetKeys.has(monthKey)) return;
    callBackend('setbudget', { amount: amt, month: monthKey }, { fallbackToLocal: false }).catch(() => {});
    state.budget[monthKey] = amt;
    backendBudgetKeys.add(monthKey);
  });

  saveState();
}

async function refreshUiFromBackendIfAvailable() {
  if (!BACKEND_URL) return;
  try {
    await syncStateFromBackend();
  } catch (_) {
    // keep current local state if sync fails
  }
}

function syncCategoryToBackend(name, keywords = '') {
  if (!BACKEND_URL || !name) return;
  const key = name.toLowerCase();
  if (pendingCategorySync.has(key)) return;
  pendingCategorySync.add(key);
  callBackend('addCategory', { name, keywords }, { fallbackToLocal: false })
    .catch(() => {})
    .finally(() => pendingCategorySync.delete(key));
}

/** Handle all actions locally (localStorage-only mode) */
function handleLocalAction(action, payload) {
  switch (action) {
    case 'addExpense': {
      const tx = addTransaction(payload);
      return { success: true, transaction: tx };
    }
    case 'updateExpense': {
      const tx = updateTransaction(payload.id, payload.changes);
      return { success: !!tx, transaction: tx };
    }
    case 'deleteExpense': {
      const ok = deleteTransaction(payload.id);
      return { success: ok };
    }
    case 'deleteLast': {
      const tx = deleteLastTransaction();
      return { success: !!tx, transaction: tx };
    }
    case 'undo': {
      const ok = undoLastDelete();
      return { success: ok };
    }
    case 'setbudget': {
      state.budget[currentMonthKey()] = parseFloat(payload.amount);
      saveState();
      return { success: true, budget: payload.amount };
    }
    case 'addCategory': {
      const exists = state.customCategories.some(c => c.name.toLowerCase() === payload.name.toLowerCase());
      if (!exists) {
        const kws = payload.keywords ? payload.keywords.split(',').map(k => k.trim().toLowerCase()) : [];
        state.customCategories.push({ name: capitalize(payload.name), keywords: kws, icon: '🏷️' });
        saveState();
      }
      return { success: true };
    }
    case 'search': {
      const results = findTransactionsByTitle(payload.query);
      return { success: true, transactions: results };
    }
    case 'getAll': {
      return { success: true, transactions: state.transactions };
    }
    default:
      return { success: false, error: 'Unknown action' };
  }
}

/* ============================================================
   UI RENDERING
   ============================================================ */

// Chart instance
let pieChartInstance = null;

/** Render all dashboard elements */
function renderDashboard() {
  const budget = getCurrentBudget();
  const spent = getMonthlySpent();
  const remaining = budget - spent;
  const count = state.transactions.filter(t => t.month === currentMonthKey()).length;
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  // Cards
  document.getElementById('val-budget').textContent = `₹${budget.toLocaleString('en-IN')}`;
  document.getElementById('val-spent').textContent = `₹${spent.toLocaleString('en-IN')}`;
  document.getElementById('val-remaining').textContent = `₹${remaining.toLocaleString('en-IN')}`;
  document.getElementById('val-count').textContent = count;

  // Remaining color
  const remEl = document.getElementById('val-remaining');
  remEl.className = 'card-value ' + (remaining < 0 ? 'text-red' : remaining < budget * 0.2 ? 'text-yellow' : 'text-green');

  // Progress bar
  const fill = document.getElementById('budget-bar-fill');
  fill.style.width = pct + '%';
  fill.className = 'budget-bar-fill' + (spent > budget && budget > 0 ? ' over' : '');
  document.getElementById('progress-label-right').textContent = pct.toFixed(0) + '%';

  // Overspend alert
  const alert = document.getElementById('overspend-alert');
  if (spent > budget && budget > 0) {
    alert.classList.remove('hidden');
  } else {
    alert.classList.add('hidden');
  }

  // Pie Chart
  renderPieChart();

  // Recent list
  renderRecentList();

  // Populate category dropdowns
  populateCategoryDropdowns();
}

/** Build the pie chart using Chart.js */
function renderPieChart() {
  const monthTx = state.transactions.filter(t => t.month === currentMonthKey());
  const chartEmpty = document.getElementById('chart-empty');
  const canvas = document.getElementById('pieChart');

  if (monthTx.length === 0) {
    chartEmpty.style.display = 'flex';
    canvas.style.display = 'none';
    document.getElementById('chart-legend').innerHTML = '';
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    return;
  }

  chartEmpty.style.display = 'none';
  canvas.style.display = 'block';

  // Aggregate by category
  const agg = {};
  monthTx.forEach(tx => {
    agg[tx.category] = (agg[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(agg);
  const data = Object.values(agg);
  const colors = labels.map(l => getCategoryColor(l));

  if (pieChartInstance) pieChartInstance.destroy();

  pieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ₹${ctx.raw.toLocaleString('en-IN')} (${((ctx.raw / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });

  // Custom legend
  const legendEl = document.getElementById('chart-legend');
  legendEl.innerHTML = labels.map((l, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span>${l} – ₹${agg[l].toLocaleString('en-IN')}</span>
    </div>
  `).join('');
}

/** Render the last 5 transactions in the dashboard */
function renderRecentList() {
  const list = document.getElementById('recent-list');
  const recent = state.transactions.slice(0, 5);

  if (recent.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span>💬</span>
        <p>No transactions yet. Try typing<br/><em>"spent 50 on coffee"</em> in the chat!</p>
      </div>`;
    return;
  }

  list.innerHTML = recent.map(tx => `
    <div class="recent-item">
      <div class="recent-cat-dot" style="background:${getCategoryColor(tx.category)}"></div>
      <div class="recent-info">
        <div class="recent-title">${escHtml(tx.title)}</div>
        <div class="recent-meta">${tx.category} · ${tx.payment} · ${tx.date}</div>
      </div>
      <div class="recent-amount">₹${tx.amount.toLocaleString('en-IN')}</div>
    </div>
  `).join('');
}

/** Populate category dropdowns in forms */
function populateCategoryDropdowns() {
  const cats = getAllCategories().map(c => c.name);
  const selects = ['qa-category', 'edit-category', 'filter-category'];

  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    
    // Some dropdowns don't have a default first option in HTML
    let firstOpt = el.options[0];
    if (!firstOpt && id === 'edit-category') {
      firstOpt = document.createElement('option');
      firstOpt.value = '';
      firstOpt.textContent = 'Auto-detect';
    }

    el.innerHTML = '';
    if (firstOpt) el.appendChild(firstOpt);

    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${getCategoryIcon(cat)} ${cat}`;
      el.appendChild(opt);
    });
    if (current) el.value = current;
  });
}

/* ──────────────────────────────────────────
   Transactions Table
   ────────────────────────────────────────── */
let filteredTransactions = [];

/** Render the full transactions table with active filters */
function renderTransactionsTable() {
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const catFilt = document.getElementById('filter-category')?.value || '';
  const payFilt = document.getElementById('filter-payment')?.value || '';

  filteredTransactions = state.transactions.filter(tx => {
    const matchTitle = tx.title.toLowerCase().includes(search);
    const matchCat = !catFilt || tx.category === catFilt;
    const matchPay = !payFilt || tx.payment === payFilt;
    return matchTitle && matchCat && matchPay;
  });

  const tbody = document.getElementById('transactions-tbody');
  const emptyEl = document.getElementById('table-empty');
  const tableEl = document.getElementById('transactions-table');

  if (filteredTransactions.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    tableEl.style.display = 'none';
    return;
  }

  emptyEl.classList.add('hidden');
  tableEl.style.display = '';

  tbody.innerHTML = filteredTransactions.map((tx, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td><strong>${escHtml(tx.title)}</strong></td>
      <td class="text-green">₹${tx.amount.toLocaleString('en-IN')}</td>
      <td><span class="badge badge-cat">${getCategoryIcon(tx.category)} ${escHtml(tx.category)}</span></td>
      <td><span class="badge ${getPayBadgeClass(tx.payment)}">${escHtml(tx.payment)}</span></td>
      <td style="color:var(--text-secondary)">${tx.date}</td>
      <td class="action-btns">
        <button class="btn-edit" onclick="openEditModal('${tx.id}')">✏️ Edit</button>
        <button class="btn-del"  onclick="openDeleteModal('${tx.id}')">🗑️ Del</button>
      </td>
    </tr>
  `).join('');
}

function getPayBadgeClass(pay) {
  return pay === 'Cash' ? 'badge-cash' : pay === 'Card' ? 'badge-card' : 'badge-pay';
}

/** Filter handler */
function filterTransactions() {
  renderTransactionsTable();
}

/* ──────────────────────────────────────────
   Categories Section
   ────────────────────────────────────────── */

function renderCategoriesGrid() {
  const grid = document.getElementById('categories-grid');
  const all = getAllCategories();

  grid.innerHTML = all.map((cat, i) => {
    const isCustom = i < state.customCategories.length;
    const kwDisplay = (cat.keywords?.length)
      ? cat.keywords.slice(0, 6).join(', ') + (cat.keywords.length > 6 ? '...' : '')
      : 'No keywords';
    const isAuto = cat.autoCreated ? ' 🤖' : '';
    return `
      <div class="category-chip ${isCustom ? 'chip-custom' : 'chip-default'}">
        <span class="chip-badge">${isCustom ? 'Custom' + isAuto : 'Default'}</span>
        <div class="chip-icon" style="font-size:1.5rem">${cat.icon}</div>
        <div class="chip-name">${escHtml(cat.name)}</div>
        <div class="chip-keywords">${kwDisplay}</div>
        ${isCustom ? `
          <div class="chip-actions">
            <button class="chip-edit"  onclick="openEditCategoryModal('${escHtml(cat.name)}')">✏️ Edit</button>
            <button class="chip-delete" onclick="deleteCategory('${escHtml(cat.name)}')">🗑️ Delete</button>
          </div>` : ''}
      </div>
    `;
  }).join('');
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */

function showTab(tab) {
  // Deactivate all
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  // Activate target
  document.getElementById('section-' + tab)?.classList.add('active');
  document.getElementById('tab-' + tab)?.classList.add('active');

  // Refresh data for the tab
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'transactions') { renderTransactionsTable(); populateFilterDropdowns(); }
  if (tab === 'categories') renderCategoriesGrid();
}

/* ============================================================
   MODALS
   ============================================================ */

function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

/** Budget Modal */
function openBudgetModal() {
  document.getElementById('budget-input').value = getCurrentBudget() || '';
  openModal('modal-budget');
}

async function saveBudget() {
  const amt = parseFloat(document.getElementById('budget-input').value);
  if (isNaN(amt) || amt < 1) { showToast('Please enter a valid budget amount'); return; }
  const monthKey = currentMonthKey();
  const prev = state.budget[monthKey];

  // Update local state first (immediate UI), then sync backend if configured
  state.budget[monthKey] = amt;
  saveState();
  let backendFailed = false;
  if (BACKEND_URL) {
    try {
      const res = await callBackend('setbudget', { amount: amt, month: monthKey }, { fallbackToLocal: false });
      if (!res || !res.success) backendFailed = true;
    } catch (_) {
      backendFailed = true;
    }
  }
  if (backendFailed) {
    if (prev === undefined) delete state.budget[monthKey];
    else state.budget[monthKey] = prev;
    saveState();
    renderDashboard();
    showToast('⚠️ Budget update failed on backend. Restored previous value.');
    return;
  }
  await refreshUiFromBackendIfAvailable();

  closeModal('modal-budget');
  renderDashboard();
  showToast(`✅ Budget set to ₹${amt.toLocaleString('en-IN')} for ${monthKey}`);
}

/** Edit Transaction Modal */
function openEditModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('edit-id').value = id;
  document.getElementById('edit-amount').value = tx.amount;
  document.getElementById('edit-title').value = tx.title;
  document.getElementById('edit-payment').value = tx.payment;

  // Rebuild the edit-category select directly (synchronous, no setTimeout)
  const catSel = document.getElementById('edit-category');
  catSel.innerHTML = '';
  getAllCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = `${cat.icon} ${cat.name}`;
    if (cat.name === tx.category) opt.selected = true;
    catSel.appendChild(opt);
  });

  openModal('modal-edit');
}

async function saveEditTransaction() {
  const id = document.getElementById('edit-id').value;
  const amount = parseFloat(document.getElementById('edit-amount').value);
  const title = document.getElementById('edit-title').value.trim();
  const category = document.getElementById('edit-category').value;
  const payment = document.getElementById('edit-payment').value;

  if (!title || isNaN(amount) || amount < 1) { showToast('Please fill all fields correctly'); return; }

  const changes = { amount, title: capitalize(title), category, payment };
  const idx = state.transactions.findIndex(t => t.id === id);
  const prevTx = idx >= 0 ? { ...state.transactions[idx] } : null;

  // Update local state first (immediate UI)
  updateTransaction(id, changes);
  // Sync to backend if configured
  let backendFailed = false;
  if (BACKEND_URL) {
    try {
      const res = await callBackend('updateExpense', { id, changes }, { fallbackToLocal: false });
      if (!res || !res.success) backendFailed = true;
    } catch (_) {
      backendFailed = true;
    }
  }
  if (backendFailed) {
    if (idx >= 0 && prevTx) {
      state.transactions[idx] = prevTx;
      saveState();
    }
    renderDashboard();
    renderTransactionsTable();
    showToast('⚠️ Update failed on backend. Restored previous transaction.');
    return;
  }
  await refreshUiFromBackendIfAvailable();

  closeModal('modal-edit');
  renderDashboard();
  renderTransactionsTable();
  showToast('✅ Transaction updated!');
}

/** Delete Confirmation Modal */
let pendingDeleteId = null;

function openDeleteModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  pendingDeleteId = id;
  document.getElementById('delete-confirm-message').textContent =
    `Delete "${tx.title}" (₹${tx.amount})? This cannot be undone (unless you undo immediately).`;
  openModal('modal-delete');
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  pendingDeleteId = null;

  // Delete from local state first (immediate UI update)
  const txBeforeDelete = state.transactions.find(t => t.id === id);
  deleteTransaction(id);
  let backendDeleteFailed = false;

  // Sync to backend if configured; rollback local if backend failed.
  if (BACKEND_URL) {
    try {
      const res = await callBackend('deleteExpense', { id }, { fallbackToLocal: false });
      if (!res || !res.success) backendDeleteFailed = true;
    } catch (e) {
      backendDeleteFailed = true;
    }
  }

  if (backendDeleteFailed) {
    if (txBeforeDelete) {
      state.transactions.unshift(txBeforeDelete);
      saveState();
    }
    closeModal('modal-delete');
    renderDashboard();
    renderTransactionsTable();
    showToast('⚠️ Delete failed on backend. Transaction restored locally.');
    return;
  }

  closeModal('modal-delete');
  renderDashboard();
  renderTransactionsTable();
  showToast('🗑️ Transaction deleted. Type "undo last" in chat to restore.');
}

/** Add Category Modal */
function openAddCategoryModal() {
  document.getElementById('new-cat-name').value = '';
  document.getElementById('new-cat-keywords').value = '';
  openModal('modal-category');
}

async function saveCategory() {
  const name = document.getElementById('new-cat-name').value.trim();
  const kws = document.getElementById('new-cat-keywords').value.trim();

  if (!name) { showToast('Category name is required'); return; }

  // Update local state first
  const exists = state.customCategories.some(c => c.name.toLowerCase() === name.toLowerCase());
  const categoryName = capitalize(name);
  if (!exists) {
    const kwArr = kws ? kws.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [];
    state.customCategories.push({ name: categoryName, keywords: kwArr, icon: '🏷️' });
    saveState();
  }
  // Sync to backend if configured
  let backendFailed = false;
  if (BACKEND_URL) {
    try {
      const res = await callBackend('addCategory', { name, keywords: kws }, { fallbackToLocal: false });
      if (!res || !res.success) backendFailed = true;
    } catch (_) {
      backendFailed = true;
    }
  }
  if (backendFailed) {
    state.customCategories = state.customCategories.filter(c => c.name.toLowerCase() !== categoryName.toLowerCase());
    saveState();
    renderCategoriesGrid();
    populateCategoryDropdowns();
    showToast('⚠️ Category add failed on backend. Local change reverted.');
    return;
  }
  await refreshUiFromBackendIfAvailable();

  closeModal('modal-category');
  renderCategoriesGrid();
  populateCategoryDropdowns();
  showToast(`✅ Category "${capitalize(name)}" added!`);
}

async function deleteCategory(name) {
  const idx = state.customCategories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return;
  const prevCategories = JSON.parse(JSON.stringify(state.customCategories));
  const prevTransactions = JSON.parse(JSON.stringify(state.transactions));

  // Reassign transactions that used this category
  let moved = 0;
  state.transactions.forEach(tx => {
    if (tx.category.toLowerCase() === name.toLowerCase()) {
      // Try to re-detect a better category from the title (excluding the deleted one)
      const reCat = detectCategoryExcluding(tx.title, name);
      tx.category = reCat;
      moved++;
    }
  });

  state.customCategories.splice(idx, 1);
  saveState();
  let backendFailed = false;
  if (BACKEND_URL) {
    try {
      const res = await callBackend('deleteCategory', { name }, { fallbackToLocal: false });
      if (!res || !res.success) backendFailed = true;
    } catch (_) {
      backendFailed = true;
    }
  }
  if (backendFailed) {
    state.customCategories = prevCategories;
    state.transactions = prevTransactions;
    saveState();
    renderCategoriesGrid();
    populateCategoryDropdowns();
    renderDashboard();
    renderTransactionsTable();
    showToast('⚠️ Category delete failed on backend. Local changes reverted.');
    return;
  }
  await refreshUiFromBackendIfAvailable();
  renderCategoriesGrid();
  populateCategoryDropdowns();
  renderDashboard();
  renderTransactionsTable();
  const msg = moved
    ? `🗑️ "${name}" removed. ${moved} transaction(s) recategorised.`
    : `🗑️ Category "${name}" removed.`;
  showToast(msg);
}

/**
 * Like detectCategory but skips one category name (used after deletion).
 * Falls back to 'Others' instead of auto-creating.
 */
function detectCategoryExcluding(text, excludeName) {
  if (!text) return 'Others';
  const lower = text.toLowerCase().trim();

  for (const cat of state.customCategories) {
    if (cat.name.toLowerCase() === excludeName.toLowerCase()) continue;
    if (lower.includes(cat.name.toLowerCase())) return cat.name;
    const kws = (cat.keywords || []).map(k => k.toLowerCase()).filter(Boolean);
    if (kws.some(kw => lower.includes(kw))) return cat.name;
  }
  for (const cat of DEFAULT_CATEGORIES) {
    if (cat.name === 'Others') continue;
    if (lower.includes(cat.name.toLowerCase())) return cat.name;
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.name;
  }
  return 'Others';
}

/* Edit Category */
let editingCategoryOriginalName = null;

function openEditCategoryModal(name) {
  const cat = state.customCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) return;
  editingCategoryOriginalName = name;
  document.getElementById('edit-cat-name').value = cat.name;
  document.getElementById('edit-cat-keywords').value = (cat.keywords || []).join(', ');
  openModal('modal-edit-category');
}

async function saveEditCategory() {
  const newName = document.getElementById('edit-cat-name').value.trim();
  const newKws = document.getElementById('edit-cat-keywords').value.trim();
  if (!newName) { showToast('Category name required'); return; }

  const idx = state.customCategories.findIndex(
    c => c.name.toLowerCase() === editingCategoryOriginalName.toLowerCase()
  );
  if (idx === -1) return;

  const kwArr = newKws ? newKws.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [];
  const prevCategories = JSON.parse(JSON.stringify(state.customCategories));
  const prevTransactions = JSON.parse(JSON.stringify(state.transactions));

  // Update category
  const oldName = state.customCategories[idx].name;
  state.customCategories[idx] = {
    ...state.customCategories[idx],
    name: capitalize(newName),
    keywords: kwArr,
  };

  // Rename transactions that used the old category name
  state.transactions.forEach(tx => {
    if (tx.category.toLowerCase() === oldName.toLowerCase()) {
      tx.category = capitalize(newName);
    }
  });

  saveState();
  let backendFailed = false;
  if (BACKEND_URL) {
    try {
      const res = await callBackend(
        'updateCategory',
        { oldName, newName: capitalize(newName), keywords: newKws },
        { fallbackToLocal: false }
      );
      if (!res || !res.success) backendFailed = true;
    } catch (_) {
      backendFailed = true;
    }
  }
  if (backendFailed) {
    state.customCategories = prevCategories;
    state.transactions = prevTransactions;
    saveState();
    renderCategoriesGrid();
    populateCategoryDropdowns();
    renderDashboard();
    renderTransactionsTable();
    showToast('⚠️ Category update failed on backend. Local changes reverted.');
    return;
  }
  await refreshUiFromBackendIfAvailable();
  closeModal('modal-edit-category');
  renderCategoriesGrid();
  populateCategoryDropdowns();
  renderDashboard();
  renderTransactionsTable();
  showToast(`✅ Category renamed to "${capitalize(newName)}"`);
}

/* ============================================================
   QUICK ADD FORM (Manual entry / fallback)
   ============================================================ */

async function handleQuickAdd(e) {
  e.preventDefault();

  const amount = parseFloat(document.getElementById('qa-amount').value);
  const title = document.getElementById('qa-title').value.trim();
  const category = document.getElementById('qa-category').value || detectCategory(title);
  const payment = document.getElementById('qa-payment').value;

  if (isNaN(amount) || amount < 1 || !title) { showToast('Please fill in amount and title'); return; }

  const payload = { amount, title, category, payment };

  // Add to local state ONCE (fixes double-add bug)
  const tx = addTransaction(payload);
  // Sync to backend if configured. Roll back local if backend fails.
  let backendFailed = false;
  let backendId = null;
  if (BACKEND_URL) {
    try {
      const res = await callBackend('addExpense', payload, { fallbackToLocal: false });
      if (!res || !res.success) {
        backendFailed = true;
      } else if (res.id) {
        backendId = res.id;
      }
    } catch (_) {
      backendFailed = true;
    }
  }
  if (backendFailed) {
    deleteTransaction(tx.id);
    renderDashboard();
    showToast('⚠️ Add failed on backend. Transaction was not saved.');
    return;
  }
  if (backendId) {
    const added = state.transactions.find(t => t.id === tx.id);
    if (added) {
      added.id = backendId;
      saveState();
    }
  }
  await refreshUiFromBackendIfAvailable();

  // Show confirmation
  const lastAdded = document.getElementById('last-added');
  document.getElementById('last-added-text').textContent =
    `Added ₹${tx.amount} for ${tx.title} (${tx.category} via ${tx.payment})`;
  lastAdded.classList.remove('hidden');

  // Reset form
  document.getElementById('quick-add-form').reset();

  // Refresh UI
  renderDashboard();
  showToast(`✅ ₹${tx.amount} for ${tx.title} added!`);

  // Auto-hide last-added after 4s
  setTimeout(() => lastAdded.classList.add('hidden'), 4000);
}

/* ============================================================
   EXPORT CSV
   ============================================================ */

function exportCSV() {
  if (state.transactions.length === 0) { showToast('No transactions to export'); return; }

  const headers = ['ID', 'Title', 'Amount', 'Category', 'Payment Method', 'Date', 'Month', 'Timestamp'];
  const rows = state.transactions.map(tx => [
    tx.id, tx.title, tx.amount, tx.category, tx.payment, tx.date, tx.month, tx.timestamp
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chatspend_${currentMonthKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV exported!');
}

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */
let toastTimeout = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3500);
}

/* ============================================================
   THEME TOGGLE
   ============================================================ */

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isDark = !document.body.classList.contains('light-theme');
  document.getElementById('btn-dark-toggle').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('chatspend_theme', isDark ? 'dark' : 'light');
}

function applyTheme() {
  const saved = localStorage.getItem('chatspend_theme') || 'dark';
  if (saved === 'light') {
    document.body.classList.add('light-theme');
    document.getElementById('btn-dark-toggle').textContent = '☀️';
  }
}

/* ============================================================
   DIALOGFLOW MESSENGER INTEGRATION
   Listen to messages sent by the bot and sync state
   ============================================================ */

/**
 * The Dialogflow Messenger widget fires a 'df-response-received' event
 * each time the bot responds. We parse the fulfillment metadata
 * (embedded as JSON in a custom payload) to update our local state.
 *
 * If the bot returns a custom payload with { action, data },
 * we mirror that locally so the dashboard stays in sync.
 */
function readDialogflowStructValue(node) {
  if (!node || typeof node !== 'object') return node;
  if (Object.prototype.hasOwnProperty.call(node, 'stringValue')) return node.stringValue;
  if (Object.prototype.hasOwnProperty.call(node, 'numberValue')) return Number(node.numberValue);
  if (Object.prototype.hasOwnProperty.call(node, 'boolValue')) return Boolean(node.boolValue);
  if (Object.prototype.hasOwnProperty.call(node, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(node, 'listValue')) {
    const values = Array.isArray(node.listValue?.values) ? node.listValue.values : [];
    return values.map(readDialogflowStructValue);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'structValue')) {
    return readDialogflowStructValue(node.structValue);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'fields')) {
    const out = {};
    Object.entries(node.fields).forEach(([k, v]) => {
      out[k] = readDialogflowStructValue(v);
    });
    return out;
  }
  return node;
}

function normalizeDialogflowPayload(payload) {
  if (!payload) return null;
  const normalized = readDialogflowStructValue(payload);
  return (normalized && typeof normalized === 'object') ? normalized : null;
}

function extractQueryResultFromEvent(event) {
  // Dialogflow Messenger versions expose response data under different paths.
  return (
    event?.detail?.raw?.queryResult ||
    event?.detail?.response?.queryResult ||
    event?.detail?.queryResult ||
    null
  );
}

function extractBotTextFromQueryResult(queryResult) {
  if (!queryResult) return '';
  if (typeof queryResult.fulfillmentText === 'string' && queryResult.fulfillmentText.trim()) {
    return queryResult.fulfillmentText.trim();
  }
  const msgs = Array.isArray(queryResult.fulfillmentMessages) ? queryResult.fulfillmentMessages : [];
  for (const m of msgs) {
    const txt = m?.text?.text;
    if (Array.isArray(txt) && txt[0]) return String(txt[0]).trim();
  }
  return '';
}

function parseExpenseFromBotText(botText) {
  if (!botText) return null;
  const cleaned = botText.replace(/\n/g, ' ').trim();

  // Examples handled:
  // "Saved ₹20 for pepsi"
  // "Added ₹250 for Pizza (Food via Cash)"
  // "✅ Added ₹50 for uber"
  const match = cleaned.match(/(?:saved|added|logged)[^\d₹]*₹?\s*([0-9]+(?:\.[0-9]+)?)\s+(?:for|on)\s+([a-zA-Z0-9][a-zA-Z0-9\s&'._-]*)/i);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Stop title before common trailing fragments.
  let title = match[2]
    .replace(/\s*\(.*$/, '')
    .replace(/\s*(via|using|by)\s+(cash|card|upi)\b.*$/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
  if (!title) return null;

  // Optional date phrase in bot text/title, e.g. "groceries on 18/04/2026"
  const dateMatch = (cleaned + ' ' + title).match(/\bon\s+(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/i);
  let parsedDate = null;
  let parsedMonth = null;
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const mon = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, mon - 1, day);
    if (!isNaN(d.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      parsedDate = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      parsedMonth = `${months[d.getMonth()]}-${d.getFullYear()}`;
    }
    title = title.replace(/\bon\s+\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/i, '').trim();
    title = title.replace(/\bon\s+\d{1,2}\b$/i, '').trim();
  }

  const payMatch = cleaned.match(/\b(cash|card|upi)\b/i);
  const payment = payMatch ? capitalize(payMatch[1].toLowerCase()) : 'UPI';
  const category = detectCategory(title);

  return {
    amount,
    title,
    category,
    payment,
    date: parsedDate || null,
    month: parsedMonth || null,
  };
}

document.addEventListener('df-response-received', async (event) => {
  try {
    const response = extractQueryResultFromEvent(event);
    if (!response) return;

    // Extract custom payload if present (plain object or Struct-wrapped payload)
    const rawPayload = response.fulfillmentMessages?.find(m => m.payload)?.payload || null;
    const customPayload = normalizeDialogflowPayload(rawPayload);
    const botText = extractBotTextFromQueryResult(response);

    // Messenger may fire equivalent response events more than once.
    // Deduplicate events by stable signature in a short time window.
    const payloadSignature = customPayload
      ? JSON.stringify({ action: customPayload.action || '', data: customPayload.data || null })
      : '';
    const textSignature = botText ? `text:${botText.toLowerCase().trim()}` : '';
    const signature = payloadSignature || textSignature;
    if (isDuplicateChatEvent(signature)) return;

    if (customPayload) {
      const { action, data } = customPayload;

      if (action === 'expenseAdded' && data) {
        if (hasEquivalentTransaction(data)) return;
        addTransaction({
          id: data.id || null,
          amount: data.amount,
          title: data.title,
          category: data.category,
          payment: data.payment,
          date: data.date,
          month: data.month,
          timestamp: data.timestamp || null,
        });
        renderDashboard();
        showToast(`✅ ₹${data.amount} for ${data.title} logged via chat!`);
      }

      if (action === 'budgetSet' && data) {
        state.budget[currentMonthKey()] = parseFloat(data.amount);
        saveState();
        renderDashboard();
        showToast(`🎯 Budget set to ₹${data.amount}`);
      }

      if (action === 'categoryAdded' && data) {
        const exists = state.customCategories.some(c => c.name.toLowerCase() === data.name.toLowerCase());
        if (!exists) {
          state.customCategories.push({ name: capitalize(data.name), keywords: [], icon: '🏷️' });
          saveState();
          renderCategoriesGrid();
          showToast(`🏷️ Category "${data.name}" added!`);
        }
      }

      if (action === 'expenseDeleted' && data) {
        if (data.id) deleteTransaction(data.id);
        else deleteLastTransaction();
        renderDashboard();
        renderTransactionsTable();
        showToast('🗑️ Transaction deleted via chat!');
      }
    }

    // Fallback path: some Dialogflow responses contain only plain text (no custom payload).
    // If bot confirms a save/add action, sync the expense locally from response text.
    if (!customPayload) {
      const parsed = parseExpenseFromBotText(botText);
      if (parsed && !hasEquivalentTransaction(parsed)) {
        const tx = addTransaction(parsed);
        renderDashboard();
        renderTransactionsTable();
        showToast(`✅ ₹${tx.amount} for ${tx.title} logged via chat!`);
      }
    }
  } catch (err) {
    console.warn('df-response-received parse error:', err);
  }
});

/* ============================================================
   FILTER DROPDOWNS (Transactions tab)
   Shows only categories/payments actually used in transactions
   ============================================================ */

function populateFilterDropdowns() {
  // Category filter — only categories used in recorded transactions
  const usedCats = [...new Set(state.transactions.map(t => t.category))].sort();
  const catFilter = document.getElementById('filter-category');
  if (catFilter) {
    const prevCat = catFilter.value;
    catFilter.innerHTML = '<option value="">All Categories</option>';
    usedCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${getCategoryIcon(cat)} ${cat}`;
      catFilter.appendChild(opt);
    });
    if (prevCat) catFilter.value = prevCat;
  }

  // Payment filter — only payment methods used in recorded transactions
  const usedPays = [...new Set(state.transactions.map(t => t.payment))].sort();
  const payFilter = document.getElementById('filter-payment');
  if (payFilter) {
    const prevPay = payFilter.value;
    payFilter.innerHTML = '<option value="">All Payments</option>';
    usedPays.forEach(pay => {
      const opt = document.createElement('option');
      opt.value = pay;
      opt.textContent = pay;
      payFilter.appendChild(opt);
    });
    if (prevPay) payFilter.value = prevPay;
  }
}

/* ============================================================
   STRING UTILITIES
   ============================================================ */

/** Capitalize first letter of each word */
function capitalize(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   THEME TOGGLE
   ============================================================ */

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isDark = !document.body.classList.contains('light-theme');
  document.getElementById('btn-dark-toggle').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('chatspend_theme', isDark ? 'dark' : 'light');
}

function applyTheme() {
  const saved = localStorage.getItem('chatspend_theme') || 'dark';
  if (saved === 'light') {
    document.body.classList.add('light-theme');
    const btn = document.getElementById('btn-dark-toggle');
    if (btn) btn.textContent = '☀️';
  }
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

async function init() {
  // Load data from localStorage
  loadState();

  // Apply saved theme
  applyTheme();

  // Sync from backend if available so dashboard and chatbot summary match.
  try {
    await syncStateFromBackend();
  } catch (e) {
    console.warn('Initial backend sync skipped:', e?.message || e);
  }

  // Render initial view
  renderDashboard();
  populateCategoryDropdowns();

  console.log(
    '%c💬 ChatSpend ready!',
    'color:#7c3aed;font-size:16px;font-weight:bold;',
    BACKEND_URL
      ? 'Backend connected: ' + BACKEND_URL
      : 'Running in localStorage-only mode. Set BACKEND_URL in script.js to connect to Google Apps Script.'
  );
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
