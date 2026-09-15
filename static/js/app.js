/**
 * app.js - Frontend JavaScript Controller
 * ========================================
 * Manages client-side interactions, asynchronous HTTP requests (Fetch API),
 * Chart.js visualizations, real-time filtering, and modal dialogues.
 * 
 * Written for clear understanding by an MBA student / Python beginner.
 */

// Category Colors Palette for visual consistency across charts and table badges
const CATEGORY_COLORS = {
    'Food': '#F59E0B',           // Amber
    'Travel': '#06B6D4',         // Cyan
    'Shopping': '#EC4899',       // Pink
    'Education': '#8B5CF6',      // Violet
    'Bills': '#F43F5E',          // Rose / Coral
    'Entertainment': '#3B82F6',  // Blue
    'Other': '#94A3B8'           // Slate / Gray
};

// Global state for charts and active filters
let categoryChartInstance = null;
let trendChartInstance = null;
let activeCategory = 'All';
let pendingDeleteId = null;
let searchDebounceTimer = null;
let currentHistoryMonths = 6;
let currentHistoryStartMonth = null;
let currentHistoryEndMonth = null;

// ==========================================
// DOM Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Theme Switcher (Dark / Light Mode)
    initThemeToggle();

    // Initialize profile display name from localStorage (defaults to "Parshant Sharma")
    initUserProfileName();

    // Set default date in Add Expense modal to today
    const addDateInput = document.getElementById('add-date');
    if (addDateInput) {
        const todayStr = new Date().toISOString().split('T')[0];
        addDateInput.value = todayStr;
    }

    // Attach Event Listeners
    setupEventListeners();

    // Initial Load of Dashboard Data & Expenses
    loadDashboard();
});

