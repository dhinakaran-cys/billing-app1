/* Dashboard: KPI cards + charts, backed by /api/dashboard/summary */
const Dashboard = (() => {
  let trendChart = null;
  let topChart = null;
  let loaded = false;

  function fmtMoney(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function chartColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      primary: styles.getPropertyValue('--primary').trim() || '#6366f1',
      primaryFaint: styles.getPropertyValue('--primary-faint').trim() || 'rgba(99,102,241,.15)',
      text: styles.getPropertyValue('--text').trim() || '#1f2937',
      muted: styles.getPropertyValue('--muted').trim() || '#6b7280',
      grid: styles.getPropertyValue('--border').trim() || '#e5e7eb',
      palette: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']
    };
  }

  async function render() {
    const data = await API.getDashboardSummary();
    const c = chartColors();

    document.getElementById('kpiTodayRevenue').textContent = fmtMoney(data.today.revenue);
    document.getElementById('kpiTodayOrders').textContent = data.today.count;
    document.getElementById('kpiAllRevenue').textContent = fmtMoney(data.allTime.revenue);
    document.getElementById('kpiProducts').textContent = data.products.total;
    document.getElementById('kpiLowStock').textContent = data.products.lowStock;

    // ---- Trend chart (last 7 days revenue) ----
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const labels = data.trend.map(t => new Date(t.day).toLocaleDateString(undefined, { weekday: 'short' }));
    const revenues = data.trend.map(t => t.revenue);

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: revenues,
          borderColor: c.primary,
          backgroundColor: c.primaryFaint,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: c.primary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.muted } },
          y: { grid: { color: c.grid }, ticks: { color: c.muted, callback: v => '₹' + v } }
        }
      }
    });

    // ---- Top products chart ----
    const topCtx = document.getElementById('topProductsChart').getContext('2d');
    const topLabels = data.topProducts.map(p => p.name);
    const topQty = data.topProducts.map(p => p.totalQty);

    if (topChart) topChart.destroy();
    topChart = new Chart(topCtx, {
      type: 'bar',
      data: {
        labels: topLabels.length ? topLabels : ['No sales yet'],
        datasets: [{
          label: 'Units sold',
          data: topQty.length ? topQty : [0],
          backgroundColor: c.palette,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: c.grid }, ticks: { color: c.muted } },
          y: { grid: { display: false }, ticks: { color: c.text } }
        }
      }
    });

    // ---- Low stock list ----
    const lowStockEl = document.getElementById('lowStockList');
    lowStockEl.innerHTML = '';
    if (data.lowStockList.length === 0) {
      lowStockEl.innerHTML = '<li class="empty">All stocked up 🎉</li>';
    } else {
      for (const p of data.lowStockList) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.name}</span><span class="badge warn">${p.stock} left</span>`;
        lowStockEl.appendChild(li);
      }
    }

    // ---- Recent sales list ----
    const recentEl = document.getElementById('recentSalesList');
    recentEl.innerHTML = '';
    if (data.recentSales.length === 0) {
      recentEl.innerHTML = '<li class="empty">No sales yet</li>';
    } else {
      for (const s of data.recentSales) {
        const li = document.createElement('li');
        li.innerHTML = `<span>#${s.invoice_no} ${s.customer_name ? '· ' + s.customer_name : ''}</span><span>${fmtMoney(s.grand_total)}</span>`;
        recentEl.appendChild(li);
      }
    }

    loaded = true;
  }

  function refreshIfActive() {
    const panel = document.getElementById('dashboard');
    if (panel && panel.classList.contains('active')) render();
    else loaded = false;
  }

  return { render, refreshIfActive };
})();
