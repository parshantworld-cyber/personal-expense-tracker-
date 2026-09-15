"""
app.py - Flask Backend Application
====================================
This is the main entry point for the Personal Expense Tracker web application.
It connects the HTML/CSS/JavaScript frontend with our SQLite database via
RESTful API endpoints and clean template rendering.

For an MBA / Python beginner:
- Flask is a micro-framework that maps URLs (routes) to Python functions.
- When a user visits '/', Flask serves the HTML page.
- When the frontend sends background requests (AJAX/fetch), Flask returns JSON data.
"""

import os
import io
import csv
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response
import database

# Initialize the Flask application
app = Flask(__name__)
# Enable JSON pretty-printing for cleaner debugging
app.json.compact = False
# Disable static file caching so CSS/JS updates reflect immediately
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.after_request
def add_header(response):
    """Ensure browsers do not serve stale cached CSS/JS during development."""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response


# ==========================================
# Application Lifecycle & Database Setup
# ==========================================
# Initialize SQLite database tables automatically on startup
with app.app_context():
    database.init_db()


# ==========================================
# Page Routes (Frontend View)
# ==========================================
@app.route('/')
def index():
    """
    Renders the main dashboard HTML template.
    All dynamic updates (charts, tables, filters) are handled via modern async API calls.
    """
    return render_template('index.html', categories=database.CATEGORIES)


@app.route('/transactions')
def transactions():
    """
    Renders the dedicated Transactions ledger page.
    """
    return render_template('transactions.html', categories=database.CATEGORIES)


# ==========================================
# REST API Endpoints (Data & Operations)
# ==========================================

@app.route('/api/summary', methods=['GET'])
def get_summary():
    """
    Returns high-level finance metrics, budget status, chart datasets,
    configurable monthly spending trend, and spending insights in JSON format.
    Query parameters:
      - trend_months: number of months to include (default 6)
      - start_month: custom starting month (YYYY-MM)
      - end_month: custom ending month (YYYY-MM)
    """
    try:
        trend_months = request.args.get('trend_months', default=6, type=int)
        start_month = request.args.get('start_month', default=None, type=str)
        end_month = request.args.get('end_month', default=None, type=str)

        summary_data = database.get_dashboard_summary(
            trend_months=trend_months,
            start_month=start_month if start_month else None,
            end_month=end_month if end_month else None
        )
        return jsonify({
            'success': True,
            'data': summary_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/expenses', methods=['GET'])
def list_expenses():
    """
    Retrieves expenses with optional search and filtering:
    Query Parameters:
      - search: keyword matched against description or category
      - category: filter by category ('Food', 'Travel', etc.)
      - start_date: filter by minimum date (YYYY-MM-DD)
      - end_date: filter by maximum date (YYYY-MM-DD)
    """
    search = request.args.get('search', '').strip()
    category = request.args.get('category', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()

    expenses = database.get_all_expenses(
        search=search if search else None,
        category=category if category else None,
        start_date=start_date if start_date else None,
        end_date=end_date if end_date else None
    )

    return jsonify({
        'success': True,
        'count': len(expenses),
        'expenses': expenses
    })


@app.route('/api/expenses/<int:expense_id>', methods=['GET'])
def get_single_expense(expense_id):
    """Retrieves a single expense by its ID (useful for pre-filling edit modals)."""
    expense = database.get_expense_by_id(expense_id)
    if not expense:
        return jsonify({'success': False, 'error': 'Expense not found'}), 404
    return jsonify({'success': True, 'expense': expense})


@app.route('/api/expenses', methods=['POST'])
def create_expense():
    """
    Creates a new expense transaction.
    Expects JSON: { "title": "...", "amount": 12.50, "category": "Food", "date": "2026-09-14" }
    """
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    amount = data.get('amount')
    category = data.get('category', '').strip()
    date = data.get('date', '').strip()

    # Validation: Title
    if not title:
        return jsonify({'success': False, 'error': 'Title/description is required'}), 400

    # Validation: Amount
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'success': False, 'error': 'Amount must be greater than zero'}), 400
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Invalid amount value'}), 400

    # Validation: Category
    if category not in database.CATEGORIES:
        return jsonify({'success': False, 'error': f'Category must be one of: {", ".join(database.CATEGORIES)}'}), 400

    # Validation: Date
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')
    else:
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'error': 'Date must be in YYYY-MM-DD format'}), 400

    new_id = database.add_expense(title, amount, category, date)
    return jsonify({
        'success': True,
        'message': 'Expense recorded successfully!',
        'id': new_id
    }), 201


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def edit_expense(expense_id):
    """
    Updates an existing expense transaction.
    Expects JSON: { "title": "...", "amount": 15.00, "category": "Food", "date": "2026-09-14" }
    """
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    amount = data.get('amount')
    category = data.get('category', '').strip()
    date = data.get('date', '').strip()

    if not title:
        return jsonify({'success': False, 'error': 'Title/description is required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'success': False, 'error': 'Amount must be greater than zero'}), 400
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Invalid amount value'}), 400

    if category not in database.CATEGORIES:
        return jsonify({'success': False, 'error': 'Invalid category'}), 400

    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'success': False, 'error': 'Date must be in YYYY-MM-DD format'}), 400

    updated = database.update_expense(expense_id, title, amount, category, date)
    if not updated:
        return jsonify({'success': False, 'error': 'Expense not found or update failed'}), 404

    return jsonify({'success': True, 'message': 'Expense updated successfully!'})


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def remove_expense(expense_id):
    """Deletes an expense record permanently from SQLite."""
    deleted = database.delete_expense(expense_id)
    if not deleted:
        return jsonify({'success': False, 'error': 'Expense not found'}), 404
    return jsonify({'success': True, 'message': 'Expense deleted successfully!'})


