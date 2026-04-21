/**
 * ChatSpend – Google Apps Script Backend (Code.gs)
 * =================================================
 * Webhook for Dialogflow ES.
 * Handles all intents: AddExpense, SetBudget, AddCategory,
 * DeleteExpense, UpdateExpense, SearchExpense, ShowSummary, UndoLast.
 * Data is stored in Google Sheets.
 *
 * SETUP INSTRUCTIONS (one-time):
 * -----------------------------------------------
 * 1. Open https://script.google.com → New Project
 * 2. Paste this entire file into the editor (replacing existing content)
 * 3. Replace SHEET_ID below with your Google Sheets ID
 *    (found in the Sheets URL: .../spreadsheets/d/SHEET_ID/edit)
 * 4. Click Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone (even anonymous)
 * 5. Copy the generated Web App URL
 * 6. Paste it into:
 *    a) script.js → BACKEND_URL constant
 *    b) Dialogflow console → Fulfillment → Webhook URL
 * 7. Run setupSheets() once (via Run menu) to create sheet headers
 */

/* ============================================================
   CONFIGURATION
   ============================================================ */

/** Google Sheets document ID */
const SHEET_ID = '1dftZRZ-RfNbMKGVUgjyyo95FYU1OE38SW_ZXb9lR9Eo';

/** Sheet tab names */
const SHEETS = {
  TRANSACTIONS: 'ChatSpend',   // primary sheet used by the website
  CATEGORIES:   'Categories',
  BUDGET:       'Budget',
};

/* ============================================================
   ENTRY POINT – Handles Dialogflow webhook + website requests
   ============================================================ */

/**
 * doPost handles three types of POST requests:
 *
 *  A) Dialogflow webhook  → body.queryResult.intent + parameters
 *  B) Website chat (format 1) → body.queryResult.queryText
 *  C) Website chat (format 2) → body.message  OR  body.text
 *
 * All paths return { fulfillmentText: "..." }.
 * Safe null-checks are used throughout — no "Cannot read property of undefined".
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Debug log — visible in Apps Script → Executions
    Logger.log('doPost received: ' + JSON.stringify(body));

    // ── Legacy direct-action calls from frontend (action field) ──────
    if (body.action) {
      Logger.log('Routing to handleDirectAction: ' + body.action);
      return handleDirectAction(body);
    }

    // Safe extraction — works for Dialogflow AND plain website POSTs
    const intent = (
      body.queryResult &&
      body.queryResult.intent &&
      body.queryResult.intent.displayName
    ) || '';

    const params = (body.queryResult && body.queryResult.parameters) || {};

    // Accept message from any of the three common locations
    const queryText = (
      (body.queryResult && body.queryResult.queryText) ||
      (body.originalDetectIntentRequest && body.originalDetectIntentRequest.payload && body.originalDetectIntentRequest.payload.text) ||
      body.message ||
      body.text ||
      body.queryText ||
      ''
    ).toString().trim();

    Logger.log('intent="' + intent + '" queryText="' + queryText + '"');

    // ── A: Dialogflow with a known intent ───────────────────────────
    if (intent) {
      let reply = '';
      let customPayload = null;

      if      (intent.includes('AddExpense')    || intent.includes('Expense.add') || intent.toLowerCase() === 'log_expense')      { ({ reply, customPayload } = handleAddExpense(params, queryText)); }
      else if (intent.includes('SetBudget')     || intent.includes('Budget.set') || intent.toLowerCase() === 'setbudget')       { ({ reply, customPayload } = handleSetBudget(params)); }
      else if (intent.includes('AddCategory')   || intent.includes('Category.add') || intent.toLowerCase() === 'addcategory')     { ({ reply, customPayload } = handleAddCategory(params)); }
      else if (intent.includes('DeleteExpense') || intent.includes('Expense.delete') || intent.toLowerCase() === 'deleteexpense')   { ({ reply, customPayload } = handleDeleteExpense(params, queryText)); }
      else if (intent.includes('UpdateExpense') || intent.includes('Expense.update') || intent.toLowerCase() === 'updateexpense')   { ({ reply, customPayload } = handleUpdateExpense(params, queryText)); }
      else if (intent.includes('Search')        || intent.includes('Expense.search') || intent.toLowerCase() === 'searchexpense')   { ({ reply, customPayload } = handleSearch(params, queryText)); }
      else if (intent.includes('Summary')       || intent.includes('Report') || intent.toLowerCase() === 'showsummary')           { ({ reply, customPayload } = handleSummary()); }
      else if (intent.includes('ShowAll')       || intent.includes('Expense.show'))     { ({ reply, customPayload } = handleShowAll()); }
      else if (intent.includes('Undo')          || intent.includes('Expense.undo') || intent.toLowerCase() === 'undolast')     { ({ reply, customPayload } = handleUndo()); }
      else if (intent.includes('ShowFilter')    || intent.includes('Expense.filter') || intent.toLowerCase() === 'showfilter')   { ({ reply, customPayload } = handleFilter(params, queryText)); }
      else {
        reply = "I didn't understand that. Try: 'spent 50 on coffee', 'set budget 5000', or 'show summary'.";
      }

      const responseObj = { fulfillmentText: reply };
      if (customPayload) {
        responseObj.fulfillmentMessages = [
          { text: { text: [reply] } },
          { payload: customPayload },
        ];
      }
      Logger.log('Dialogflow reply: ' + reply);
      return ContentService
        .createTextOutput(JSON.stringify(responseObj))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── B/C: Plain website request — handle with NLP parser ─────────
    if (!queryText) {
      Logger.log('No queryText found in request body');
      return jsonReply('⚠️ No message received. Send { "queryResult": { "queryText": "..." } } or { "message": "..." }');
    }

    Logger.log('Routing to handleWebsiteMessage: "' + queryText + '"');
    return handleWebsiteMessage(queryText);

  } catch (err) {
    Logger.log('doPost ERROR: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ fulfillmentText: 'ERROR: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Parse and act on a plain-text message from the website chat.
 * Supports: add expense, set budget, summary, show all, undo, delete, search.
 * @param {string} text - raw user message, e.g. "spent 50 on pizza"
 */