// ==========================================
// Event Listeners Setup
// ==========================================
function setupEventListeners() {
    // Header Actions
    const btnAdd = document.getElementById('btn-open-add-modal');
    if (btnAdd) btnAdd.addEventListener('click', () => openModal('modal-add-expense'));

    const btnLedgerAdd = document.getElementById('btn-ledger-add');
    if (btnLedgerAdd) btnLedgerAdd.addEventListener('click', () => openModal('modal-add-expense'));

    const btnBudget = document.getElementById('btn-open-budget-modal');
    if (btnBudget) btnBudget.addEventListener('click', () => openModal('modal-budget'));

    const btnBudgetInline = document.getElementById('btn-edit-budget-inline');
    if (btnBudgetInline) btnBudgetInline.addEventListener('click', () => openModal('modal-budget'));

    const btnClearAll = document.getElementById('btn-open-clear-all');
    if (btnClearAll) btnClearAll.addEventListener('click', () => openModal('modal-clear-all'));

    const btnConfirmClearAll = document.getElementById('btn-confirm-clear-all');
    if (btnConfirmClearAll) btnConfirmClearAll.addEventListener('click', handleConfirmClearAll);

    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) btnExport.addEventListener('click', () => { window.location.href = '/api/export'; });

    // Clickable Profile Name: Opens "Edit Name" Modal
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) {
        profileTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            openEditNameModal();
        });

        profileTrigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEditNameModal();
            }
        });
    }

    // Form Edit Name Submit Handler
    const formEditName = document.getElementById('form-edit-name');
    if (formEditName) {
        formEditName.addEventListener('submit', handleSaveProfileName);
    }

    // Modal Close Triggers (Backdrop & 'x' buttons)
    document.querySelectorAll('[data-close="modal"]').forEach(el => {
        el.addEventListener('click', () => closeAllModals());
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });

    // Forms Submissions
    const formAdd = document.getElementById('form-add-expense');
    if (formAdd) formAdd.addEventListener('submit', handleAddExpense);

    const formEdit = document.getElementById('form-edit-expense');
    if (formEdit) formEdit.addEventListener('submit', handleEditExpense);

    const formBudget = document.getElementById('form-budget');
    if (formBudget) formBudget.addEventListener('submit', handleUpdateBudget);

    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', handleConfirmDelete);

    // Live Search with Debounce
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (searchClearBtn) searchClearBtn.classList.toggle('hidden', query.length === 0);

            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadExpenses();
            }, 250);
        });
    }

    if (searchClearBtn && searchInput) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchClearBtn.classList.add('hidden');
            loadExpenses();
        });
    }

    // Date Range Filters
    const filterStart = document.getElementById('filter-start-date');
    if (filterStart) filterStart.addEventListener('change', () => {
        const quickSelect = document.getElementById('quick-month-select');
        if (quickSelect) quickSelect.value = '';
        loadExpenses();
    });

    const filterEnd = document.getElementById('filter-end-date');
    if (filterEnd) filterEnd.addEventListener('change', () => {
        const quickSelect = document.getElementById('quick-month-select');
        if (quickSelect) quickSelect.value = '';
        loadExpenses();
    });

    // Quick Month Selector
    const quickMonthSelect = document.getElementById('quick-month-select');
    if (quickMonthSelect) {
        quickMonthSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const label = e.target.options[e.target.selectedIndex]?.text || val;
            filterByMonthKey(val, label);
        });
    }

    // History Month Range Preset Buttons (3M, 6M, 1Y)
    document.querySelectorAll('.history-range-btn[data-months]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.history-range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentHistoryMonths = parseInt(btn.getAttribute('data-months'), 10) || 6;
            currentHistoryStartMonth = null;
            currentHistoryEndMonth = null;

            const customBar = document.getElementById('history-custom-bar');
            if (customBar) customBar.classList.add('hidden');

            loadSummary();
        });
    });

    // Custom Month Range Toggle & Actions in History
    const btnToggleCustom = document.getElementById('btn-toggle-custom-months');
    const historyCustomBar = document.getElementById('history-custom-bar');
    if (btnToggleCustom && historyCustomBar) {
        btnToggleCustom.addEventListener('click', () => {
            const isHidden = historyCustomBar.classList.toggle('hidden');
            if (!isHidden) {
                const sInput = document.getElementById('history-start-month');
                const eInput = document.getElementById('history-end-month');
                const now = new Date();
                const currM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const pastDt = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                const pastM = `${pastDt.getFullYear()}-${String(pastDt.getMonth() + 1).padStart(2, '0')}`;

                if (sInput && !sInput.value) sInput.value = pastM;
                if (eInput && !eInput.value) eInput.value = currM;
            }
        });
    }

    const btnApplyHistory = document.getElementById('btn-apply-history-range');
    if (btnApplyHistory) {
        btnApplyHistory.addEventListener('click', () => {
            const sInput = document.getElementById('history-start-month');
            const eInput = document.getElementById('history-end-month');
            const sVal = sInput ? sInput.value.trim() : '';
            const eVal = eInput ? eInput.value.trim() : '';

            if (!sVal || !eVal) {
                showToast('Please select both From and To months', 'error');
                return;
            }

            currentHistoryStartMonth = sVal;
            currentHistoryEndMonth = eVal;

            document.querySelectorAll('.history-range-btn').forEach(b => b.classList.remove('active'));
            if (btnToggleCustom) btnToggleCustom.classList.add('active');

            loadSummary();
            showToast(`Loaded trend for ${sVal} to ${eVal}`, 'info');
        });
    }

    const btnCloseHistory = document.getElementById('btn-close-history-range');
    if (btnCloseHistory && historyCustomBar) {
        btnCloseHistory.addEventListener('click', () => {
            historyCustomBar.classList.add('hidden');
        });
    }

    // Reset Filters Button
    const btnResetFilters = document.getElementById('btn-reset-filters');
    if (btnResetFilters) btnResetFilters.addEventListener('click', resetFilters);

    const btnEmptyReset = document.getElementById('empty-state-reset-btn');
    if (btnEmptyReset) btnEmptyReset.addEventListener('click', resetFilters);

    // Category Pill Buttons
    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeCategory = e.currentTarget.getAttribute('data-category');
            loadExpenses();
        });
    });
}

// ==========================================
// Core Data Fetchers
// ==========================================

/**
 * Loads both summary statistics and the transactions list.
 */
async function loadDashboard() {
    await Promise.all([
        loadSummary(),
        loadExpenses()
    ]);
}

