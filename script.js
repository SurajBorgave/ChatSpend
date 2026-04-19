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
    state.customCategories.push({
      name: newCatName,
      keywords: [lower],      // add the full phrase as a keyword for future matches
      icon: '🏷️',
      autoCreated: true,      // flag as auto-created
    });
    saveState();
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
function addTransaction({ amount, title, category, payment = 'UPI', date = null, month = null }) {
  const cat = category || detectCategory(title);
  const d = date || todayDDMMYYYY();
  const m = month || currentMonthKey();
  const tx = {
    id: generateId(),
    amount: parseFloat(amount),
    title: capitalize(title || 'Unnamed'),
    category: cat,
    payment: payment || 'UPI',
    date: d,
    month: m,
    timestamp: new Date().toISOString(),
  };
  state.transactions.unshift(tx); // newest first
  saveState();
  return tx;
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
async function callBackend(action, payload = {}) {
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
    return handleLocalAction(action, payload);
  }
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

  // Update local state first (immediate UI), then sync backend if configured
  state.budget[currentMonthKey()] = amt;
  saveState();
  if (BACKEND_URL) callBackend('setbudget', { amount: amt, month: currentMonthKey() }).catch(() => { });

  closeModal('modal-budget');
  renderDashboard();
  showToast(`✅ Budget set to ₹${amt.toLocaleString('en-IN')} for ${currentMonthKey()}`);
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

  // Update local state first (immediate UI)
  updateTransaction(id, changes);
  // Sync to backend if configured
  if (BACKEND_URL) callBackend('updateExpense', { id, changes }).catch(() => { });

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
  deleteTransaction(id);
  // Sync to backend if configured
  if (BACKEND_URL) callBackend('deleteExpense', { id }).catch(() => { });

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
  if (!exists) {
    const kwArr = kws ? kws.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [];
    state.customCategories.push({ name: capitalize(name), keywords: kwArr, icon: '🏷️' });
    saveState();
  }
  // Sync to backend if configured
  if (BACKEND_URL) callBackend('addCategory', { name, keywords: kws }).catch(() => { });

  closeModal('modal-category');
  renderCategoriesGrid();
  populateCategoryDropdowns();
  showToast(`✅ Category "${capitalize(name)}" added!`);
}

