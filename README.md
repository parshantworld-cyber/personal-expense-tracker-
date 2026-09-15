# Apex - Personal Expense Tracker & Financial Intelligence

A modern, fintech-grade personal expense tracking web application built with **Python (Flask)**, **SQLite**, **HTML5**, **Vanilla CSS**, and **JavaScript (Chart.js)**. Designed with executive analytics, clean minimalism, and responsive dark-mode aesthetics suitable for MBA finance presentations.

---

## 🚀 Quick Start Guide

### 1. Requirements
- Python 3.10+ (Python 3.12 is already installed on your system)
- Web browser (Chrome, Edge, Safari, Firefox)

### 2. Running the Application
Open PowerShell or Command Prompt in this folder:
```powershell
# Navigate to this directory (if not already there)
cd "d:\Personal expense tracker"

# Run the Flask app
python app.py
```

Now open your web browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📁 Project Architecture & File Breakdown

| File | Purpose |
|---|---|
| **`app.py`** | **Flask Controller & API**: Handles incoming HTTP requests, defines REST API endpoints (`/api/summary`, `/api/expenses`, `/api/budget`, `/api/export`), and serves the front-end view. |
| **`database.py`** | **SQLite Database Layer**: Handles database connection, automatic table creation (`expenses` and `settings`), parameterized SQL queries, CRUD operations, budget tracking, and analytics aggregations. |
| **`expenses.db`** | **SQLite Database File**: Auto-generated permanent database storing all transactions and settings locally. |
| **`templates/index.html`** | **Dashboard View**: Semantic HTML5 template defining the executive dashboard, KPI metric cards, budget health bar, and Chart.js visualizations. |
| **`templates/transactions.html`** | **Dedicated Transactions View**: Full-screen transaction ledger with search, category/date filters, and CRUD action triggers. |
| **`static/css/style.css`** | **Fintech Design System**: Obsidian/dark-navy palette, luminous color badges, glassmorphism cards, glowing status pills, and responsive layout rules. |
| **`static/js/app.js`** | **Client-Side Logic**: Manages async `fetch()` API calls to Python, renders interactive Chart.js donut and bar charts, handles live search debounce, category filters, and modal dialogues. |
| **`test_app.py`** | **Automated Test Suite**: Unit and integration tests covering database queries, CRUD cycles, budget alert calculations, and CSV export. |
| **`requirements.txt`** | **Dependencies**: Lists Python packages required by the application (`Flask>=3.0.0`). |

---

## 💡 Key Features

1. **Executive Dashboard & KPIs**:
   - **Total Spend**: Cumulative expenditures tracked.
   - **This Month's Spending**: Real-time spending for the active calendar month.
   - **Transaction Count**: Activity volume and average spend per transaction.
   - **Top Category**: Automatically detects the category with the highest financial drain.

2. **Monthly Budget Tracker & Intelligent Warnings**:
   - Set or adjust your monthly expenditure limit at any time.
   - Dynamic progress bar showing the exact percentage of budget consumed.
   - **Tri-State Health Indicator**:
     - 🟢 **Safe** (< 80% used)
     - 🟡 **Warning** (80% - 99% used)
     - 🔴 **Budget Exceeded** (≥ 100% used) with alert banner calculating exact overspend.

3. **Interactive Visual Analytics (Chart.js)**:
   - **Category Donut Chart**: Hover-enabled slice inspection with custom legend badges.
   - **6-Month Trend Bar Chart**: Historical expenditure trajectory over time.

4. **Executive Spending Insights**:
   - Automated financial observations (category concentration, daily burn rate, projected month-end expenditure, remaining budget runway).

5. **Expense Management (CRUD & Filters)**:
   - **Add Expense**: Modal input with description, amount, category, and date.
   - **Edit Expense**: Pre-filled update modal.
   - **Delete Expense**: Permanent deletion with confirmation.
   - **Real-Time Search**: Instant keystroke filtering across transaction descriptions.
   - **Category Pills**: Filter by Food, Travel, Shopping, Education, Bills, Entertainment, or Other.
   - **Date Range**: Filter between specific dates.
   - **Export to CSV**: Instant spreadsheet download formatted for Microsoft Excel financial modeling.

---

## 🧪 Running the Automated Test Suite

To verify all features, routes, and database operations programmatically:
```powershell
python test_app.py
```
Expected output:
```text
Ran 8 tests in 0.100s
OK
```

---

## 🌐 Cloud Deployment (Render & Railway)

This project is pre-configured for 1-click cloud deployment:
- **`Procfile`**: Process definition for Render / Railway (`web: gunicorn app:app`)
- **`render.yaml`**: Infrastructure blueprint for Render
- **`Dockerfile`**: Universal container build for any cloud or Docker VPS
- See [`DEPLOYMENT.md`](file:///d:/Personal%20expense%20tracker/DEPLOYMENT.md) for step-by-step instructions.