/**
 * Fetches analytics summary from Flask backend (/api/summary)
 * and updates KPI cards, budget status, charts, and insights.
 */
async function loadSummary() {
    try {
        const params = new URLSearchParams();
        if (currentHistoryStartMonth && currentHistoryEndMonth) {
            params.append('start_month', currentHistoryStartMonth);
            params.append('end_month', currentHistoryEndMonth);
        } else {
            params.append('trend_months', currentHistoryMonths);
        }

        const res = await fetch(`/api/summary?${params.toString()}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error || 'Failed to fetch summary');

        const data = json.data;
        updateKpiCards(data);
        updateBudgetSection(data.budget);
        renderCategoryChart(data.category_breakdown);
        renderTrendChart(data.monthly_trend);
        renderInsights(data.insights);
        if (data.available_months) {
            populateQuickMonthSelect(data.available_months);
        }

    } catch (err) {
        console.error('Error fetching dashboard summary:', err);
        showToast('Error loading financial analytics', 'error');
    }
}

/**
 * Fetches filtered expenses from Flask backend (/api/expenses)
 * and populates the transactions table.
 */
async function loadExpenses() {
    const search = document.getElementById('search-input').value.trim();
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (activeCategory && activeCategory !== 'All') params.append('category', activeCategory);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    try {
        const res = await fetch(`/api/expenses?${params.toString()}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error || 'Failed to fetch expenses');

        renderExpensesTable(json.expenses);

    } catch (err) {
        console.error('Error fetching expenses:', err);
        showToast('Error loading transactions', 'error');
    }
}

// ==========================================
// DOM Render Functions
// ==========================================

/**
 * Updates the 4 KPI cards at the top of the dashboard and ledger stats if on transactions page.
 */
function updateKpiCards(data) {
    // If on Transactions page, update quick ledger stats
    const ledgerTotalEl = document.getElementById('ledger-total-amount');
    const ledgerCountEl = document.getElementById('ledger-total-count');
    if (ledgerTotalEl) ledgerTotalEl.textContent = formatCurrency(data.total_expenses);
    if (ledgerCountEl) ledgerCountEl.textContent = `${data.total_transactions} items`;

    // 1. Total Expenses (Dashboard)
    const kpiTotal = document.getElementById('kpi-total-expenses');
    if (!kpiTotal) return; // Exit if not on Dashboard

    kpiTotal.textContent = formatCurrency(data.total_expenses);

    // 2. This Month's Expenses
    const kpiMonth = document.getElementById('kpi-month-expenses');
    if (kpiMonth) kpiMonth.textContent = formatCurrency(data.this_month_expenses);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonthLabel = monthNames[new Date().getMonth()] + ' ' + new Date().getFullYear();
    const kpiMonthName = document.getElementById('kpi-month-name');
    if (kpiMonthName) kpiMonthName.textContent = currentMonthLabel;

    const kpiMonthCount = document.getElementById('kpi-month-count');
    if (kpiMonthCount) kpiMonthCount.textContent = `${data.this_month_count} items`;

    // 3. Transactions Count & Average Ticket
    const kpiTxCount = document.getElementById('kpi-transactions-count');
    if (kpiTxCount) kpiTxCount.textContent = data.total_transactions;

    const avg = data.total_transactions > 0 ? (data.total_expenses / data.total_transactions) : 0;
    const kpiAvgTx = document.getElementById('kpi-avg-transaction');
    if (kpiAvgTx) kpiAvgTx.textContent = `Avg: ${formatCurrency(avg)} / txn`;

    // 4. Highest Category
    const topCat = data.highest_category;
    const kpiHighCat = document.getElementById('kpi-highest-category');
    if (kpiHighCat) kpiHighCat.textContent = topCat.name;

    const kpiHighAmt = document.getElementById('kpi-highest-amount');
    if (kpiHighAmt) kpiHighAmt.textContent = formatCurrency(topCat.amount);

    const topPct = data.total_expenses > 0 ? ((topCat.amount / data.total_expenses) * 100).toFixed(1) : 0;
    const kpiHighPct = document.getElementById('kpi-highest-pct');
    if (kpiHighPct) kpiHighPct.textContent = `${topPct}% of total spend`;
}