@app.route('/api/budget', methods=['GET', 'POST'])
def manage_budget():
    """
    GET: Returns current monthly budget.
    POST: Updates monthly budget limit.
    """
    if request.method == 'GET':
        budget = database.get_budget()
        return jsonify({'success': True, 'budget': budget})

    data = request.get_json() or {}
    try:
        new_budget = float(data.get('budget', 0))
        if new_budget <= 0:
            return jsonify({'success': False, 'error': 'Budget must be greater than zero'}), 400
        database.set_budget(new_budget)
        return jsonify({'success': True, 'message': 'Monthly budget updated successfully!', 'budget': new_budget})
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Invalid budget amount'}), 400


@app.route('/api/export', methods=['GET'])
def export_csv():
    """
    Generates a clean CSV file download containing all tracked transactions,
    perfect for financial analysis in Microsoft Excel or Google Sheets.
    """
    expenses = database.get_all_expenses()

    # Create an in-memory string buffer for CSV generation
    output = io.StringIO()
    writer = csv.writer(output)

    # Write CSV Header
    writer.writerow(['ID', 'Date', 'Description', 'Category', 'Amount (₹)', 'Created At'])

    # Write Data Rows
    for exp in expenses:
        writer.writerow([
            exp['id'],
            exp['date'],
            exp['title'],
            exp['category'],
            f"{exp['amount']:.2f}",
            exp['created_at']
        ])

    csv_data = output.getvalue()
    filename = f"expenses_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


@app.route('/api/reset-sample', methods=['POST'])
def reset_sample():
    """Restores sample data for presentation and demo purposes."""
    database.reset_sample_data()
    return jsonify({'success': True, 'message': 'Sample data restored successfully!'})


@app.route('/api/clear-all', methods=['POST'])
def clear_all():
    """Clears all expenses for a fresh start."""
    database.clear_all_expenses()
    return jsonify({'success': True, 'message': 'All expenses cleared successfully!'})


# ==========================================
# Run Server
# ==========================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() in ['true', '1']
    print("---------------------------------------------------------------")
    print(f"Personal Expense Tracker running on: http://127.0.0.1:{port}")
    print("Press Ctrl+C in terminal to stop.")
    print("---------------------------------------------------------------")
    app.run(host='0.0.0.0', port=port, debug=debug)
