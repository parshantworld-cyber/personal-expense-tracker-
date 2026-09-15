"""
database.py - Database Layer for Personal Expense Tracker
==========================================================
This module manages all SQLite database operations:
- Connection handling
- Table creation and schema management
- CRUD operations (Create, Read, Update, Delete)
- Analytical aggregations for the finance dashboard
"""

import sqlite3
import os
from datetime import datetime, timedelta

# Path to SQLite database directory & file (supports persistent disk mounts e.g. on Render/Railway)
DB_DIR = os.environ.get('DB_DIR', os.path.dirname(os.path.abspath(__file__)))
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, 'expenses.db')

# Supported expense categories
CATEGORIES = [
    'Food',
    'Travel',
    'Shopping',
    'Education',
    'Bills',
    'Entertainment',
    'Other'
]


def get_db_connection():
    """
    Establishes a connection to the SQLite database.
    row_factory = sqlite3.Row allows accessing columns by name like a dictionary (e.g., row['amount']).
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Initializes the database schema if tables do not exist.
    Creates:
      1. 'expenses': stores individual transactions
      2. 'settings': stores key-value pairs (such as monthly budget limit)
    Also seeds starter data on first initialization so the dashboard is immediately demonstrative.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Create expenses table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Create settings table (for monthly budget, currency, etc.)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)

    # Set default monthly budget if not already set (Default: ₹25,000.00)
    cursor.execute("SELECT value FROM settings WHERE key = 'monthly_budget'")
    row = cursor.fetchone()
    if not row:
        cursor.execute("INSERT INTO settings (key, value) VALUES ('monthly_budget', '25000.00')")
    elif float(row['value']) == 2500.00:
        # Update previous default USD budget to INR equivalent
        cursor.execute("UPDATE settings SET value = '25000.00' WHERE key = 'monthly_budget'")

    # Check if expenses table is empty; if so, populate with clean initial sample data
    cursor.execute("SELECT COUNT(*) as count FROM expenses")
    count = cursor.fetchone()['count']
    if count == 0:
        seed_sample_data(cursor)

    conn.commit()
    conn.close()


def seed_sample_data(cursor):
    """
    Seeds initial realistic MBA student expenses spanning the current month.
    These are clearly labeled as sample data so the user can easily replace or clear them.
    """
    today = datetime.now()
    year = today.year
    month = today.month

    # Helper to generate ISO date strings within current month
    def make_date(day_offset):
        target = today - timedelta(days=day_offset)
        return target.strftime('%Y-%m-%d')

    sample_expenses = [
        ("Financial Modeling Textbook", 120.00, "Education", make_date(2)),
        ("Campus Bistro Lunch & Coffee", 24.50, "Food", make_date(3)),
        ("Monthly Metro Transit Card", 85.00, "Travel", make_date(5)),
        ("High-Speed Fiber Internet", 65.00, "Bills", make_date(7)),
        ("Trader Joe's Weekly Groceries", 112.40, "Food", make_date(8)),
        ("Business Formal Attire (Blazer)", 195.00, "Shopping", make_date(10)),
        ("Weekend Cinema & Streaming", 38.00, "Entertainment", make_date(12)),
        ("Coffee Chat with Alum", 14.25, "Food", make_date(14)),
        ("Harvard Business Review Subscription", 45.00, "Education", make_date(16)),
        ("Uber Airport Ride", 48.50, "Travel", make_date(18)),
        ("Team Project Working Dinner", 76.80, "Food", make_date(20)),
        ("Electricity & Utility Bill", 92.30, "Bills", make_date(22)),
    ]

    cursor.executemany(
        "INSERT INTO expenses (title, amount, category, date) VALUES (?, ?, ?, ?)",
        sample_expenses
    )


def get_all_expenses(search=None, category=None, start_date=None, end_date=None):
    """
    Retrieves filtered expenses ordered by date descending.
    Uses parameterized SQL queries to prevent SQL injection vulnerabilities.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM expenses WHERE 1=1"
    params = []

    if search:
        query += " AND (title LIKE ? OR category LIKE ?)"
        wildcard = f"%{search.strip()}%"
        params.extend([wildcard, wildcard])

    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC, id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_expense_by_id(expense_id):
    """Retrieves a single expense by its primary key ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def add_expense(title, amount, category, date):
    """Inserts a new expense record into the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO expenses (title, amount, category, date) VALUES (?, ?, ?, ?)",
        (title.strip(), float(amount), category.strip(), date.strip())
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id