/**
 * Updates the Monthly Budget section with dynamic progress bar and color-coded alert.
 */
function updateBudgetSection(budget) {
    const spentEl = document.getElementById('budget-spent-val');
    const capEl = document.getElementById('budget-cap-val');
    const pctEl = document.getElementById('budget-pct-val');
    const progressBar = document.getElementById('budget-progress-bar');
    const statusPill = document.getElementById('budget-status-pill');
    const alertBanner = document.getElementById('budget-alert-banner');
    const alertText = document.getElementById('budget-alert-text');
    const alertIcon = document.getElementById('budget-alert-icon');
    const modalBudgetInput = document.getElementById('budget-input-val');

    if (modalBudgetInput) modalBudgetInput.value = budget.limit;

    // If budget card elements don't exist on this page, exit early
    if (!spentEl || !capEl || !progressBar || !statusPill || !alertBanner) return;

    spentEl.textContent = formatCurrency(budget.spent);
    capEl.textContent = formatCurrency(budget.limit);
    if (pctEl) pctEl.textContent = `${budget.percentage}% Used`;

    // Constrain bar width visually between 0% and 100%
    const barWidth = Math.min(100, Math.max(0, budget.percentage));
    progressBar.style.width = `${barWidth}%`;

    // Reset status classes
    statusPill.className = 'status-pill';
    progressBar.className = 'progress-fill';
    alertBanner.className = 'alert-banner';

    if (budget.status === 'danger') {
        statusPill.classList.add('status-danger');
        statusPill.textContent = 'Over Budget';
        progressBar.classList.add('fill-danger');
        alertBanner.classList.add('alert-danger');
        alertIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
    } else if (budget.status === 'warning') {
        statusPill.classList.add('status-warning');
        statusPill.textContent = 'Warning';
        progressBar.classList.add('fill-warning');
        alertBanner.classList.add('alert-warning');
        alertIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        `;
    } else {
        statusPill.classList.add('status-safe');
        statusPill.textContent = 'Safe';
        progressBar.classList.add('fill-safe');
        alertBanner.classList.add('alert-safe');
        alertIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        `;
    }

    alertText.innerHTML = budget.message;
}

/**
 * Populates the Transactions Table with formatted rows and action buttons.
 */
