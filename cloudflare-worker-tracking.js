/*==========================================================================
  CLOUDFLARE WORKER - PWA INSTALL TRACKING
  Add this to your existing worker or deploy as separate endpoint
  ==========================================================================*/

import { corsHeaders } from './cors';

/**
 * Track PWA install
 */
export async function handleTrackInstall(request, env) {
  try {
    const installData = await request.json();

    // Increment total install counter
    const totalKey = 'total-installs';
    const currentTotal = await env.ANALYTICS.get(totalKey) || '0';
    const newTotal = parseInt(currentTotal) + 1;
    await env.ANALYTICS.put(totalKey, newTotal.toString());

    // Store install with timestamp for analytics
    const installId = `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await env.ANALYTICS.put(installId, JSON.stringify({
      timestamp: installData.timestamp,
      userAgent: installData.userAgent,
      platform: installData.platform,
      standalone: installData.standalone
    }), {
      expirationTtl: 365 * 24 * 60 * 60 // Keep for 1 year
    });

    // Increment monthly counter
    const monthKey = `installs-${new Date().toISOString().slice(0, 7)}`; // e.g., "installs-2025-01"
    const monthCount = await env.ANALYTICS.get(monthKey) || '0';
    await env.ANALYTICS.put(monthKey, (parseInt(monthCount) + 1).toString());

    console.log(`Install tracked: Total=${newTotal}, Month=${monthKey}`);

    return new Response(JSON.stringify({
      success: true,
      totalInstalls: newTotal
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Track install error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get install statistics
 */
export async function handleGetStats(request, env) {
  try {
    // Get total installs
    const totalInstalls = await env.ANALYTICS.get('total-installs') || '0';

    // Get current month installs
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyInstalls = await env.ANALYTICS.get(`installs-${currentMonth}`) || '0';

    // Get last 6 months data
    const monthlyData = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `installs-${date.toISOString().slice(0, 7)}`;
      const count = await env.ANALYTICS.get(monthKey) || '0';
      monthlyData.push({
        month: date.toISOString().slice(0, 7),
        installs: parseInt(count)
      });
    }

    return new Response(JSON.stringify({
      totalInstalls: parseInt(totalInstalls),
      currentMonthInstalls: parseInt(monthlyInstalls),
      monthlyData: monthlyData.reverse()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get active users (devices with app installed)
 */
export async function handleGetActiveUsers(request, env) {
  try {
    // List all install records
    const list = await env.ANALYTICS.list({ prefix: 'install-' });

    // Count unique installs (still active)
    const activeInstalls = list.keys.length;

    return new Response(JSON.stringify({
      activeDevices: activeInstalls,
      message: 'Approximate number of devices with app currently installed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get active users error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Simple analytics dashboard HTML
 */
export function handleDashboard(env) {
  return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>PI Events - Install Analytics</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1E40AF 0%, #2563EB 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 36px;
            font-weight: 800;
            margin-bottom: 8px;
        }
        .header p {
            font-size: 18px;
            opacity: 0.9;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }
        .stat-card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .stat-label {
            font-size: 14px;
            font-weight: 600;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 48px;
            font-weight: 800;
            color: #1E293B;
            line-height: 1;
        }
        .stat-icon {
            font-size: 32px;
            margin-bottom: 16px;
        }
        .chart-card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .chart-title {
            font-size: 20px;
            font-weight: 700;
            color: #1E293B;
            margin-bottom: 24px;
        }
        .loading {
            text-align: center;
            padding: 60px;
            color: #64748B;
        }
        .refresh-btn {
            background: white;
            color: #2563EB;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            margin-top: 24px;
        }
        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>📊 PI Events Analytics</h1>
            <p>PWA Installation Statistics</p>
        </div>

        <div class="stats-grid" id="stats">
            <div class="loading">Loading statistics...</div>
        </div>

        <div class="chart-card">
            <h3 class="chart-title">Monthly Installs (Last 6 Months)</h3>
            <div id="chart">
                <div class="loading">Loading chart data...</div>
            </div>
        </div>

        <div style="text-align: center;">
            <button class="refresh-btn" onclick="loadStats()">🔄 Refresh</button>
        </div>
    </div>

    <script>
        async function loadStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();

                document.getElementById('stats').innerHTML = \`
                    <div class="stat-card">
                        <div class="stat-icon">📱</div>
                        <div class="stat-label">Total Installs</div>
                        <div class="stat-value">\${data.totalInstalls.toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📈</div>
                        <div class="stat-label">This Month</div>
                        <div class="stat-value">\${data.currentMonthInstalls.toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-label">6-Month Average</div>
                        <div class="stat-value">\${Math.round(data.monthlyData.reduce((a,b) => a + b.installs, 0) / 6).toLocaleString()}</div>
                    </div>
                \`;

                // Simple bar chart
                const max = Math.max(...data.monthlyData.map(d => d.installs));
                const chartHtml = data.monthlyData.map(item => {
                    const height = max > 0 ? (item.installs / max * 100) : 0;
                    const monthName = new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    return \`
                        <div style="display: inline-block; width: 15%; text-align: center; vertical-align: bottom; margin: 0 1%;">
                            <div style="background: #2563EB; height: \${height * 2}px; border-radius: 8px 8px 0 0; margin-bottom: 8px; min-height: 20px;"></div>
                            <div style="font-size: 18px; font-weight: 700; color: #1E293B; margin-bottom: 4px;">\${item.installs}</div>
                            <div style="font-size: 12px; color: #64748B;">\${monthName}</div>
                        </div>
                    \`;
                }).join('');

                document.getElementById('chart').innerHTML = \`
                    <div style="height: 250px; display: flex; align-items: flex-end; justify-content: space-around;">
                        \${chartHtml}
                    </div>
                \`;

            } catch (error) {
                console.error('Failed to load stats:', error);
                document.getElementById('stats').innerHTML = \`
                    <div class="stat-card" style="grid-column: 1 / -1; text-align: center; color: #EF4444;">
                        ❌ Failed to load statistics. Please try again.
                    </div>
                \`;
            }
        }

        // Load stats on page load
        loadStats();

        // Auto-refresh every 30 seconds
        setInterval(loadStats, 30000);
    </script>
</body>
</html>
  `, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
    }
  });
}
