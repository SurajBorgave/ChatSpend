# ChatSpend – NLP Expense Tracker 💬💸

A chatbot-powered expense tracker inspired by [Monefy](https://monefy.me/), built with:
- **Frontend**: HTML + CSS + JavaScript (Vanilla)
- **Chatbot**: Dialogflow ES (free tier) with Dialogflow Messenger
- **Backend**: Google Apps Script (free)
- **Database**: Google Sheets (free)
- **Hosting**: Vercel (free)

---

## 🚀 Features

| Feature | Description |
|---|---|
| **NLP Chatbot** | Type "spent 200 on pizza" to log expenses |
| **Auto Category Detection** | Detects Food, Transport, Shopping, Bills, etc. from item name |
| **Custom Categories** | "add category Gym" |
| **Payment Methods** | UPI (default), Cash, Card |
| **Monthly Budget** | Set budget, track remaining, overspend alert |
| **Full CRUD** | Edit/Delete transactions via UI or chat |
| **Search & Filter** | By title, category, payment method |
| **CSV Export** | Download all transactions |
| **localStorage Fallback** | Works fully offline without backend |
| **Pie Chart** | Category-wise spending (Chart.js) |
| **Dark/Light Theme** | Toggle via navbar |

---

## 📁 Project Structure

```
ChatSpend/
├── index.html      → Main page (Dashboard, Transactions, Categories, Chat Guide)
├── style.css       → Dark glassmorphism UI
├── script.js       → Frontend logic, localStorage, Dialogflow event bridge
├── Code.gs         → Google Apps Script backend (copy this to Apps Script)
├── vercel.json     → Vercel deployment config
└── README.md       → This file
```

---

## 🛠️ Setup Guide (Step-by-Step)

### Step 1 – Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → create a new spreadsheet
2. Create **3 tabs** named exactly:
   - `Transactions`
   - `Categories`
   - `Budget`
3. Copy your **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/**SHEET_ID**/edit`

---

### Step 2 – Deploy Google Apps Script

1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Delete everything in the editor
3. Paste the entire contents of `Code.gs` from this project
4. Replace `YOUR_GOOGLE_SHEETS_ID` with your Sheet ID from Step 1
5. Click **Run → setupSheets()** to initialize sheet headers
   - Grant permissions when prompted
6. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone (even anonymous)**
7. Click **Deploy** → Copy the **Web App URL**

---

### Step 3 – Connect Backend to Frontend

Open `script.js` and replace:
```javascript
const BACKEND_URL = ''; // replace with your Apps Script URL
```
With:
```javascript
const BACKEND_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

---

### Step 4 – Set Up Dialogflow Agent

1. Go to [Dialogflow Console](https://dialogflow.cloud.google.com/)
2. Create a new agent (choose your Google project)
3. Create the following **Intents** with training phrases:

#### Intent: `AddExpense`
Training phrases:
- `spent 200 on pizza`
- `paid 50 for uber via cash`
- `spent 30 on coffee using card`
- `bought shoes for 1500`
- `200 for groceries`

Parameters:
| Parameter | Entity | Required |
|---|---|---|
| `number` | `@sys.number` | yes |
| `any` | `@sys.any` | yes |

#### Intent: `SetBudget`
Training phrases:
- `set budget 5000`
- `my budget is 10000`
- `budget 3000 this month`

Parameters: `number` (@sys.number)

#### Intent: `AddCategory`
Training phrases:
- `add category Gym`
- `create category Travel`
- `new category Groceries`

Parameters: `any` (@sys.any)

#### Intent: `DeleteExpense`
Training phrases:
- `delete pizza`
- `delete last transaction`
- `remove coffee`

Parameters: `any` (@sys.any)

#### Intent: `UpdateExpense`
Training phrases:
- `update pizza to 300`
- `change coffee amount to 80`
- `edit last to 250`

Parameters: `any` (@sys.any), `number` (@sys.number)

#### Intent: `SearchExpense`
Training phrases:
- `search pizza`
- `find coffee`
- `look up uber`

Parameters: `any` (@sys.any)

#### Intent: `ShowSummary`
Training phrases:
- `show summary`
- `monthly report`
- `how much did I spend`
- `budget status`

#### Intent: `ShowFilter`
Training phrases:
- `show food expenses`
- `show cash transactions`
- `show UPI payments`
- `filter by transport`

#### Intent: `UndoLast`
Training phrases:
- `undo last`
- `undo`
- `restore last`

4. Enable **Fulfillment → Webhook** in every intent above
5. Go to **Fulfillment** → Enable Webhook → paste your Apps Script URL

---

### Step 5 – Add Dialogflow Messenger to Site

1. In Dialogflow Console → **Integrations → Dialogflow Messenger**
2. Enable it → copy the `agent-id` (your Project ID)
3. Open `index.html` → find the `<df-messenger>` tag → replace `YOUR_PROJECT_ID`:
```html
<df-messenger
  agent-id="YOUR_ACTUAL_PROJECT_ID"
  ...
```

---

### Step 6 – Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub
3. Select your repo → click **Deploy**
4. Your app is live! 🎉

---

## 💬 Chat Commands Reference

| Command | Example |
|---|---|
| Log expense | `spent 200 on pizza` |
| With payment | `paid 50 for uber via cash` |
| Set budget | `set budget 5000` |
| Add category | `add category Gym` |
| Delete last | `delete last transaction` |
| Delete by name | `delete pizza` |
| Update | `update pizza to 300` |
| Search | `search pizza` |
| Filter by category | `show food expenses` |
| Filter by payment | `show cash transactions` |
| Summary | `show summary` |
| Undo | `undo last` |

---

## 🎨 Color & Design

The app uses a **dark glassmorphism** design with:
- Primary: Deep Navy `#0f0f1a`
- Accent: Purple `#7c3aed` + Cyan `#06b6d4`
- Font: [Inter](https://fonts.google.com/specimen/Inter)
- Charts: [Chart.js](https://www.chartjs.org/)

---

## ⚡ localStorage-Only Mode

If you don't connect the backend, the app **still works fully**:
- Add expenses via the Quick Add form
- All data persists in your browser's localStorage
- Charts, filters, budget tracking all work
- Export to CSV works

> **Note**: localStorage data is browser-specific and not synced across devices.

---

## 📝 Google Sheets Column Reference

### Transactions Sheet
| Column | Content |
|---|---|
| A | ID (tx_timestamp_random) |
| B | Title |
| C | Amount |
| D | Category |
| E | PaymentMethod |
| F | Date (dd-mm-yyyy) |
| G | Month (mmm-yyyy) |
| H | Timestamp (ISO) |

### Categories Sheet
| Column | Content |
|---|---|
| A | CategoryName |
| B | Keywords (comma-separated) |

### Budget Sheet
| Column | Content |
|---|---|
| A | Month (mmm-yyyy) |
| B | BudgetAmount |

---

## 🔧 Troubleshooting

**Chat not working?**
- Check that `agent-id` in `index.html` matches your Dialogflow Project ID
- Ensure Dialogflow Messenger integration is enabled

**Webhook not responding?**
- Ensure Apps Script is deployed as "Anyone (even anonymous)"
- Check Apps Script execution logs (`View → Logs`)
- Verify `SHEET_ID` is correct

**Data not syncing?**
- Check browser console for CORS errors
- Apps Script Web App must have "Anyone" access
- Try localStorage-only mode first to verify UI works

---

## 📄 License

Free to use for personal and educational projects.

---

*Built with ❤️ using only free tools: Dialogflow, Google Apps Script, Google Sheets & Vercel*