function renderExpensesTable(expenses) {
    const tbody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('empty-state');
    const countBadge = document.getElementById('filtered-count');

    tbody.innerHTML = '';
    countBadge.textContent = expenses.length;

    if (expenses.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        const catColor = CATEGORY_COLORS[exp.category] || '#94A3B8';

        tr.innerHTML = `
            <td>
                <span class="category-badge badge-${exp.category.toLowerCase()}">
                    <span class="badge-dot" style="background-color: ${catColor};"></span>
                    ${getCategoryIcon(exp.category)} ${escapeHtml(exp.category)}
                </span>
            </td>
            <td>
                <span class="transaction-desc">${escapeHtml(exp.title)}</span>
            </td>
            <td>
                <span class="transaction-date">${formatDate(exp.date)}</span>
            </td>
            <td class="text-right amount-col">
                -${formatCurrency(exp.amount)}
            </td>
            <td class="text-center">
                <div class="action-btns">
                    <button class="btn-icon btn-edit" title="Edit Transaction" onclick="handleOpenEdit(${exp.id})">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" title="Delete Transaction" onclick="handleOpenDelete(${exp.id}, '${escapeHtml(exp.title.replace(/'/g, "\\'"))}')">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Renders executive spending insights.
 */
function renderInsights(insights) {
    const container = document.getElementById('insights-list-container');
    if (!container) return; // Exit if not on Dashboard

    container.innerHTML = '';

    if (!insights || insights.length === 0) {
        container.innerHTML = '<div class="insight-item"><div class="insight-text">No insights available yet.</div></div>';
        return;
    }

    insights.forEach(text => {
        const item = document.createElement('div');
        item.className = 'insight-item';
        item.innerHTML = `
            <div class="insight-bullet"></div>
            <div class="insight-text">${text}</div>
        `;
        container.appendChild(item);
    });
}

// ==========================================
// Chart.js Visualizations
// ==========================================

/**
 * Renders the Category Breakdown Donut Chart.
 */
function renderCategoryChart(categories) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return; // Exit if not on Dashboard

    const ctx = canvas.getContext('2d');
    const legendContainer = document.getElementById('category-legend');
    if (legendContainer) legendContainer.innerHTML = '';

    if (!categories || categories.length === 0) {
        if (categoryChartInstance) categoryChartInstance.destroy();
        if (legendContainer) legendContainer.innerHTML = '<span class="meta-note">No expense data to display chart.</span>';
        return;
    }

    const labels = categories.map(c => c.category);
    const dataVals = categories.map(c => c.total);
    const bgColors = categories.map(c => CATEGORY_COLORS[c.category] || '#94A3B8');

    // Populate custom legend pills
    if (legendContainer) {
        categories.forEach(c => {
            const color = CATEGORY_COLORS[c.category] || '#94A3B8';
            const pill = document.createElement('div');
            pill.className = 'legend-pill';
            pill.innerHTML = `
                <span class="legend-dot" style="background-color: ${color};"></span>
                <span>${c.category} (${c.percentage}%)</span>
            `;
            legendContainer.appendChild(pill);
        });
    }

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    const donutBorder = isDark ? '#0E1524' : '#FFFFFF';
    const tooltipBg = isDark ? '#151F33' : '#FFFFFF';
    const tooltipTitle = isDark ? '#F8FAFC' : '#0F172A';
    const tooltipBody = isDark ? '#94A3B8' : '#475569';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)';

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: bgColors,
                borderColor: donutBorder,
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: tooltipTitle,
                    bodyColor: tooltipBody,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the Monthly Trend Bar Chart.
 */
function renderTrendChart(trends) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return; // Exit if not on Dashboard

    const ctx = canvas.getContext('2d');

    if (!trends || trends.length === 0) {
        if (trendChartInstance) trendChartInstance.destroy();
        return;
    }

    const labels = trends.map(t => t.month_label);
    const dataVals = trends.map(t => t.total);

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    const tickColor = isDark ? '#94A3B8' : '#64748B';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.06)';
    const tooltipBg = isDark ? '#151F33' : '#FFFFFF';
    const tooltipTitle = isDark ? '#F8FAFC' : '#0F172A';
    const tooltipBody = isDark ? '#94A3B8' : '#475569';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)';

    // Create a subtle gradient for bars
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
    gradient.addColorStop(1, isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)');

    trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Spend (₹)',
                data: dataVals,
                backgroundColor: gradient,
                borderColor: '#6366F1',
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 28
            }]
        },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const clicked = trends[index];
                        if (clicked && clicked.month_key) {
                            filterByMonthKey(clicked.month_key, clicked.month_label);
                        }
                    }
                },
                onHover: (event, chartElement) => {
                    if (event && event.native && event.native.target) {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: tickColor,
                            font: { family: 'Plus Jakarta Sans', size: 12 }
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor,
                            drawBorder: false
                        },
                        ticks: {
                            color: tickColor,
                            font: { family: 'Plus Jakarta Sans', size: 11 },
                            callback: function(val) {
                                return '₹' + val.toLocaleString('en-IN');
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipTitle,
                        bodyColor: tooltipBody,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return ` Total Spend: ${formatCurrency(context.raw)}`;
                            },
                            afterLabel: function() {
                                return '👉 Click bar to view & edit month records';
                            }
                        }
                    }
                }
            }
        });
    }

// ==========================================
// CRUD Actions & Form Submissions
// ==========================================

/**
 * Handles adding a new expense transaction.
 */
async function handleAddExpense(e) {
    e.preventDefault();

    const title = document.getElementById('add-title').value.trim();
    const amount = document.getElementById('add-amount').value;
    const category = document.getElementById('add-category').value;
    const date = document.getElementById('add-date').value;

    const btn = document.getElementById('btn-submit-add');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, amount, category, date })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to save expense');

        showToast('Expense recorded successfully!', 'success');
        document.getElementById('form-add-expense').reset();
        document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
        closeAllModals();

        // Refresh data
        await loadDashboard();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Expense';
    }
}

/**
 * Opens and pre-fills the Edit modal for a given expense ID.
 */
async function handleOpenEdit(id) {
    try {
        const res = await fetch(`/api/expenses/${id}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error || 'Could not load expense details');

        const exp = json.expense;
        document.getElementById('edit-id').value = exp.id;
        document.getElementById('edit-title').value = exp.title;
        document.getElementById('edit-amount').value = exp.amount;
        document.getElementById('edit-category').value = exp.category;
        document.getElementById('edit-date').value = exp.date;

        openModal('modal-edit-expense');

    } catch (err) {
        showToast(err.message, 'error');
    }
}