function handleWebsiteMessage(text) {
  try {
    const raw   = text.trim();
    const lower = raw.toLowerCase();

    // ── Help / Commands ─────────────────────────────────────────────
    if (/^help$|^commands$|what can you do|how to use|usage/.test(lower)) {
      return jsonReply(
        '🤖 Here are useful commands:\n' +
        '• "spent 200 on pizza"\n' +
        '• "spent 120 yesterday on tea"\n' +
        '• "spent 450 on groceries on 18/04/2026"\n' +
        '• "set budget 5000"\n' +
        '• "update last to 250"\n' +
        '• "delete last"\n' +
        '• "show summary"'
      );
    }

    // ── Set Budget ─────────────────────────────────────────────────
    if (/set\s+budget|budget\s+is|my\s+budget|budget\s+of/.test(lower)) {
      const m = lower.match(/(\d+(?:\.\d+)?)/);
      if (!m) return jsonReply('⚠️ Please include an amount. e.g. "set budget 5000"');
      const amt   = parseFloat(m[1]);
      const month = getCurrentMonthKey();
      setBudgetInSheet(month, amt);
      return jsonReply('🎯 Budget set to ₹' + amt + ' for ' + month);
    }

    // ── Add Category ───────────────────────────────────────────────
    const catAddMatch = raw.match(/(?:add|create|new)\s+category\s+(.+)/i);
    if (catAddMatch) {
      const catName = capitalizeWords(catAddMatch[1].trim());
      addCategoryToSheet(catName, '');
      return jsonReply('🏷️ Category "' + catName + '" added!');
    }

    // ── Undo ───────────────────────────────────────────────────────
    if (/^undo|undo\s+last|restore\s+last/.test(lower)) {
      const props = PropertiesService.getScriptProperties();
      const rawTx = props.getProperty('LAST_DELETED');
      if (!rawTx) return jsonReply('⚠️ Nothing to undo.');
      const tx = JSON.parse(rawTx);
      addTransactionToSheet(tx);
      props.deleteProperty('LAST_DELETED');
      return jsonReply('↩️ Restored "' + tx.title + '" (₹' + tx.amount + ')');
    }

    // ── Delete ─────────────────────────────────────────────────────
    if (/^delete|^remove/.test(lower)) {
      if (/last|recent/.test(lower)) {
        const tx = deleteLastTransaction();
        if (!tx) return jsonReply('⚠️ No transactions to delete.');
        return jsonReply('🗑️ Deleted "' + tx.title + '" (₹' + tx.amount + '). Type "undo last" to restore.');
      }
      const q = raw.replace(/^(delete|remove)\s+/i, '').trim();
      if (q) {
        const found = searchTransactions(q);
        if (!found.length) return jsonReply('⚠️ No transaction found matching "' + q + '".');
        deleteTransactionById(found[0][0]);
        return jsonReply('🗑️ Deleted "' + found[0][1] + '" (₹' + found[0][2] + '). Type "undo last" to restore.');
      }
      return jsonReply('⚠️ Specify what to delete. e.g. "delete pizza" or "delete last"');
    }

    // ── Search ─────────────────────────────────────────────────────
    const searchMatch = raw.match(/^(?:search|find|look\s+up)\s+(.+)/i);
    if (searchMatch) {
      const q       = searchMatch[1].trim();
      const results = searchTransactions(q);
      if (!results.length) return jsonReply('🔍 No results for "' + q + '".');
      const lines = results.slice(0, 5).map(function(t) {
        return '• ' + t[1] + ' – ₹' + t[2] + ' (' + t[3] + ', ' + t[4] + ')';
      });
      return jsonReply('🔍 ' + results.length + ' result(s) for "' + q + '":\n' + lines.join('\n'));
    }

    // ── Summary ────────────────────────────────────────────────────
    if (/summary|report|balance|status|how\s+much/.test(lower) && !/spent\s+\d/.test(lower)) {
      const r = handleSummary();
      return jsonReply(r.reply);
    }

    // ── Show All ───────────────────────────────────────────────────
    if (/show\s+all|all\s+transactions|list\s+all/.test(lower)) {
      const r = handleShowAll();
      return jsonReply(r.reply);
    }

    // ── Add Expense (default: number detected in text) ─────────────
    const amountMatch = lower.match(/\b(\d+(?:\.\d+)?)\b/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);

      // Try to extract item naturally from user text
      const item = extractItemFromExpenseText(raw, amount);
      const when = parseDateContextFromText(raw);

      if (amount > 0 && item) {
        const category = detectCategory(item);
        const payment  = detectPaymentFromText(lower);
        const title    = capitalizeWords(item);
        const date     = when.date;
        const month    = when.month;

        addTransactionToSheet({ amount, title, category, payment, date, month });

        return jsonReply(
          '✅ Added ₹' + amount + ' for ' + title +
          '\n📂 ' + category + ' · 💳 ' + payment + ' · 📅 ' + date
        );
      }

      if (amount > 0 && !item) {
        return jsonReply('⚠️ I see ₹' + amount + ' but couldn\'t find the item. Try: "spent ' + amount + ' on coffee"');
      }
    }

    // ── Fallback ───────────────────────────────────────────────────
    return jsonReply(
      '❓ I didn\'t understand that. Try:\n' +
      '• "spent 200 on pizza"\n' +
      '• "paid 50 for uber via cash"\n' +
      '• "set budget 5000"\n' +
      '• "add category Gym"\n' +
      '• "show summary"\n' +
      '• "delete last"'
    );

  } catch (err) {
    Logger.log('handleWebsiteMessage error: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ fulfillmentText: 'ERROR: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Helper – wrap a plain string as a fulfillmentText JSON response */
function jsonReply(text) {
  return ContentService
    .createTextOutput(JSON.stringify({ fulfillmentText: text }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   DIRECT ACTION HANDLER (called from frontend script.js)
   ============================================================ */

function handleDirectAction(body) {
  let result = {};

  switch (body.action) {
    case 'addExpense':
      result = directAddExpense(body);
      break;
    case 'updateExpense':
      result = directUpdateExpense(body);
      break;
    case 'deleteExpense':
      result = directDeleteExpense(body);
      break;
    case 'deleteLast':
      result = directDeleteLast();
      break;
    case 'setbudget':
      result = directSetBudget(body);
      break;
    case 'addCategory':
      result = directAddCategory(body);
      break;
    case 'getAll':
      result = { success: true, transactions: getAllTransactions() };
      break;
    case 'getState':
      result = {
        success: true,
        transactions: getAllTransactions().map(rowToTransactionObject),
        budget: getBudgetMap(),
        categories: getCustomCategories(),
      };
      break;
    case 'health':
      result = getBackendHealthReport();
      break;
    case 'search':
      result = { success: true, transactions: searchTransactions(body.query) };
      break;
    default:
      result = { success: false, error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowToTransactionObject(r) {
  const normalized = normalizeDateAndMonthFields(r[5], r[6], r[7]);
  return {
    id: r[0],
    title: r[1],
    amount: Number(parseAmountValue(r[2]) || 0),
    category: r[3] || 'Others',
    payment: r[4] || 'UPI',
    date: normalized.date,
    month: normalized.month,
    timestamp: normalized.timestamp,
  };
}

function normalizeDateAndMonthFields(dateValue, monthValue, timestampValue) {
  const fallbackNow = new Date();
  const tsCandidate = (timestampValue || '').toString().trim();
  const monthCandidate = normalizeMonthKey(monthValue);

  let parsedDate = null;
  let parsedMonth = null;

  // 1) Try explicit dd-mm-yyyy date format
  const dateText = (dateValue || '').toString().trim();
  const m1 = dateText.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) {
    const d = new Date(parseInt(m1[3], 10), parseInt(m1[2], 10) - 1, parseInt(m1[1], 10));
    if (!isNaN(d.getTime())) {
      parsedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      parsedMonth = formatMonthKey(d);
    }
  }

  // 2) Try native Date parsing for raw date cell values
  if (!parsedDate && dateText) {
    const d = new Date(dateText);
    if (!isNaN(d.getTime())) {
      parsedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      parsedMonth = formatMonthKey(d);
    }
  }

  // 3) Try timestamp as fallback
  if (!parsedDate && tsCandidate) {
    const d = new Date(tsCandidate);
    if (!isNaN(d.getTime())) {
      parsedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      parsedMonth = formatMonthKey(d);
    }
  }

  // 4) Last resort: now
  if (!parsedDate) {
    parsedDate = `${String(fallbackNow.getDate()).padStart(2, '0')}-${String(fallbackNow.getMonth() + 1).padStart(2, '0')}-${fallbackNow.getFullYear()}`;
    parsedMonth = formatMonthKey(fallbackNow);
  }

  return {
    date: parsedDate,
    month: monthCandidate || parsedMonth || getCurrentMonthKey(),
    timestamp: tsCandidate || new Date().toISOString(),
  };
}

function getBudgetMap() {
  const out = {};
  const sheet = getSheet(SHEETS.BUDGET);
  const data = sheet.getDataRange().getValues();
  if (!data.length) return out;
  const start = getDataStartIndexByHeader(data[0][0], 'Month');
  for (let i = start; i < data.length; i++) {
    const month = normalizeMonthKey(data[i][0]);
    const amount = parseAmountValue(data[i][1]);
    if (month && Number.isFinite(amount)) out[month] = amount;
  }
  return out;
}

function getBackendHealthReport() {
  const tx = getSheet(SHEETS.TRANSACTIONS).getDataRange().getValues();
  const cat = getSheet(SHEETS.CATEGORIES).getDataRange().getValues();
  const bud = getSheet(SHEETS.BUDGET).getDataRange().getValues();
  const allTx = getAllTransactions();
  const currentMonth = getCurrentMonthKey();
  const currentMonthTx = allTx.filter(t => getMonthKeyFromTransactionRow(t) === currentMonth);

  return {
    success: true,
    sheets: SHEETS,
    currentMonth,
    transactionsTotalRows: tx.length,
    categoriesTotalRows: cat.length,
    budgetTotalRows: bud.length,
    parsedTransactions: allTx.length,
    parsedCurrentMonthTransactions: currentMonthTx.length,
    currentBudget: getBudgetForMonth(currentMonth),
    sampleTransactionRows: allTx.slice(0, 5),
    budgetMap: getBudgetMap(),
    sampleCategories: getCustomCategories().slice(0, 10),
  };
}

function getCustomCategories() {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const data = sheet.getDataRange().getValues();
  if (!data.length) return [];

  const start = getDataStartIndexByHeader(data[0][0], 'CategoryName');
  const rows = data.slice(start);

  return rows
    .filter(r => String(r[0] || '').trim() !== '')
    .map(r => ({
      name: capitalizeWords(String(r[0] || '').trim()),
      keywords: String(r[1] || '')
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(Boolean),
      icon: '🏷️',
    }));
}

/* ============================================================
   INTENT HANDLERS
   ============================================================ */

/**
 * HandleAddExpense
 * Extracts amount, item, payment from Dialogflow params.
 * Also parses payment method from the raw query text.
 */
function handleAddExpense(params, queryText) {
  const amount  = parseFloat(params['number'] || params['amount'] || 0);
  const rawItem = (params['any'] || params['item'] || '').toString().trim();
  const inferredItem = rawItem || extractItemFromExpenseText(queryText, amount) || '';
  const payment = detectPaymentFromText(queryText);
  const category = detectCategory(inferredItem);
  const title   = capitalizeWords(inferredItem || 'Unnamed');
  const when    = parseDateContextFromText(queryText);
  const date    = when.date;
  const month   = when.month;

  if (!amount || amount <= 0) {
    return { reply: "⚠️ I couldn't detect an amount. Try: 'spent 200 on pizza'" };
  }

  // Store in sheet
  const id = addTransactionToSheet({ amount, title, category, payment, date, month });

  const reply = `✅ Added ₹${amount} for ${title} (${category} via ${payment}) on ${date}`;
  const customPayload = {
    action: 'expenseAdded',
    data: { id, amount, title, category, payment, date, month },
  };

  return { reply, customPayload };
}

/** Handle SetBudget intent */
function handleSetBudget(params) {
  const amount = parseFloat(params['number'] || params['budget'] || 0);
  if (!amount || amount <= 0) {
    return { reply: "⚠️ Couldn't detect budget amount. Try: 'set budget 5000'" };
  }

  const month = getCurrentMonthKey();
  setBudgetInSheet(month, amount);

  const reply = `🎯 Budget set to ₹${amount} for ${month}`;
  return { reply, customPayload: { action: 'budgetSet', data: { amount, month } } };
}

/** Handle AddCategory intent */
function handleAddCategory(params) {
  const name = capitalizeWords((params['category-name'] || params['any'] || '').toString().trim());
  if (!name) {
    return { reply: "⚠️ Please specify a category name. Try: 'add category Gym'" };
  }

  addCategoryToSheet(name, '');
  const reply = `🏷️ Category "${name}" added! You can now use it when logging expenses.`;
  return { reply, customPayload: { action: 'categoryAdded', data: { name } } };
}

/** Handle DeleteExpense intent */
function handleDeleteExpense(params, queryText) {
  const lower = queryText.toLowerCase();

  // "delete last" or "undo"
  if (lower.includes('last') || lower.includes('recent')) {
    const tx = deleteLastTransaction();
    if (!tx) return { reply: '⚠️ No transactions to delete.' };
    const reply = `🗑️ Deleted last transaction: ${tx.title} (₹${tx.amount})`;
    return { reply, customPayload: { action: 'expenseDeleted', data: { id: null } } };
  }

  // "delete pizza" – search by title
  const query = (params['any'] || params['title'] || '').toString().trim();
  if (query) {
    const txs = searchTransactions(query);
    if (txs.length === 0) {
      return { reply: `⚠️ No transaction found matching "${query}".` };
    }
    const tx = txs[0]; // delete the most recent match
    deleteTransactionById(tx[0]); // col 0 = ID
    const reply = `🗑️ Deleted "${tx[1]}" (₹${tx[2]}). Type "undo last" to restore.`;
    return { reply, customPayload: { action: 'expenseDeleted', data: { id: tx[0] } } };
  }

  return { reply: "⚠️ Please specify what to delete. Try: 'delete pizza' or 'delete last'" };
}

/** Handle UpdateExpense intent */
function handleUpdateExpense(params, queryText) {
  const query   = (params['any'] || '').toString().trim();
  const amount  = parseFloat(params['number'] || 0);
  const lower   = (queryText || '').toLowerCase();

  if (!amount) {
    return { reply: "⚠️ Try: 'update pizza to 300'" };
  }

  // Natural shortcut: "update last to 250"
  if (/\blast\b|\brecent\b/.test(lower)) {
    const all = getAllTransactions();
    const last = all.find(t => t && t[0] && t[1]);
    if (!last) return { reply: '⚠️ No valid transactions found to update.' };
    updateTransactionById(last[0], { amount });
    const safeTitle = last[1] || 'Untitled';
    const reply = `✏️ Updated last transaction "${safeTitle}" to ₹${amount}`;
    return { reply, customPayload: { action: 'expenseUpdated', data: { id: last[0], amount } } };
  }

  if (!query) {
    return { reply: "⚠️ Try: 'update pizza to 300' or 'update last to 300'" };
  }

  const txs = searchTransactions(query);
  if (txs.length === 0) {
    return { reply: `⚠️ No transaction found matching "${query}".` };
  }

  const tx  = txs[0];
  const txId = tx[0];
  updateTransactionById(txId, { amount });

  const reply = `✏️ Updated "${tx[1]}" to ₹${amount}`;
  return { reply, customPayload: { action: 'expenseUpdated', data: { id: txId, amount } } };
}

/** Handle Search intent */
function handleSearch(params, queryText) {
  const query = (params['any'] || params['query'] || queryText).toString().trim();
  const txs   = searchTransactions(query);

  if (txs.length === 0) {
    return { reply: `🔍 No transactions found for "${query}".` };
  }

  const lines = txs.slice(0, 5).map(t => `• ${t[1]} – ₹${t[2]} (${t[3]}, ${t[5]})`);
  const reply = `🔍 Found ${txs.length} result(s) for "${query}":\n${lines.join('\n')}`;
  return { reply };
}

/** Handle ShowAll / Summary intent */
function handleSummary() {
  const month   = getCurrentMonthKey();
  const budget  = getBudgetForMonth(month);
  const txs     = getAllTransactions().filter(t => getMonthKeyFromTransactionRow(t) === month);
  const validTxs = txs.filter(t => Number.isFinite(parseAmountValue(t[2])));
  const spent   = validTxs.reduce((s, t) => s + parseAmountValue(t[2]), 0);
  const remaining = budget - spent;
  const count   = validTxs.length;

  // Category breakdown
  const catMap = {};
  validTxs.forEach(t => {
    const c = (t[3] || 'Others').toString().trim() || 'Others';
    catMap[c] = (catMap[c] || 0) + parseAmountValue(t[2]);
  });
  const catLines = Object.entries(catMap).map(([k, v]) => `  • ${k}: ₹${v.toFixed(0)}`);

  let reply = `📊 *${month} Summary*\n`;
  reply += `💸 Spent: ₹${spent.toFixed(0)} / Budget: ₹${budget}\n`;
  reply += `💰 Remaining: ₹${remaining.toFixed(0)}\n`;
  reply += `📝 Transactions: ${count}\n`;
  if (catLines.length) reply += `\nBy Category:\n${catLines.join('\n')}`;
  if (spent > budget && budget > 0) reply += `\n\n⚠️ You've exceeded your budget!`;

  return { reply };
}

function parseAmountValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = (value || '').toString().trim();
  if (!raw) return NaN;
  // Remove currency symbols, commas, and non-number clutter.
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return NaN;
  // Guard against accidentally parsing IDs/timestamps as amounts.
  if (num < 0 || num > 10000000) return NaN;
  return num;
}

function getMonthKeyFromTransactionRow(tx) {
  if (!tx || !Array.isArray(tx)) return getCurrentMonthKey();

  // Preferred explicit month column.
  const explicitMonth = (tx[6] || '').toString().trim();
  if (explicitMonth) {
    const normalized = normalizeMonthKey(explicitMonth);
    if (normalized) return normalized;
  }

  // Fallback: parse dd-mm-yyyy from Date column.
  const dateText = (tx[5] || '').toString().trim();
  const m = dateText.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const d = new Date(year, mon - 1, day);
    if (!isNaN(d.getTime())) return formatMonthKey(d);
  }

  // Fallback: parse ISO timestamp.
  const ts = (tx[7] || '').toString().trim();
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return formatMonthKey(d);
  }

  return getCurrentMonthKey();
}

function formatMonthKey(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]}-${d.getFullYear()}`;
}

function normalizeMonthKey(value) {
  const raw = (value || '').toString().trim();
  if (!raw) return '';

  // Already in expected form.
  const m1 = raw.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    return `${capitalizeWords(m1[1].slice(0, 3).toLowerCase())}-${m1[2]}`;
  }

  // Try date-like formats: dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return formatMonthKey(d);

  const m2 = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const mon = parseInt(m2[2], 10);
    const year = parseInt(m2[3], 10);
    const parsed = new Date(year, mon - 1, day);
    if (!isNaN(parsed.getTime())) return formatMonthKey(parsed);
  }

  return '';
}

/** Handle ShowAll */
function handleShowAll() {
  const txs = getAllTransactions().slice(0, 10);
  if (txs.length === 0) return { reply: '📭 No transactions recorded yet.' };

  const lines = txs.map(t => `• ${t[1]} – ₹${t[2]} (${t[3]}, ${t[5]})`);
  return { reply: `📋 Last ${txs.length} transactions:\n${lines.join('\n')}` };
}

/**
 * Extracts item title from common natural language expense phrases.
 * Supports:
 *  - "spent 200 on pizza"
 *  - "paid 50 for uber via cash"
 *  - "pizza 120"
 */
function extractItemFromExpenseText(text, amount) {
  const raw = (text || '').trim();
  if (!raw) return null;

  // Pattern 1: explicit prepositions (on/for/of)
  const direct = raw.match(/(?:on|for|of)\s+([a-zA-Z][a-zA-Z0-9\s&'._-]*?)(?:\s+(?:via|using|by|through|with|on)\b|$)/i);
  if (direct && direct[1]) {
    const val = direct[1].trim();
    if (val) return val;
  }

  // Pattern 2: "pizza 120", "uber 50 cash"
  const withoutAmount = raw.replace(new RegExp('\\b' + amount + '(?:\\.0+)?\\b', 'g'), ' ');
  const cleaned = withoutAmount
    .replace(/\b(spent|spend|paid|pay|add|added|expense|expenses|rs|inr|rupees?|via|using|by|through|with|cash|card|upi|today|yesterday)\b/gi, ' ')
    .replace(/\b(on)\s+\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 60).trim();
}

/** Handle Undo (restore last deleted) */
function handleUndo() {
  // We store last deleted row in Script Properties
  const props = PropertiesService.getScriptProperties();
  const raw   = props.getProperty('LAST_DELETED');
  if (!raw) return { reply: '⚠️ Nothing to undo.' };

  const tx = JSON.parse(raw);
  addTransactionToSheet(tx);
  props.deleteProperty('LAST_DELETED');

  const reply = `↩️ Restored "${tx.title}" (₹${tx.amount})`;
  return { reply, customPayload: { action: 'expenseAdded', data: tx } };
}

/** Handle filter (by category or payment) */
function handleFilter(params, queryText) {
  const lower = queryText.toLowerCase();

  // Detect payment filter
  let payFilter = null;
  if (/\bcash\b/.test(lower))            payFilter = 'Cash';
  else if (/\bcard\b/.test(lower))       payFilter = 'Card';
  else if (/\bupi\b/.test(lower))        payFilter = 'UPI';

  // Detect category filter
  const allCats = getAllCategoryNames();
  const catFilter = allCats.find(c => lower.includes(c.toLowerCase()));

  let txs = getAllTransactions();
  if (payFilter)  txs = txs.filter(t => t[5] === payFilter);
  if (catFilter)  txs = txs.filter(t => t[3].toLowerCase() === catFilter.toLowerCase());

  if (txs.length === 0) {
    return { reply: `⚠️ No transactions found for that filter.` };
  }

  const total = txs.reduce((s, t) => s + parseFloat(t[2] || 0), 0);
  const lines = txs.slice(0, 8).map(t => `• ${t[1]} – ₹${t[2]} (${t[3]}, ${t[5]})`);
  return { reply: `📋 ${txs.length} transaction(s) (₹${total.toFixed(0)} total):\n${lines.join('\n')}` };
}

/* ============================================================
   GOOGLE SHEETS HELPERS
   ============================================================ */

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getDataStartIndexByHeader(firstCellValue, expectedHeaderLabel) {
  const first = (firstCellValue || '').toString().trim().toLowerCase();
  return first === expectedHeaderLabel.toLowerCase() ? 1 : 0;
}

function getTransactionHeaderMap(headerRow) {
  const map = {
    id: 0,
    title: 1,
    amount: 2,
    category: 3,
    payment: 4,
    date: 5,
    month: 6,
    timestamp: 7,
  };
  if (!Array.isArray(headerRow)) return map;

  const normalized = headerRow.map(h => (h || '').toString().trim().toLowerCase());
  const idx = {
    id: normalized.indexOf('id'),
    title: normalized.indexOf('title'),
    amount: normalized.indexOf('amount'),
    category: normalized.indexOf('category'),
    payment: normalized.indexOf('paymentmethod') >= 0 ? normalized.indexOf('paymentmethod') : normalized.indexOf('payment'),
    date: normalized.indexOf('date'),
    month: normalized.indexOf('month'),
    timestamp: normalized.indexOf('timestamp'),
  };

  Object.keys(map).forEach(k => {
    if (idx[k] >= 0) map[k] = idx[k];
  });
  return map;
}

function normalizeTransactionRow(row, map) {
  return [
    row[map.id],         // 0 id
    row[map.title],      // 1 title
    row[map.amount],     // 2 amount
    row[map.category],   // 3 category
    row[map.payment],    // 4 payment
    row[map.date],       // 5 date
    row[map.month],      // 6 month
    row[map.timestamp],  // 7 timestamp
  ];
}

/** Initialize sheets with headers (run this once manually) */
function setupSheets() {
  const txSheet   = getSheet(SHEETS.TRANSACTIONS);
  const catSheet  = getSheet(SHEETS.CATEGORIES);
  const budSheet  = getSheet(SHEETS.BUDGET);

  if (txSheet.getLastRow() === 0) {
    txSheet.appendRow(['ID', 'Title', 'Amount', 'Category', 'PaymentMethod', 'Date', 'Month', 'Timestamp']);
    txSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  if (catSheet.getLastRow() === 0) {
    catSheet.appendRow(['CategoryName', 'Keywords']);
    catSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  if (budSheet.getLastRow() === 0) {
    budSheet.appendRow(['Month', 'BudgetAmount']);
    budSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  Logger.log('Sheets initialized successfully!');
}

/**
 * Force all sheets to the exact expected headers/order while preserving data.
 * Run this manually once if your sheet columns drifted.
 */
function normalizeSheetSchemas() {
  normalizeSingleSheet(
    getSheet(SHEETS.TRANSACTIONS),
    ['ID', 'Title', 'Amount', 'Category', 'PaymentMethod', 'Date', 'Month', 'Timestamp']
  );
  normalizeSingleSheet(
    getSheet(SHEETS.CATEGORIES),
    ['CategoryName', 'Keywords']
  );
  normalizeSingleSheet(
    getSheet(SHEETS.BUDGET),
    ['Month', 'BudgetAmount']
  );
  Logger.log('Sheet schemas normalized successfully.');
}

function normalizeSingleSheet(sheet, expectedHeaders) {
  const data = sheet.getDataRange().getValues();
  const currentHeaders = data.length ? data[0].map(v => (v || '').toString().trim()) : [];

  // Build header index map (case-insensitive) from current sheet.
  const idxMap = {};
  currentHeaders.forEach((h, i) => { idxMap[h.toLowerCase()] = i; });

  const outRows = [];
  const hasRecognizedHeaders = expectedHeaders.some(h => idxMap[h.toLowerCase()] !== undefined);
  const startRow = hasRecognizedHeaders ? 1 : 0;

  if (data.length > startRow) {
    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      let reordered;

      // Legacy transactions format support: [Amount, Item, DateTime] with no headers.
      if (
        expectedHeaders.length === 8 &&
        !hasRecognizedHeaders &&
        row.length >= 2 &&
        String(row[0] || '').trim() !== '' &&
        String(row[1] || '').trim() !== ''
      ) {
        const amount = parseFloat(row[0]) || 0;
        const title = capitalizeWords(String(row[1] || '').trim() || 'Unnamed');
        const rawDate = String(row[2] || '').trim();
        const parsedDate = parseDateContextFromText(rawDate || '');
        const timestamp = new Date().toISOString();
        const id = 'tx_migrated_' + Date.now() + '_' + r;
        const category = detectCategory(title);
        const payment = detectPaymentFromText(rawDate || '');

        reordered = [
          id,
          title,
          amount,
          category,
          payment || 'UPI',
          parsedDate.date,
          parsedDate.month,
          timestamp,
        ];
      } else {
        reordered = expectedHeaders.map(h => {
          const idx = idxMap[h.toLowerCase()];
          return (idx !== undefined && idx < row.length) ? row[idx] : '';
        });
      }

      // Keep only non-empty rows.
      if (reordered.some(v => String(v || '').trim() !== '')) outRows.push(reordered);
    }
  }

  // Recreate table region with expected headers + normalized rows.
  sheet.clearContents();
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]).setFontWeight('bold');
  if (outRows.length) {
    sheet.getRange(2, 1, outRows.length, expectedHeaders.length).setValues(outRows);
  }
}

/** Add a transaction row */
function addTransactionToSheet({ amount, title, category, payment, date, month }) {
  const id        = 'tx_' + new Date().getTime();
  const timestamp = new Date().toISOString();
  getSheet(SHEETS.TRANSACTIONS).appendRow([id, title, amount, category, payment, date, month, timestamp]);
  return id;
}

/** Get all transaction rows (as arrays, newest first) */
function getAllTransactions() {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const data  = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  const headerLooksPresent =
    Array.isArray(data[0]) &&
    data[0].some(c => ['id', 'title', 'amount', 'category', 'month'].includes((c || '').toString().trim().toLowerCase()));

  const map = getTransactionHeaderMap(headerLooksPresent ? data[0] : []);
  const start = headerLooksPresent ? 1 : 0;

  return data
    .slice(start)
    .filter(r => r && r.length && r[map.id]) // ignore blank rows
    .map(r => normalizeTransactionRow(r, map))
    .reverse(); // newest first
}

/** Search transactions by title (partial match) */
function searchTransactions(query) {
  const lower = query.toLowerCase();
  return getAllTransactions().filter(t => t[1].toString().toLowerCase().includes(lower));
}

/** Delete a transaction by ID */
function deleteTransactionById(id) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      // Save to undo buffer
      const tx = { id: data[i][0], title: data[i][1], amount: data[i][2], category: data[i][3], payment: data[i][4], date: data[i][5], month: data[i][6] };
      PropertiesService.getScriptProperties().setProperty('LAST_DELETED', JSON.stringify(tx));
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/** Delete the most recent transaction */
function deleteLastTransaction() {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const last  = sheet.getLastRow();
  if (last <= 1) return null;
  const row = sheet.getRange(last, 1, 1, 8).getValues()[0];
  const tx  = { id: row[0], title: row[1], amount: row[2], category: row[3], payment: row[4], date: row[5], month: row[6] };
  PropertiesService.getScriptProperties().setProperty('LAST_DELETED', JSON.stringify(tx));
  sheet.deleteRow(last);
  return tx;
}

/** Update a transaction by ID */
function updateTransactionById(id, changes) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      if (changes.amount   !== undefined) sheet.getRange(i + 1, 3).setValue(changes.amount);
      if (changes.title    !== undefined) sheet.getRange(i + 1, 2).setValue(changes.title);
      if (changes.category !== undefined) sheet.getRange(i + 1, 4).setValue(changes.category);
      if (changes.payment  !== undefined) sheet.getRange(i + 1, 5).setValue(changes.payment);
      return true;
    }
  }
  return false;
}

/** Add or update budget for a month */
function setBudgetInSheet(month, amount) {
  const sheet = getSheet(SHEETS.BUDGET);
  const data  = sheet.getDataRange().getValues();
  const normalizedTargetMonth = normalizeMonthKey(month) || getCurrentMonthKey();
  const start = data.length ? getDataStartIndexByHeader(data[0][0], 'Month') : 0;
  for (let i = start; i < data.length; i++) {
    const rowMonth = normalizeMonthKey(data[i][0]);
    if (rowMonth && rowMonth === normalizedTargetMonth) {
      sheet.getRange(i + 1, 2).setValue(amount);
      sheet.getRange(i + 1, 1).setValue(normalizedTargetMonth);
      return;
    }
  }
  sheet.appendRow([normalizedTargetMonth, amount]);
}

/** Get budget for a specific month */
function getBudgetForMonth(month) {
  const sheet = getSheet(SHEETS.BUDGET);
  const data  = sheet.getDataRange().getValues();
  if (data.length === 0) return 0;
  const start = getDataStartIndexByHeader(data[0][0], 'Month');
  const target = normalizeMonthKey(month);
  for (let i = start; i < data.length; i++) {
    const rowMonth = normalizeMonthKey(data[i][0]);
    if (rowMonth && rowMonth === target) return parseFloat(data[i][1]) || 0;
  }
  return 0;
}

/** Add a custom category */
function addCategoryToSheet(name, keywords) {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const data  = sheet.getDataRange().getValues();
  const normalizedName = capitalizeWords((name || '').toString().trim());
  if (!normalizedName) return;

  const start = data.length ? getDataStartIndexByHeader(data[0][0], 'CategoryName') : 0;
  for (let i = start; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === normalizedName.toLowerCase()) return; // already exists
  }
  sheet.appendRow([normalizedName, keywords || '']);
}

/** Get all custom category names from sheet */
function getAllCategoryNames() {
  const defaults = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Healthcare', 'Others'];
  const sheet    = getSheet(SHEETS.CATEGORIES);
  const data     = sheet.getDataRange().getValues();
  const start = data.length ? getDataStartIndexByHeader(data[0][0], 'CategoryName') : 0;
  const custom   = data.slice(start).map(r => r[0].toString()).filter(Boolean);
  return [...custom, ...defaults];
}

/* ============================================================
   DIRECT ACTION HELPERS (called from frontend)
   ============================================================ */

function directAddExpense(body) {
  const id = addTransactionToSheet({
    amount:   body.amount,
    title:    body.title,
    category: body.category || detectCategory(body.title),
    payment:  body.payment  || 'UPI',
    date:     body.date     || getTodayDDMMYYYY(),
    month:    body.month    || getCurrentMonthKey(),
  });
  return { success: true, id };
}

function directUpdateExpense(body) {
  const ok = updateTransactionById(body.id, body.changes || {});
  return { success: ok };
}

function directDeleteExpense(body) {
  const ok = deleteTransactionById(body.id);
  return { success: ok };
}

function directDeleteLast() {
  const tx = deleteLastTransaction();
  return { success: !!tx, transaction: tx };
}

function directSetBudget(body) {
  setBudgetInSheet(body.month || getCurrentMonthKey(), body.amount);
  return { success: true };
}

function directAddCategory(body) {
  addCategoryToSheet(capitalizeWords(body.name), body.keywords || '');
  return { success: true };
}

/* ============================================================
   NLP UTILITIES (server-side, mirrors script.js)
   ============================================================ */

const DEFAULT_CATEGORY_KEYWORDS = {
  'Food':          [
    'food','pizza','burger','coffee','tea','lunch','dinner','breakfast','snack',
    'restaurant','cafe','meal','bread','pepsi','cola','juice','water','milk',
    'egg','chicken','fish','mutton','biryani','curry','roti','naan','dosa','idli',
    'samosa','chaat','sandwich','pasta','noodle','maggi','soup','icecream','cake',
    'cookie','chocolate','swiggy','zomato','dominos','kfc','mcdonalds','starbucks',
    'biscuit','chips','popcorn','soda','lassi','buttermilk','paneer',
  ],
  'Groceries':     [
    'grocery','groceries','vegetable','vegetables','fruit','fruits',
    'carrot','potato','onion','tomato','spinach','cabbage','cauliflower',
    'broccoli','peas','beans','corn','mushroom','garlic','ginger','chilli',
    'lemon','lime','cucumber','pumpkin','radish','beetroot','lettuce',
    'apple','banana','mango','orange','grapes','strawberry','watermelon',
    'papaya','pineapple','guava','pomegranate','kiwi','peach','pear','plum',
    'lentil','lentils','dal','pulse','pulses','rice','wheat','flour','atta',
    'maida','semolina','suji','oats','quinoa','barley','sugar','salt','oil',
    'ghee','butter','cheese','curd','yogurt','paneer','tofu','soya',
    'spice','spices','masala','turmeric','cumin','coriander','pepper',
    'mustard','cardamom','clove','cinnamon','saffron','basmati','poha',
    'supermarket','bigbasket','blinkit','zepto','dunzo','kirana','market',
  ],
  'Toiletries':    [
    'toiletries','toiletry','shampoo','conditioner','soap','bodywash',
    'facewash','face wash','moisturizer','lotion','sunscreen','cream',
    'toothbrush','toothpaste','mouthwash','floss','razor','shaving','foam',
    'deodorant','perfume','cologne','aftershave','talcum','powder',
    'tissue','toilet paper','sanitary','pad','tampon','napkin','cotton',
    'hairbrush','comb','dye','henna','nail polish','lipstick','makeup',
    'mascara','foundation','blush','eyeliner','skincare','serum','toner',
    'cleanser','scrub','dettol','savlon','bandage','antiseptic','vaseline',
  ],
  'Transport':     [
    'transport','uber','ola','auto','bus','metro','train','cab','taxi',
    'fuel','petrol','diesel','parking','ticket','fare','rapido','bike',
    'flight','travel','rickshaw','tram','ferry','boat','ship','toll',
    'highway','vehicle','car','scooter','cycle','bicycle',
    'irctc','makemytrip','goibibo','redbus','yulu','bounce',
  ],
  'Shopping':      [
    'shopping','clothes','shirt','pants','jeans','dress','kurta','saree',
    'shoes','sandals','sneakers','boots','socks','jacket','coat','hoodie',
    'sweater','tshirt','shorts','skirt',
    'amazon','flipkart','myntra','ajio','nykaa','meesho',
    'mall','store','shop','boutique','bazaar','exhibition',
    'bag','purse','wallet','watch','sunglasses','jewellery','ring',
    'earring','necklace','bracelet','belt','hat','cap','scarf',
    'laptop','phone','mobile','tablet','headphone','earphone','speaker',
    'charger','cable','power bank','keyboard','mouse','pen drive',
    'furniture','curtain','cushion','bedsheet','pillow','blanket',
    'gift','toy',
  ],
  'Entertainment': [
    'entertainment','movie','cinema','theatre','concert','show','event',
    'netflix','spotify','amazon prime','hotstar','youtube','disney',
    'gaming','game','playstation','xbox','steam','pubg',
    'sports','cricket','football','badminton','tennis','gym','fitness',
    'club','pub','bar','nightout','party','picnic','outing','trip',
    'zoo','museum','park','amusement','arcade','bowling','karaoke',
    'bookmyshow','subscription','membership',
  ],
  'Bills':         [
    'bill','bills','electricity','water bill','internet','wifi','broadband',
    'phone bill','mobile bill','postpaid','prepaid','recharge','dth',
    'rent','maintenance','society','housing','emi','loan','mortgage',
    'insurance','premium','policy','tax','challan','fine','penalty',
    'gas','cylinder','lpg','piped gas',
  ],
  'Healthcare':    [
    'health','healthcare','medicine','medicines','tablet','capsule','syrup',
    'doctor','physician','specialist','clinic','hospital',
    'pharmacy','chemist','medplus','apollo pharmacy','netmeds','1mg',
    'medical','test','pathology','blood test','xray','scan','mri',
    'dental','dentist','teeth','eye','optical','glasses','spectacles',
    'vaccine','vaccination','injection','surgery','operation',
    'physiotherapy','therapy','counselling','vitamins','multivitamin','omega',
  ],
  'Education':     [
    'education','school','college','university','tuition','coaching',
    'course','class','lesson','lecture','workshop','seminar','training',
    'udemy','coursera','unacademy','byjus','vedantu',
    'books','textbook','notebook','stationery','exam','fee','admission',
    'library','lab','project','certificate','degree',
  ],
};

/**
 * Detect category from item text (server-side).
 * When no match found, auto-creates a new category in the sheet.
 */
function detectCategory(text) {
  if (!text) return 'Others';
  const lower = text.toLowerCase().trim();

  // Check custom categories from sheet first
  const sheet = getSheet(SHEETS.CATEGORIES);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const catName = data[i][0].toString().trim();
    if (!catName) continue;
    if (lower.includes(catName.toLowerCase())) return catName;
    const kws = (data[i][1] || '').toString().toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    if (kws.some(kw => lower.includes(kw))) return catName;
  }

  // Default category keywords
  for (const [cat, kws] of Object.entries(DEFAULT_CATEGORY_KEYWORDS)) {
    if (lower.includes(cat.toLowerCase())) return cat;
    if (kws.some(kw => lower.includes(kw))) return cat;
  }

  // Auto-create new category from the first word of the item title
  const newCatName = capitalizeWords(lower.split(' ')[0]);
  if (newCatName.length >= 2) {
    addCategoryToSheet(newCatName, lower); // add item text as keyword
  }
  return newCatName;
}

/** Detect payment method from raw query text */
function detectPaymentFromText(text) {
  if (!text) return 'UPI';
  const lower = text.toLowerCase();
  if (/\bcash\b/.test(lower))                                 return 'Cash';
  if (/\bcard\b|\bdebit\b|\bcredit\b/.test(lower))           return 'Card';
  if (/\bupi\b|\bgpay\b|\bpaytm\b|\bphonepe\b/.test(lower))  return 'UPI';
  return 'UPI';
}

/* ============================================================
   DATE UTILITIES (server-side)
   ============================================================ */

function getTodayDDMMYYYY() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`;
}

function getCurrentMonthKey() {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * Parses date context from natural language:
 *  - "yesterday", "today"
 *  - "on 18/04/2026", "18-04-2026"
 * Falls back to current date.
 */
function parseDateContextFromText(text) {
  const lower = (text || '').toLowerCase();
  const now = new Date();
  let d = new Date(now);

  if (/\byesterday\b/.test(lower)) {
    d.setDate(d.getDate() - 1);
  } else if (!/\btoday\b/.test(lower)) {
    const m = lower.match(/\b(?:on\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (m) {
      const day = parseInt(m[1], 10);
      const mon = parseInt(m[2], 10);
      let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      if (year < 100) year += 2000;
      const parsed = new Date(year, mon - 1, day);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }

  const pad = n => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return {
    date: `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`,
    month: `${months[d.getMonth()]}-${d.getFullYear()}`,
  };
}

function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
