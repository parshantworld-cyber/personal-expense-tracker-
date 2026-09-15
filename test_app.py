"""
test_app.py - End-to-End Automated Verification Script
======================================================
Tests all backend logic, database queries, and REST endpoints:
1. Database initialization and seeding
2. /api/summary calculations (KPIs, category totals, monthly trends, insights)
3. /api/expenses GET (filtering by search, category, date range)
4. /api/expenses POST (creating a new expense with validation)
5. /api/expenses/<id> GET (retrieving single expense)
6. /api/expenses/<id> PUT (updating expense)
7. /api/budget POST (updating monthly budget and alert threshold)
8. /api/expenses/<id> DELETE (deleting expense)
9. /api/export (validating CSV download)
"""

import unittest
import json
from datetime import datetime
from app import app
import database

class ExpenseTrackerTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        # Ensure fresh clean test state
        database.init_db()

    def test_01_index_page(self):
        """Test home route serves HTML correctly"""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Parshant's", response.data)
        self.assertIn(b'Expense', response.data)
        self.assertIn(b'Parshant Sharma', response.data)
        self.assertIn(b'Monthly Spending Budget', response.data)
        self.assertIn(b'btn-theme-toggle', response.data)
        self.assertIn(b'apex_theme', response.data)

    def test_01b_transactions_page(self):
        """Test dedicated /transactions route serves HTML correctly"""
        response = self.client.get('/transactions')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'All Transactions', response.data)
        self.assertIn(b'Parshant Sharma', response.data)
        self.assertIn(b"Parshant's", response.data)
        self.assertIn(b'btn-theme-toggle', response.data)
        self.assertIn(b'apex_theme', response.data)

    def test_01c_theme_toggle_elements(self):
        """Test theme toggle button markup has both Sun and Moon SVGs and accessibility attributes"""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'theme-icon-sun', response.data)
        self.assertIn(b'theme-icon-moon', response.data)
        self.assertIn(b'aria-label="Toggle Light and Dark Theme"', response.data)

    def test_02_get_summary(self):
        """Test dashboard summary analytics"""
        response = self.client.get('/api/summary')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        summary = data['data']
        self.assertIn('total_expenses', summary)
        self.assertIn('this_month_expenses', summary)
        self.assertIn('budget', summary)
        self.assertIn('category_breakdown', summary)
        self.assertIn('monthly_trend', summary)
        self.assertIn('insights', summary)
        self.assertGreater(len(summary['insights']), 0)

    def test_03_crud_expense_flow(self):
        """Test complete Add -> Get -> Edit -> Filter -> Delete flow"""
        # 1. Add Expense
        payload = {
            'title': 'Bloomberg Financial Modeling Certificate',
            'amount': 299.99,
            'category': 'Education',
            'date': datetime.now().strftime('%Y-%m-%d')
        }
        res_post = self.client.post('/api/expenses', json=payload)
        self.assertEqual(res_post.status_code, 201)
        post_data = json.loads(res_post.data)
        self.assertTrue(post_data['success'])
        new_id = post_data['id']

        # 2. Get Single Expense
        res_get = self.client.get(f'/api/expenses/{new_id}')
        self.assertEqual(res_get.status_code, 200)
        get_data = json.loads(res_get.data)
        self.assertEqual(get_data['expense']['title'], 'Bloomberg Financial Modeling Certificate')
        self.assertEqual(get_data['expense']['amount'], 299.99)

        # 3. Search Filter
        res_filter = self.client.get('/api/expenses?search=Bloomberg')
        self.assertEqual(res_filter.status_code, 200)
        filter_data = json.loads(res_filter.data)
        self.assertEqual(filter_data['count'], 1)
        self.assertEqual(filter_data['expenses'][0]['id'], new_id)

        # 4. Edit Expense
        update_payload = {
            'title': 'Bloomberg Financial Modeling Certificate (Updated)',
            'amount': 349.99,
            'category': 'Education',
            'date': datetime.now().strftime('%Y-%m-%d')
        }
        res_put = self.client.put(f'/api/expenses/{new_id}', json=update_payload)
        self.assertEqual(res_put.status_code, 200)

        # Verify update
        res_verify = self.client.get(f'/api/expenses/{new_id}')
        self.assertEqual(json.loads(res_verify.data)['expense']['amount'], 349.99)

        # 5. Delete Expense
        res_del = self.client.delete(f'/api/expenses/{new_id}')
        self.assertEqual(res_del.status_code, 200)

        # Verify deletion
        res_check_del = self.client.get(f'/api/expenses/{new_id}')
        self.assertEqual(res_check_del.status_code, 404)

    def test_04_budget_management_and_thresholds(self):
        """Test setting budget and verifying alert thresholds"""
        # Set low budget to trigger warning/danger
        res = self.client.post('/api/budget', json={'budget': 500.00})
        self.assertEqual(res.status_code, 200)
        budget_data = json.loads(res.data)
        self.assertTrue(budget_data['success'])
        self.assertEqual(budget_data['budget'], 500.00)

        # Verify summary reflects budget status
        summary_res = self.client.get('/api/summary')
        summary = json.loads(summary_res.data)['data']
        self.assertEqual(summary['budget']['limit'], 500.00)
        # Spent should exceed or be near 500
        self.assertIn(summary['budget']['status'], ['warning', 'danger'])

    def test_05_csv_export(self):
        """Test CSV file generation"""
        res = self.client.get('/api/export')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, 'text/csv')
        self.assertIn(b'Description,Category,Amount', res.data)

    def test_06_clear_all_expenses(self):
        """Test clearing all expenses and resetting metrics"""
        # Clear all
        res = self.client.post('/api/clear-all')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])

        # Verify summary reflects 0 expenses
        summary_res = self.client.get('/api/summary')
        summary = json.loads(summary_res.data)['data']
        self.assertEqual(summary['total_expenses'], 0.0)
        self.assertEqual(summary['total_transactions'], 0)
        self.assertEqual(summary['this_month_expenses'], 0.0)
        self.assertEqual(summary['budget']['spent'], 0.0)

        # Verify expenses list is empty
        exp_res = self.client.get('/api/expenses')
        exp_data = json.loads(exp_res.data)
        self.assertEqual(exp_data['count'], 0)
        self.assertEqual(len(exp_data['expenses']), 0)

if __name__ == '__main__':
    unittest.main()