/**
 * Handles submitting edited expense data.
 */
async function handleEditExpense(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value.trim();
    const amount = document.getElementById('edit-amount').value;
    const category = document.getElementById('edit-category').value;
    const date = document.getElementById('edit-date').value;

    const btn = document.getElementById('btn-submit-edit');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
        const res = await fetch(`/api/expenses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, amount, category, date })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update expense');

        showToast('Expense updated successfully!', 'success');
        closeAllModals();

        await loadDashboard();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Update Changes';
    }
}

/**
 * Prepares and opens delete confirmation modal.
 */
function handleOpenDelete(id, title) {
    pendingDeleteId = id;
    document.getElementById('delete-item-title').textContent = title;
    openModal('modal-delete');
}

/**
 * Executes deletion of the selected expense.
 */
async function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    const btn = document.getElementById('btn-confirm-delete');
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        const res = await fetch(`/api/expenses/${pendingDeleteId}`, {
            method: 'DELETE'
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to delete expense');

        showToast('Expense removed from records', 'info');
        closeAllModals();
        pendingDeleteId = null;

        await loadDashboard();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Delete Record';
    }
}

/**
 * Updates monthly budget limit.
 */
async function handleUpdateBudget(e) {
    e.preventDefault();

    const budgetVal = document.getElementById('budget-input-val').value;
    const btn = document.getElementById('btn-submit-budget');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch('/api/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ budget: budgetVal })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update budget');

        showToast('Monthly budget updated!', 'success');
        closeAllModals();

        await loadSummary();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Budget Limit';
    }
}


/**
 * Handles clearing all expenses and sample data so user can start fresh.
 */
async function handleConfirmClearAll() {
    const btn = document.getElementById('btn-confirm-clear-all');
    btn.disabled = true;
    btn.textContent = 'Clearing...';

    try {
        const res = await fetch('/api/clear-all', { method: 'POST' });
        const json = await res.json();

        if (!json.success) throw new Error(json.error || 'Failed to clear expenses');

        showToast('All sample expenses removed. Ready for your own data!', 'success');
        closeAllModals();
        resetFilters();
        await loadDashboard();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Yes, Clear Everything';
    }
}

/**
 * Clears search and date filters.
 */
function resetFilters() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');

    const fStart = document.getElementById('filter-start-date');
    if (fStart) fStart.value = '';

    const fEnd = document.getElementById('filter-end-date');
    if (fEnd) fEnd.value = '';

    const qMonth = document.getElementById('quick-month-select');
    if (qMonth) qMonth.value = '';
    
    // Reset active category pill to 'All'
    document.querySelectorAll('.pill-btn').forEach(btn => {
        if (btn.getAttribute('data-category') === 'All') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    activeCategory = 'All';

    loadExpenses();
}

// ==========================================
// Modal Helpers
// ==========================================
function openModal(modalId) {
    closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        // Auto-focus first input if exists
        const input = modal.querySelector('input:not([type="hidden"]), select');
        if (input) setTimeout(() => input.focus(), 50);
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => {
        m.classList.remove('active');
        m.setAttribute('aria-hidden', 'true');
    });
}

// ==========================================
// Toast Notification Utility
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    // Trigger animation in next frame
    requestAnimationFrame(() => toast.classList.add('show'));

    // Remove toast after 3.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// Formatting & Security Helpers
// ==========================================
function formatCurrency(num) {
    const val = parseFloat(num) || 0;
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parts[0];
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[month]} ${day}, ${year}`;
}

function getCategoryIcon(cat) {
    switch(cat) {
        case 'Food': return '🍽️';
        case 'Travel': return '✈️';
        case 'Shopping': return '🛍️';
        case 'Education': return '🎓';
        case 'Bills': return '💡';
        case 'Entertainment': return '🎬';
        default: return '📦';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// User Profile Name Management (localStorage)
// ==========================================
const DEFAULT_USER_NAME = "Parshant Sharma";

/**
 * Retrieves user profile name from localStorage or defaults to "Parshant Sharma".
 */
function getCurrentProfileName() {
    try {
        const stored = localStorage.getItem('user_profile_name');
        if (stored && stored.trim()) return stored.trim();
    } catch (e) {
        console.warn('localStorage access failed:', e);
    }
    return DEFAULT_USER_NAME;
}

/**
 * Initializes profile name display on page load.
 */
function initUserProfileName() {
    const name = getCurrentProfileName();
    updateProfileNameUI(name);
}

/**
 * Updates all profile name elements across header, modals, and avatar alt tags.
 */
function updateProfileNameUI(name) {
    const validName = (name && name.trim()) ? name.trim() : DEFAULT_USER_NAME;

    // Update primary profile display in header
    const profileDisplayName = document.getElementById('profile-display-name');
    if (profileDisplayName) {
        profileDisplayName.textContent = validName;
    }

    // Update any user-name or profile-full-name spans
    document.querySelectorAll('.user-name, .profile-full-name').forEach(el => {
        el.textContent = validName;
    });

    // Update avatar alt text
    const avatarImg = document.getElementById('user-avatar-img');
    if (avatarImg) {
        avatarImg.alt = validName;
    }
}

/**
 * Opens "Edit Name" modal and pre-populates current name.
 */
function openEditNameModal() {
    const currentName = getCurrentProfileName();
    const input = document.getElementById('input-user-name');
    if (input) {
        input.value = currentName;
    }
    openModal('modal-edit-name');
    setTimeout(() => {
        if (input) {
            input.focus();
            input.select();
        }
    }, 60);
}

/**
 * Saves edited profile name to localStorage and updates UI immediately.
 */
function handleSaveProfileName(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('input-user-name');
    const newName = input ? input.value.trim() : '';

    if (!newName) {
        showToast('Please enter a valid name', 'error');
        if (input) input.focus();
        return;
    }

    try {
        localStorage.setItem('user_profile_name', newName);
    } catch (err) {
        console.warn('Could not save name to localStorage:', err);
    }

    // Immediately update header profile section
    updateProfileNameUI(newName);

    // Close modal
    closeAllModals();

    // Show friendly success toast
    showToast('Profile name updated!', 'success');
}

// ==========================================
// Month Range & Quick Filtering Utilities
// ==========================================

/**
 * Dynamically populates the Quick Month dropdowns from backend available_months.
 */
function populateQuickMonthSelect(availableMonths) {
    const selects = document.querySelectorAll('#quick-month-select');
    if (!selects || selects.length === 0 || !availableMonths) return;

    selects.forEach(selectEl => {
        const currentVal = selectEl.value;
        selectEl.innerHTML = '<option value="">📅 All Months</option>';

        availableMonths.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.month_key;
            opt.textContent = `📅 ${m.label}`;
            if (m.month_key === currentVal) opt.selected = true;
            selectEl.appendChild(opt);
        });
    });
}

/**
 * Filters the transactions ledger to a specific month key (YYYY-MM).
 */
function filterByMonthKey(monthKey, monthLabel) {
    const fStart = document.getElementById('filter-start-date');
    const fEnd = document.getElementById('filter-end-date');
    const quickSelect = document.getElementById('quick-month-select');

    if (!monthKey) {
        if (fStart) fStart.value = '';
        if (fEnd) fEnd.value = '';
        if (quickSelect) quickSelect.value = '';
        loadExpenses();
        return;
    }

    try {
        const parts = monthKey.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const lastDay = new Date(year, month, 0).getDate();

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        if (fStart) fStart.value = startDate;
        if (fEnd) fEnd.value = endDate;
        if (quickSelect) quickSelect.value = monthKey;

        loadExpenses();

        const displayLabel = monthLabel ? monthLabel.replace(/^📅\s*/, '') : monthKey;
        showToast(`Filtered records to ${displayLabel}`, 'info');

        const txSection = document.getElementById('transactions-section');
        if (txSection) {
            txSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (err) {
        console.error('Error applying month filter:', err);
    }
}

// ==========================================
// Theme Management (Light / Dark Mode)
// ==========================================

/**
 * Initializes the Theme Toggle functionality, syncing with localStorage and system preference.
 */
function initThemeToggle() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    
    // Determine current active theme
    let currentTheme = localStorage.getItem('apex_theme');
    if (!currentTheme) {
        currentTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    
    // Apply to documentElement
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeToggleUI(currentTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            toggleTheme();
        });
        toggleBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTheme();
            }
        });
    }

    // Listen for OS system theme changes if user hasn't set an explicit preference
    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('apex_theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                updateThemeToggleUI(newTheme);
                updateChartsTheme(newTheme);
            }
        });
    } catch (err) {
        console.warn('System color scheme listener not supported:', err);
    }
}