def update_expense(expense_id, title, amount, category, date):
    """Updates an existing expense record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE expenses
        SET title = ?, amount = ?, category = ?, date = ?
        WHERE id = ?
        """,
        (title.strip(), float(amount), category.strip(), date.strip(), expense_id)
    )
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def delete_expense(expense_id):
    """Deletes an expense record by its ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_budget():
    """Retrieves the configured monthly budget limit."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'monthly_budget'")
    row = cursor.fetchone()
    conn.close()
    return float(row['value']) if row else 2500.00


def set_budget(amount):
    """Updates the monthly budget limit in the settings table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO settings (key, value) VALUES ('monthly_budget', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (str(float(amount)),)
    )
    conn.commit()
    conn.close()
    return True


def clear_all_expenses():
    """Wipes all expense records (useful for testing or starting completely fresh)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses")
    conn.commit()
    conn.close()


def reset_sample_data():
    """Clears and re-seeds starter data for demonstration purposes."""
    clear_all_expenses()
    conn = get_db_connection()
    cursor = conn.cursor()
    seed_sample_data(cursor)
    conn.commit()
    conn.close()


def compute_months_range(trend_months=6, start_month=None, end_month=None):
    """
    Computes a chronological list of (month_prefix 'YYYY-MM', month_label 'Mon YYYY').
    Supports explicit start_month & end_month or relative trend_months (e.g. 3, 6, 12).
    """
    now = datetime.now()
    if start_month and end_month:
        try:
            s_dt = datetime.strptime(start_month.strip(), '%Y-%m')
            e_dt = datetime.strptime(end_month.strip(), '%Y-%m')
            if s_dt > e_dt:
                s_dt, e_dt = e_dt, s_dt
            
            # Generate all months between s_dt and e_dt (capped at 36 months)
            months = []
            curr = s_dt
            count = 0
            while curr <= e_dt and count < 36:
                months.append((curr.strftime('%Y-%m'), curr.strftime('%b %Y')))
                year = curr.year + (1 if curr.month == 12 else 0)
                month = 1 if curr.month == 12 else curr.month + 1
                curr = datetime(year, month, 1)
                count += 1
            if months:
                return months
        except Exception:
            pass

    # Default to relative trend_months (e.g. 3, 6, 12)
    count = max(1, min(36, int(trend_months or 6)))
    months = []
    for i in range(count - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        dt = datetime(year, month, 1)
        months.append((dt.strftime('%Y-%m'), dt.strftime('%b %Y')))
    return months


def get_dashboard_summary(trend_months=6, start_month=None, end_month=None):
    """
    Computes key metrics and analytical aggregations for the finance dashboard:
      - Total all-time expenses
      - This month's expenses
      - Number of transactions
      - Highest spending category
      - Monthly budget progress & warning states
      - Category-wise spending breakdown
      - Configurable monthly spending trend (3M, 6M, 12M, or custom month range)
      - Distinct available months for filtering
      - Intelligent spending insights
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now()
    current_month_prefix = now.strftime('%Y-%m')  # e.g. "2026-09"

    # 1. Total All-time Expenses
    cursor.execute("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses")
    total_row = cursor.fetchone()
    total_expenses = float(total_row['total'])
    total_transactions = int(total_row['count'])

    # 2. This Month's Expenses & Transaction Count
    cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date LIKE ?",
        (f"{current_month_prefix}%",)
    )
    month_row = cursor.fetchone()
    this_month_expenses = float(month_row['total'])
    this_month_count = int(month_row['count'])

    # 3. Category Breakdown (Overall)
    cursor.execute(
        """
        SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM expenses
        GROUP BY category
        ORDER BY total DESC
        """
    )
    category_rows = cursor.fetchall()
    category_breakdown = []
    highest_category_name = "N/A"
    highest_category_amount = 0.0

    for idx, row in enumerate(category_rows):
        cat_total = float(row['total'])
        cat_pct = round((cat_total / total_expenses * 100), 1) if total_expenses > 0 else 0
        category_breakdown.append({
            'category': row['category'],
            'total': cat_total,
            'count': row['count'],
            'percentage': cat_pct
        })
        if idx == 0:
            highest_category_name = row['category']
            highest_category_amount = cat_total

    # 4. Monthly Trend (Configurable range)
    month_tuples = compute_months_range(trend_months=trend_months, start_month=start_month, end_month=end_month)
    monthly_trend = []

    for m_prefix, m_label in month_tuples:
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date LIKE ?",
            (f"{m_prefix}%",)
        )
        row = cursor.fetchone()
        m_total = float(row['total'])
        m_count = int(row['count'])
        monthly_trend.append({
            'month_key': m_prefix,
            'month_label': m_label,
            'total': m_total,
            'count': m_count
        })

    # Available distinct months for quick month filtering
    cursor.execute("""
        SELECT DISTINCT substr(date, 1, 7) as m
        FROM expenses
        WHERE date IS NOT NULL AND length(date) >= 7
        ORDER BY m DESC
    """)
    db_months = [row['m'] for row in cursor.fetchall() if row['m']]

    # Build clean list of months including current and recent months plus recorded months
    all_keys = set(db_months)
    for i in range(6):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        all_keys.add(f"{year:04d}-{month:02d}")

    available_months = []
    for m_key in sorted(all_keys, reverse=True):
        try:
            dt = datetime.strptime(m_key, '%Y-%m')
            label = dt.strftime('%B %Y')
            is_current = (m_key == current_month_prefix)
            available_months.append({
                'month_key': m_key,
                'label': f"{label} (Current)" if is_current else label,
                'is_current': is_current
            })
        except Exception:
            pass

    conn.close()

    # 5. Budget Tracking & Warnings
    monthly_budget = get_budget()
    budget_used_pct = round((this_month_expenses / monthly_budget * 100), 1) if monthly_budget > 0 else 0
    budget_remaining = round(monthly_budget - this_month_expenses, 2)

    # Determine status: safe, warning (>80%), danger (>100%)
    if budget_used_pct >= 100:
        budget_status = 'danger'
        budget_message = f"Budget Exceeded! You have exceeded your monthly limit by ₹{abs(budget_remaining):,.2f}."
    elif budget_used_pct >= 80:
        budget_status = 'warning'
        budget_message = f"Attention: You have spent {budget_used_pct}% of your budget. Only ₹{budget_remaining:,.2f} remains."
    else:
        budget_status = 'safe'
        budget_message = f"On Track: You have used {budget_used_pct}% of your monthly budget. ₹{budget_remaining:,.2f} remaining."

    # 6. Generate Intelligent Spending Insights (MBA-style analytics)
    insights = []

    if total_transactions == 0:
        insights.append("No transactions logged yet. Add your first expense to generate financial insights.")
    else:
        # Insight 1: Highest category dominance
        if highest_category_name != "N/A" and total_expenses > 0:
            pct = round((highest_category_amount / total_expenses) * 100, 1)
            insights.append(
                f"**Category Concentration**: <strong>{highest_category_name}</strong> is your primary expenditure driver, representing <strong>{pct}%</strong> (₹{highest_category_amount:,.2f}) of all tracked spending."
            )

        # Insight 2: Daily burn rate for the current month
        days_passed = max(1, now.day)
        daily_burn = round(this_month_expenses / days_passed, 2)
        projected_month_spend = round(daily_burn * 30, 2)
        insights.append(
            f"**Daily Burn Rate**: You are spending an average of <strong>₹{daily_burn:,.2f} per day</strong> this month. At this pace, projected 30-day spending is <strong>₹{projected_month_spend:,.2f}</strong>."
        )

        # Insight 3: Budget runway
        if monthly_budget > 0:
            if budget_remaining > 0:
                days_left = 30 - days_passed
                daily_allowance = round(budget_remaining / max(1, days_left), 2)
                insights.append(
                    f"**Remaining Budget Runway**: You have <strong>₹{budget_remaining:,.2f}</strong> remaining this month (~₹{daily_allowance:,.2f}/day for the rest of the month)."
                )
            else:
                insights.append(
                    f"**Budget Deficit**: Spending is <strong>₹{abs(budget_remaining):,.2f} over budget</strong>. Consider deferring discretionary purchases until next month."
                )

        # Insight 4: Average ticket size
        avg_ticket = round(total_expenses / total_transactions, 2)
        insights.append(
            f"**Transaction Volume**: Across <strong>{total_transactions}</strong> recorded transactions, your average expense ticket size is <strong>₹{avg_ticket:,.2f}</strong>."
        )

    return {
        'total_expenses': total_expenses,
        'this_month_expenses': this_month_expenses,
        'total_transactions': total_transactions,
        'this_month_count': this_month_count,
        'highest_category': {
            'name': highest_category_name,
            'amount': highest_category_amount
        },
        'budget': {
            'limit': monthly_budget,
            'spent': this_month_expenses,
            'remaining': budget_remaining,
            'percentage': budget_used_pct,
            'status': budget_status,
            'message': budget_message
        },
        'category_breakdown': category_breakdown,
        'monthly_trend': monthly_trend,
        'available_months': available_months,
        'insights': insights
    }