function deleteCategory(name) {
  const idx = state.customCategories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return;

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

function saveEditCategory() {
  const newName = document.getElementById('edit-cat-name').value.trim();
  const newKws = document.getElementById('edit-cat-keywords').value.trim();
  if (!newName) { showToast('Category name required'); return; }

  const idx = state.customCategories.findIndex(
    c => c.name.toLowerCase() === editingCategoryOriginalName.toLowerCase()
  );
  if (idx === -1) return;

  const kwArr = newKws ? newKws.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [];

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
  // Sync to backend if configured (fire-and-forget)
  if (BACKEND_URL) callBackend('addExpense', payload).catch(() => { });

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
document.addEventListener('df-response-received', async (event) => {
  try {
    const response = event.detail?.raw?.queryResult;
    if (!response) return;

    // Extract custom payload if present
    const customPayload = response.fulfillmentMessages?.find(m => m.payload)?.payload;

    if (customPayload) {
      const { action, data } = customPayload;

      if (action === 'expenseAdded' && data) {
        addTransaction({
          amount: data.amount,
          title: data.title,
          category: data.category,
          payment: data.payment,
          date: data.date,
          month: data.month,
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
   LOCAL NLP CHATBOT
   Parses natural language commands locally (no Dialogflow needed)
   ============================================================ */

// Chat history for the local chatbot UI
let chatHistory = [];

/**
 * Process a natural language command locally.
 * Supports: add expense, set budget, add category, delete, search, summary, undo.
 * @param {string} text - raw user input
 * @returns {string} bot response message
 */
function processLocalCommand(text) {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // ─── SET BUDGET ───────────────────────────────────────
  if (/set\s+budget|budget\s+is|my\s+budget|budget\s+of/.test(lower)) {
    const m = lower.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const amt = parseFloat(m[1]);
      state.budget[currentMonthKey()] = amt;
      saveState();
      renderDashboard();
      return `🎯 Budget set to ₹${amt.toLocaleString('en-IN')} for ${currentMonthKey()}`;
    }
    return '⚠️ Please include an amount. e.g. "set budget 5000"';
  }

  // ─── ADD CATEGORY ─────────────────────────────────────
  const catAddMatch = raw.match(/(?:add|create|new)\s+category\s+(.+)/i);
  if (catAddMatch) {
    const catName = capitalize(catAddMatch[1].trim());
    const exists = state.customCategories.some(c => c.name.toLowerCase() === catName.toLowerCase());
    if (!exists) {
      state.customCategories.push({ name: catName, keywords: [], icon: '🏷️' });
      saveState();
      populateCategoryDropdowns();
      renderCategoriesGrid();
    }
    return `🏷️ Category "${catName}" ${exists ? 'already exists' : 'added'}! Use it when logging expenses.`;
  }

  // ─── UNDO LAST ────────────────────────────────────────
  if (/^undo|undo\s+last|restore\s+last/.test(lower)) {
    const ok = undoLastDelete();
    if (ok) {
      renderDashboard();
      renderTransactionsTable();
      return '↩️ Last deleted transaction has been restored!';
    }
    return '⚠️ Nothing to undo.';
  }

  // ─── DELETE ───────────────────────────────────────────
  if (/^delete|^remove/.test(lower)) {
    if (/last|recent/.test(lower)) {
      const tx = deleteLastTransaction();
      if (!tx) return '⚠️ No transactions to delete.';
      renderDashboard();
      renderTransactionsTable();
      return `🗑️ Deleted "${tx.title}" (₹${tx.amount}). Type "undo" to restore.`;
    }
    const q = raw.replace(/^(delete|remove)\s+/i, '').trim();
    if (q) {
      const found = findTransactionsByTitle(q);
      if (!found.length) return `⚠️ No transaction found matching "${q}".`;
      deleteTransaction(found[0].id);
      renderDashboard();
      renderTransactionsTable();
      return `🗑️ Deleted "${found[0].title}" (₹${found[0].amount}). Type "undo" to restore.`;
    }
    return '⚠️ Specify what to delete. e.g. "delete pizza" or "delete last"';
  }

  // ─── SEARCH ───────────────────────────────────────────
  const searchMatch = raw.match(/^(?:search|find|look\s+up)\s+(.+)/i);
  if (searchMatch) {
    const q = searchMatch[1].trim();
    const results = findTransactionsByTitle(q);
    if (!results.length) return `🔍 No results for "${q}".`;
    const lines = results.slice(0, 5).map(t => `• ${t.title} – ₹${t.amount} (${t.category}, ${t.payment})`);
    return `🔍 ${results.length} result(s) for "${q}":\n${lines.join('\n')}`;
  }

  // ─── SHOW SUMMARY / REPORT ────────────────────────────
  if (/summary|report|balance|status|how\s+much/.test(lower) && !/spent\s+\d/.test(lower)) {
    const budget = getCurrentBudget();
    const spent = getMonthlySpent();
    const remaining = budget - spent;
    const count = state.transactions.filter(t => t.month === currentMonthKey()).length;
    let reply = `📊 *${currentMonthKey()} Summary*\n`;
    reply += `💸 Spent: ₹${spent.toLocaleString('en-IN')}\n`;
    reply += `🎯 Budget: ₹${budget.toLocaleString('en-IN')}\n`;
    reply += `💰 Remaining: ₹${remaining.toLocaleString('en-IN')}\n`;
    reply += `📝 Transactions: ${count}`;
    if (spent > budget && budget > 0) reply += '\n⚠️ Over budget!';
    return reply;
  }

  // ─── SHOW ALL ─────────────────────────────────────────
  if (/show\s+all|all\s+transactions|list\s+all/.test(lower)) {
    if (!state.transactions.length) return '📭 No transactions yet.';
    const lines = state.transactions.slice(0, 8).map(t => `• ${t.title} – ₹${t.amount} (${t.category})`);
    return `📋 Last ${lines.length} transactions:\n${lines.join('\n')}`;
  }

  // ─── ADD EXPENSE (default: "spent / paid / bought X on/for Y") ───
  const amountMatch = lower.match(/\b(\d+(?:\.\d+)?)\b/);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1]);
    // Extract item: look for "on X", "for X", "of X"
    const itemMatch = raw.match(/(?:on|for|of)\s+([a-zA-Z][a-zA-Z0-9\s]*?)(?:\s+(?:via|using|by|through|with)|$)/i);
    const title = itemMatch ? itemMatch[1].trim() : null;
    const payment = detectPayment(lower);
    const category = detectCategory(title || raw);

    if (amount > 0 && title) {
      const tx = addTransaction({ amount, title, category, payment });
      renderDashboard();
      // Refresh transactions table if visible
      if (document.getElementById('section-transactions').classList.contains('active')) {
        renderTransactionsTable();
        populateFilterDropdowns();
      }
      // Note: sheet sync happens via syncExpenseToSheets() in sendLocalChat
      return `✅ Added ₹${tx.amount} for ${tx.title}\n📂 ${category} · 💳 ${payment}`;
    }

    if (amount > 0 && !title) {
      return `⚠️ I see ₹${amount} but couldn't find the item. Try:\n"spent ${amount} on coffee"`;
    }
  }

  // ─── HELP / FALLBACK ──────────────────────────────────
  return `❓ I didn't understand that. Try:\n• "spent 200 on pizza"\n• "paid 50 for uber via cash"\n• "set budget 5000"\n• "add category Gym"\n• "show summary"\n• "delete last"`;
}

/** Send a message: instant local NLP response + background Sheets sync */
async function sendLocalChat() {
  const input = document.getElementById('local-chat-input');
  const text  = (input?.value || '').trim();
  if (!text) return;

  chatHistory.push({ role: 'user', text });
  input.value = '';
  renderLocalChat();

  // ── Step 1: Local NLP → instant response + localStorage ─────────
  const reply = processLocalCommand(text);
  chatHistory.push({ role: 'bot', text: reply });
  renderLocalChat();
  renderDashboard();

  // ── Step 2: Sync expense to Google Sheets (fire & forget) ───────
  syncExpenseToSheets(text);
}

/**
 * Parse expense from plain text and POST it to the backend using the
 * direct-action format { action:'addExpense', ... } that the deployed
 * Apps Script understands. Uses text/plain to avoid CORS preflight.
 * Non-expense messages (budget, delete, etc.) are skipped here since
 * they are already handled locally by processLocalCommand above.
 */
async function syncExpenseToSheets(text) {
  try {
    const lower = text.toLowerCase();

    // Only sync if it looks like an expense (has a number + item)
    const amountMatch = lower.match(/\b(\d+(?:\.\d+)?)\b/);
    const itemMatch   = text.match(
      /(?:on|for|of)\s+([a-zA-Z][a-zA-Z0-9\s]*?)(?:\s+(?:via|using|by|through|with)|$)/i
    );
    if (!amountMatch || !itemMatch) return;

    const amount   = parseFloat(amountMatch[1]);
    const title    = itemMatch[1].trim();
    if (amount <= 0 || !title) return;

    const category = detectCategory(title);
    const payment  = detectPayment(lower);

    await fetch(BACKEND_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight
      body: JSON.stringify({
        queryResult: {
          intent: { displayName: 'AddExpense' },
          parameters: {
            amount: amount.toString(),
            item: title,
            payment: payment
          },
          queryText: text
        }
      }),
    });
  } catch (err) {
    console.error('ChatSpend: Sheets sync failed:', err);
  }
}

/** Render the local chat history */
function renderLocalChat() {
  const box = document.getElementById('local-chat-messages');
  if (!box) return;

  box.innerHTML = chatHistory.map(msg => `
    <div class="lc-msg lc-msg-${msg.role}">
      ${msg.role === 'bot' ? '<span class="lc-avatar">🤖</span>' : ''}
      <div class="lc-bubble">${escHtml(msg.text).replace(/\n/g, '<br/>')}</div>
      ${msg.role === 'user' ? '<span class="lc-avatar">👤</span>' : ''}
    </div>
  `).join('');

  // Scroll to bottom
  box.scrollTop = box.scrollHeight;
}

/** Handle Enter key in local chat input */
function handleLocalChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendLocalChat();
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
   FLOATING CHATBOT TOGGLE
   ============================================================ */

let chatbotOpen = false;

function toggleChatbot() {
  chatbotOpen = !chatbotOpen;
  const panel = document.getElementById('chatbot-panel');
  const iconOpen = document.querySelector('.fab-icon-open');
  const iconClose = document.querySelector('.fab-icon-close');
  const badge = document.getElementById('fab-badge');

  if (chatbotOpen) {
    panel.classList.remove('hidden');
    iconOpen.classList.add('hidden');
    iconClose.classList.remove('hidden');
    badge.classList.remove('show');         // clear unread dot
    // Re-render history and focus input
    renderLocalChat();
    setTimeout(() => document.getElementById('local-chat-input')?.focus(), 80);
  } else {
    panel.classList.add('hidden');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
  }
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

function init() {
  // Load data from localStorage
  loadState();

  // Apply saved theme
  applyTheme();

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