/**
 * Toggles between 'light' and 'dark' themes with smooth animation and feedback.
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Add temporary transition class for silky smooth color cross-fading
    document.documentElement.classList.add('theme-transitioning');
    
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
        localStorage.setItem('apex_theme', newTheme);
    } catch (e) {
        console.warn('Unable to persist theme to localStorage:', e);
    }

    updateThemeToggleUI(newTheme);
    updateChartsTheme(newTheme);

    // Show feedback toast
    const label = newTheme === 'light' ? 'Light Mode' : 'Dark Mode';
    showToast(`Switched to ${label}`, 'info');

    // Clean up transition class after transition finishes
    setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
    }, 350);
}

/**
 * Updates the theme toggle button ARIA attributes and title tooltip.
 */
function updateThemeToggleUI(theme) {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (!toggleBtn) return;

    const isDark = theme === 'dark';
    const nextThemeLabel = isDark ? 'Light' : 'Dark';
    toggleBtn.setAttribute('title', `Switch to ${nextThemeLabel} Mode`);
    toggleBtn.setAttribute('aria-label', `Switch to ${nextThemeLabel} Mode`);
}

/**
 * Reactively updates Chart.js instances to reflect the new theme colors.
 */
function updateChartsTheme(theme) {
    const isDark = theme === 'dark';

    if (categoryChartInstance) {
        categoryChartInstance.data.datasets[0].borderColor = isDark ? '#0E1524' : '#FFFFFF';
        if (categoryChartInstance.options.plugins && categoryChartInstance.options.plugins.tooltip) {
            categoryChartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#151F33' : '#FFFFFF';
            categoryChartInstance.options.plugins.tooltip.titleColor = isDark ? '#F8FAFC' : '#0F172A';
            categoryChartInstance.options.plugins.tooltip.bodyColor = isDark ? '#94A3B8' : '#475569';
            categoryChartInstance.options.plugins.tooltip.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)';
        }
        categoryChartInstance.update();
    }

    if (trendChartInstance) {
        const scales = trendChartInstance.options.scales;
        const tickColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.06)';

        if (scales && scales.x && scales.x.ticks) {
            scales.x.ticks.color = tickColor;
        }
        if (scales && scales.y) {
            if (scales.y.ticks) scales.y.ticks.color = tickColor;
            if (scales.y.grid) scales.y.grid.color = gridColor;
        }

        if (trendChartInstance.options.plugins && trendChartInstance.options.plugins.tooltip) {
            trendChartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#151F33' : '#FFFFFF';
            trendChartInstance.options.plugins.tooltip.titleColor = isDark ? '#F8FAFC' : '#0F172A';
            trendChartInstance.options.plugins.tooltip.bodyColor = isDark ? '#94A3B8' : '#475569';
            trendChartInstance.options.plugins.tooltip.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)';
        }

        // Update bar gradient
        const canvas = document.getElementById('trendChart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 240);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
            gradient.addColorStop(1, isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)');
            trendChartInstance.data.datasets[0].backgroundColor = gradient;
        }

        trendChartInstance.update();
    }
}



