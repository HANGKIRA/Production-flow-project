const app = document.querySelector("#app");
const state = {
  token: localStorage.getItem("token"),
  user: JSON.parse(localStorage.getItem("user") || "null"),
  view: "dashboard",
  orders: [],
  orderStatuses: [],
  staffUsers: [],
  customers: [],
  workflowMode: "kanban",
  selectedOrderId: null,
  items: [],
  expenses: [],
  expenseSummary: null,
  expenseAdmins: [],
  hrMe: null,
  hrOfficeNetwork: false,
  adminHr: null,
  closings: [],
  activeClosingMonth: null,
  whatsappMessages: [],
  videoRequests: [],
  videoDesigners: [],
  videoTracks: [],
  videoStatuses: [],
  analytics: null
};

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const fallbackOrderStatuses = [
  "New Order",
  "Designing",
  "Waiting Approval",
  "Approved",
  "Printing",
  "Ready for Payment",
  "Paid",
  "Shipped",
  "Completed"
];

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  });
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.analytics = null;
  state.orders = [];
  state.orderStatuses = [];
  state.staffUsers = [];
  state.customers = [];
  state.workflowMode = "kanban";
  state.selectedOrderId = null;
  state.items = [];
  state.expenses = [];
  state.expenseSummary = null;
  state.expenseAdmins = [];
  state.hrMe = null;
  state.hrOfficeNetwork = false;
  state.adminHr = null;
  state.closings = [];
  state.activeClosingMonth = null;
  state.whatsappMessages = [];
  state.videoRequests = [];
  state.videoDesigners = [];
  state.videoTracks = [];
  state.videoStatuses = [];
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  renderLogin();
}

function renderLogin() {
  app.innerHTML = `
    <section class="login-shell">
      <form class="login-panel" id="loginForm">
        <h1>Production Flow Portal</h1>
        <p>Sign in to continue to your workspace.</p>
        <label class="field">
          Username
          <input name="username" autocomplete="username" value="admin" />
        </label>
        <label class="field">
          Password
          <input name="password" type="password" autocomplete="current-password" value="admin123" />
        </label>
        <button class="primary" type="submit">Sign in</button>
        <div class="quick-logins">
          <button type="button" data-user="admin" data-pass="admin123">Admin</button>
          <button type="button" data-user="staff" data-pass="staff123">Staff</button>
          <button type="button" data-user="designer" data-pass="designer123">Designer</button>
        </div>
        <div class="error" id="loginError"></div>
      </form>
    </section>
  `;

  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await login(form.get("username"), form.get("password"));
  });

  document.querySelectorAll("[data-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      await login(button.dataset.user, button.dataset.pass);
    });
  });
}

async function login(username, password) {
  const error = document.querySelector("#loginError");
  try {
    const { token, user } = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setSession(token, user);
    state.view = user.role === "ADMIN" ? "dashboard" : "clock";
    await load();
  } catch (err) {
    error.textContent = err.message;
  }
}

async function load() {
  const orderPayload = await api("/api/orders");
  state.orders = orderPayload.orders;
  state.orderStatuses = orderPayload.statuses ?? fallbackOrderStatuses;
  state.staffUsers = orderPayload.staff ?? [];
  state.customers = (await api("/api/customers")).customers;
  const hrMe = await api("/api/hr/me");
  state.hrMe = hrMe.profile;
  state.hrOfficeNetwork = hrMe.office_network;
  if (state.user.role === "ADMIN" || state.user.role === "DESIGNER") {
    const video = await api("/api/video-requests");
    state.videoRequests = video.requests;
    state.videoDesigners = video.designers;
    state.videoTracks = video.tracks;
    state.videoStatuses = video.statuses;
  }
  if (state.user.role === "ADMIN") {
    const [items, analytics, financialOrders, expenses, adminHr, closings, whatsappMessages] = await Promise.all([
      api("/api/admin/items"),
      api("/api/admin/analytics"),
      api("/api/admin/orders/financial"),
      api("/api/admin/expenses"),
      api("/api/admin/hr"),
      api("/api/admin/monthly-closings"),
      api("/api/admin/whatsapp-messages")
    ]);
    state.items = items.items;
    state.analytics = analytics;
    state.financialOrders = financialOrders.orders;
    state.expenses = expenses.expenses;
    state.expenseSummary = expenses.summary;
    state.expenseAdmins = expenses.admins;
    state.adminHr = adminHr;
    state.closings = closings.closings;
    state.activeClosingMonth ??= state.closings[0]?.month ?? new Date().toISOString().slice(0, 7);
    state.whatsappMessages = whatsappMessages.messages;
  }
  renderShell();
}

function renderShell() {
  const admin = state.user.role === "ADMIN";
  const videoAccess = state.user.role === "ADMIN" || state.user.role === "DESIGNER";
  app.innerHTML = `
    <section class="layout">
      <aside class="sidebar">
        <div class="brand">Production Flow</div>
        <div class="role-badge">${state.user.role}</div>
        <nav class="nav">
          ${admin ? `<button data-view="dashboard">Financial Dashboard</button>` : ""}
          ${admin ? `<button data-view="expenses">Expenses</button>` : ""}
          ${admin ? `<button data-view="closing">Monthly Closing</button>` : ""}
          ${admin ? `<button data-view="whatsapp">WhatsApp Messages</button>` : ""}
          ${admin ? `<button data-view="hr">HR</button>` : ""}
          ${admin ? `<button data-view="items">Products & Costs</button>` : ""}
          ${admin ? `<button data-view="financialOrders">Order Financials</button>` : ""}
          ${videoAccess ? `<button data-view="videoStudio">Video Studio</button>` : ""}
          ${!admin ? `<button data-view="clock">Clock In/Out</button>` : ""}
          <button data-view="workflow">Production Workflow</button>
        </nav>
        <button class="logout" id="logout">Sign out</button>
      </aside>
      <section class="content">
        <div id="view"></div>
      </section>
    </section>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderShell();
    });
  });
  document.querySelector("#logout").addEventListener("click", clearSession);
  renderView();
}

function renderView() {
  if (state.user.role !== "ADMIN" && !["workflow", "clock"].includes(state.view)) {
    state.view = state.user.role === "DESIGNER" ? "videoStudio" : "clock";
  }

  if (state.view === "dashboard") renderDashboard();
  if (state.view === "expenses") renderExpenses();
  if (state.view === "closing") renderClosing();
  if (state.view === "whatsapp") renderWhatsapp();
  if (state.view === "hr") renderHr();
  if (state.view === "clock") renderClock();
  if (state.view === "items") renderItems();
  if (state.view === "financialOrders") renderFinancialOrders();
  if (state.view === "videoStudio") renderVideoStudio();
  if (state.view === "workflow") renderWorkflow();
}

function renderDashboard() {
  const { summary, staff_performance, trend } = state.analytics;
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Admin Financial Dashboard</h1>
        <p>Current sales, profit, orders, and team output.</p>
      </div>
    </header>
    <section class="grid kpis">
      ${kpi("Sales Today", money.format(summary.today.sales))}
      ${kpi("Profit Today", money.format(summary.today.profit))}
      ${kpi("Orders This Month", summary.month.orders)}
      ${kpi("Profit This Year", money.format(summary.year.profit))}
    </section>
    <section class="grid kpis" style="margin-top:16px">
      ${kpi("Sales Week", money.format(summary.week.sales))}
      ${kpi("Sales Month", money.format(summary.month.sales))}
      ${kpi("Sales Year", money.format(summary.year.sales))}
      ${kpi("Orders Year", summary.year.orders)}
    </section>
    <section class="grid two-col" style="margin-top:16px">
      <article class="card">
        <h2 class="section-title">Sales over time</h2>
        ${barChart(trend, "sales")}
      </article>
      <article class="card">
        <h2 class="section-title">Profit over time</h2>
        ${barChart(trend, "profit")}
      </article>
    </section>
    <section class="card" style="margin-top:16px">
      <h2 class="section-title">Staff Performance</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Orders handled</th><th>Completed</th><th>Total sales</th><th>Total profit</th></tr></thead>
          <tbody>
            ${staff_performance.map((row) => `
              <tr>
                <td>${row.name}</td>
                <td>${row.role}</td>
                <td>${row.orders_handled}</td>
                <td>${row.orders_completed}</td>
                <td>${money.format(row.total_sales_generated)}</td>
                <td>${money.format(row.total_profit_generated)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function kpi(label, value) {
  return `<article class="card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></article>`;
}

function barChart(rows, key) {
  const max = Math.max(...rows.map((row) => row[key]), 1);
  const width = 640;
  const height = 220;
  const gap = 16;
  const barWidth = Math.max(24, (width - gap * (rows.length + 1)) / rows.length);
  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${key} chart">
      <line x1="30" y1="190" x2="620" y2="190" stroke="#d9dde7" />
      ${rows.map((row, index) => {
        const h = (row[key] / max) * 150;
        const x = 36 + index * (barWidth + gap);
        const y = 190 - h;
        return `
          <rect class="bar-${key}" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4"></rect>
          <text x="${x}" y="210">${row.date.slice(5)}</text>
        `;
      }).join("")}
    </svg>
  `;
}

function blankClosing(month = new Date().toISOString().slice(0, 7)) {
  return {
    month,
    expenses: [{ label: "", amount: 0 }],
    stock_expenses: [{ label: "", amount: 0, note: "" }],
    shopee_cash_out: [{ label: "", amount: 0 }],
    shopee_sales: [{ label: "", amount: 0 }],
    offline_unpaid: 0,
    offline_sales: 0,
    offline_half_deposit: 0,
    bank_balance: 0,
    note: "",
    calculations: {
      expenses_total: 0,
      stock_total: 0,
      total_expenses: 0,
      shopee_cash_out_total: 0,
      shopee_sales_total: 0,
      offline_plus_shopee_sales: 0,
      collected_sales: 0,
      gain_profit: 0,
      bank_new_balance: 0
    }
  };
}

function activeClosing() {
  return state.closings.find((closing) => closing.month === state.activeClosingMonth) ?? blankClosing(state.activeClosingMonth);
}

function calcClosingDraft(closing) {
  const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
  const expensesTotal = sum(closing.expenses);
  const stockTotal = sum(closing.stock_expenses);
  const totalExpenses = expensesTotal + stockTotal;
  const shopeeCashOutTotal = sum(closing.shopee_cash_out);
  const shopeeSalesTotal = sum(closing.shopee_sales);
  const offlineSales = Number(closing.offline_sales || 0);
  const offlineUnpaid = Number(closing.offline_unpaid || 0);
  const offlineHalfDeposit = Number(closing.offline_half_deposit || 0);
  const offlinePaidSales = Math.max(offlineSales - offlineUnpaid - offlineHalfDeposit, 0);
  const collectedSales = offlinePaidSales + offlineHalfDeposit + shopeeCashOutTotal;
  const gainProfit = collectedSales - totalExpenses;
  return {
    expenses_total: expensesTotal,
    stock_total: stockTotal,
    total_expenses: totalExpenses,
    shopee_cash_out_total: shopeeCashOutTotal,
    shopee_sales_total: shopeeSalesTotal,
    offline_plus_shopee_sales: offlineSales + shopeeSalesTotal,
    collected_sales: collectedSales,
    gain_profit: gainProfit,
    bank_new_balance: Number(closing.bank_balance || 0) + gainProfit
  };
}

function renderClosing() {
  const closing = structuredClone(activeClosing());
  const calc = closing.calculations ?? calcClosingDraft(closing);
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Monthly Closing</h1>
        <p>End-month expenses, Shopee, offline sales, bank balance, and profit.</p>
      </div>
    </header>
    <section class="card closing-toolbar">
      <label>
        Month
        <input id="closingMonth" type="month" value="${closing.month}" />
      </label>
      <button id="newClosing">New Month</button>
      <button id="saveClosing">Save Closing</button>
    </section>
    <section class="grid kpis" style="margin-top:16px">
      ${kpi("Total Expenses", money.format(calc.total_expenses))}
      ${kpi("Cash Out", money.format(calc.shopee_cash_out_total))}
      ${kpi("Total Sales", money.format(calc.offline_plus_shopee_sales))}
      ${kpi("Gain Profit", money.format(calc.gain_profit))}
    </section>
    <section class="grid kpis" style="margin-top:16px">
      ${kpi("Bank Balance", money.format(closing.bank_balance || 0))}
      ${kpi("New Balance", money.format(calc.bank_new_balance))}
      ${kpi("Shopee Sales", money.format(calc.shopee_sales_total))}
      ${kpi("Collected Sales", money.format(calc.collected_sales))}
    </section>
    <section class="closing-grid" style="margin-top:16px">
      ${closingSection("Expenses", "expenses", closing.expenses, calc.expenses_total)}
      ${closingSection("Expenses Stock Amount", "stock_expenses", closing.stock_expenses, calc.stock_total, true)}
      ${singleFields(closing)}
      ${closingSection("Cash Out", "shopee_cash_out", closing.shopee_cash_out, calc.shopee_cash_out_total)}
      ${closingSection("Sales", "shopee_sales", closing.shopee_sales, calc.shopee_sales_total)}
      <article class="card closing-results">
        <h2 class="section-title">Calculated Results</h2>
        ${resultRow("Offline + Shopee Sales", calc.offline_plus_shopee_sales)}
        ${resultRow("Total Expenses", calc.total_expenses)}
        ${resultRow("Shopee Cash Out", calc.shopee_cash_out_total)}
        ${resultRow("Gain Profit", calc.gain_profit)}
        ${resultRow("Bank New Balance", calc.bank_new_balance)}
      </article>
    </section>
  `;

  document.querySelector("#closingMonth").addEventListener("change", (event) => {
    state.activeClosingMonth = event.target.value;
    renderClosing();
  });

  document.querySelector("#newClosing").addEventListener("click", () => {
    state.activeClosingMonth = new Date().toISOString().slice(0, 7);
    if (!state.closings.some((item) => item.month === state.activeClosingMonth)) {
      state.closings.unshift(blankClosing(state.activeClosingMonth));
    }
    renderClosing();
  });

  document.querySelectorAll("[data-add-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.addRow;
      closing[section].push({ label: "", amount: 0, ...(section === "stock_expenses" ? { note: "" } : {}) });
      saveClosingDraft(closing);
      renderClosing();
    });
  });

  document.querySelector("#saveClosing").addEventListener("click", async () => {
    await api("/api/admin/monthly-closings", {
      method: "POST",
      body: JSON.stringify(readClosingForm())
    });
    state.view = "closing";
    await load();
  });
}

function saveClosingDraft(closing) {
  const index = state.closings.findIndex((item) => item.month === closing.month);
  if (index >= 0) state.closings[index] = { ...closing, calculations: calcClosingDraft(closing) };
  else state.closings.unshift({ ...closing, calculations: calcClosingDraft(closing) });
}

function closingSection(title, key, rows, total, hasNote = false) {
  return `
    <article class="card closing-section">
      <div class="section-head">
        <h2 class="section-title">${title}</h2>
        <button class="text-button" data-add-row="${key}">Add Row</button>
      </div>
      ${rows.map((row, index) => `
        <div class="closing-row">
          <input data-section="${key}" data-index="${index}" data-field="label" value="${row.label ?? ""}" placeholder="Name" />
          <input data-section="${key}" data-index="${index}" data-field="amount" type="number" step="0.01" value="${row.amount ?? 0}" placeholder="RM" />
          ${hasNote ? `<input data-section="${key}" data-index="${index}" data-field="note" value="${row.note ?? ""}" placeholder="Note" />` : ""}
        </div>
      `).join("")}
      <div class="section-total"><span>Total</span><strong>${money.format(total)}</strong></div>
    </article>
  `;
}

function singleFields(closing) {
  return `
    <article class="card closing-section">
      <h2 class="section-title">Offline & Bank</h2>
      <label class="closing-field">Offline Haven't Pay <input data-closing-single="offline_unpaid" type="number" step="0.01" value="${closing.offline_unpaid || 0}" /></label>
      <label class="closing-field">Offline Sales <input data-closing-single="offline_sales" type="number" step="0.01" value="${closing.offline_sales || 0}" /></label>
      <label class="closing-field">Offline Half Deposit <input data-closing-single="offline_half_deposit" type="number" step="0.01" value="${closing.offline_half_deposit || 0}" /></label>
      <label class="closing-field">Bank Balance <input data-closing-single="bank_balance" type="number" step="0.01" value="${closing.bank_balance || 0}" /></label>
      <label class="closing-field">Note <input data-closing-single="note" value="${closing.note || ""}" /></label>
    </article>
  `;
}

function resultRow(label, amount) {
  return `<div class="result-row"><span>${label}</span><strong>${money.format(amount)}</strong></div>`;
}

function readClosingForm() {
  const closing = blankClosing(document.querySelector("#closingMonth").value);
  closing.expenses = [];
  closing.stock_expenses = [];
  closing.shopee_cash_out = [];
  closing.shopee_sales = [];

  document.querySelectorAll("[data-section]").forEach((input) => {
    const section = input.dataset.section;
    const index = Number(input.dataset.index);
    const field = input.dataset.field;
    closing[section][index] ??= {};
    closing[section][index][field] = field === "amount" ? Number(input.value || 0) : input.value;
  });

  document.querySelectorAll("[data-closing-single]").forEach((input) => {
    const key = input.dataset.closingSingle;
    closing[key] = key === "note" ? input.value : Number(input.value || 0);
  });

  return closing;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function renderWhatsapp() {
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>WhatsApp Messages</h1>
        <p>API-ready design approval messages, delivery simulation, and customer replies.</p>
      </div>
    </header>
    <section class="grid kpis">
      ${kpi("Total Logs", state.whatsappMessages.length)}
      ${kpi("Outbound", state.whatsappMessages.filter((message) => message.direction === "outbound").length)}
      ${kpi("Customer Replies", state.whatsappMessages.filter((message) => message.direction === "inbound").length)}
      ${kpi("Redesign Requests", state.whatsappMessages.filter((message) => message.customer_action === "redesign").length)}
    </section>
    <section class="card" style="margin-top:16px">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Order</th><th>Customer</th><th>Phone</th><th>Direction</th><th>Type</th><th>Status</th><th>Action</th><th>Message</th></tr></thead>
          <tbody>
            ${state.whatsappMessages.map((message) => `
              <tr>
                <td>${formatDateTime(message.sent_at)}</td>
                <td>${message.order_id}</td>
                <td>${message.customer_name}</td>
                <td>${message.phone_number}</td>
                <td>${message.direction}</td>
                <td>${message.type}</td>
                <td>${message.status}</td>
                <td>${message.customer_action || "-"}</td>
                <td>${message.message_content}</td>
              </tr>
            `).join("") || `<tr><td colspan="9">No WhatsApp logs yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClock() {
  const profile = state.hrMe;
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Clock In/Out</h1>
        <p>${profile?.name ?? "Staff"} attendance for office work.</p>
      </div>
    </header>
    <section class="grid two-col">
      <article class="card clock-card">
        <div class="network-status ${state.hrOfficeNetwork ? "ok" : "blocked"}">
          ${state.hrOfficeNetwork ? "Office network detected" : "Connect to office WiFi/network"}
        </div>
        <div class="clock-time">${new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</div>
        <p>${profile?.open_shift ? `Clocked in since ${formatDateTime(profile.open_shift.clock_in)}` : "You are currently clocked out."}</p>
        <button class="primary" id="clockAction" ${state.hrOfficeNetwork ? "" : "disabled"}>
          ${profile?.open_shift ? "Clock Out" : "Clock In"}
        </button>
        <div class="error" id="clockError"></div>
      </article>
      <article class="card">
        <h2 class="section-title">Recent Attendance</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Clock in</th><th>Clock out</th><th>Hours</th></tr></thead>
            <tbody>
              ${(profile?.attendance ?? []).map((entry) => `
                <tr>
                  <td>${formatDateTime(entry.clock_in)}</td>
                  <td>${formatDateTime(entry.clock_out)}</td>
                  <td>${entry.hours}</td>
                </tr>
              `).join("") || `<tr><td colspan="3">No attendance yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    </section>
    <section class="card" style="margin-top:16px">
      <h2 class="section-title">MC & Leave Records</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Note</th></tr></thead>
          <tbody>
            ${(profile?.leaves ?? []).map((leave) => `
              <tr>
                <td>${leave.type}</td>
                <td>${new Date(leave.start_date).toLocaleDateString("en-MY")}</td>
                <td>${new Date(leave.end_date).toLocaleDateString("en-MY")}</td>
                <td>${leave.days}</td>
                <td>${leave.note || ""}</td>
              </tr>
            `).join("") || `<tr><td colspan="5">No MC or leave records</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.querySelector("#clockAction")?.addEventListener("click", async () => {
    const error = document.querySelector("#clockError");
    try {
      await api(profile?.open_shift ? "/api/hr/clock-out" : "/api/hr/clock-in", { method: "POST" });
      state.view = "clock";
      await load();
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function renderHr() {
  const hr = state.adminHr;
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>HR</h1>
        <p>Attendance, hourly pay, MC, and leave records.</p>
      </div>
    </header>
    <section class="grid kpis">
      ${kpi("Month Hours", hr.total_month_hours)}
      ${kpi("Est. Month Pay", money.format(hr.estimated_month_pay))}
      ${kpi("Clocked In Now", hr.active_now)}
      ${kpi("Leave Records", hr.leave_records)}
    </section>
    <section class="grid two-col" style="margin-top:16px">
      <article class="card">
        <h2 class="section-title">Add MC / Leave</h2>
        <form class="expense-form" id="leaveForm">
          <select name="user_id" required>
            ${hr.staff.map((staff) => `<option value="${staff.user_id}">${staff.name}</option>`).join("")}
          </select>
          <select name="type" required>
            <option>MC</option>
            <option>Annual Leave</option>
            <option>Emergency Leave</option>
            <option>Unpaid Leave</option>
          </select>
          <input name="start_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
          <input name="end_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
          <input name="days" type="number" step="0.5" min="0.5" value="1" required />
          <input name="note" placeholder="Note" />
          <button type="submit">Save Leave</button>
        </form>
      </article>
      <article class="card">
        <h2 class="section-title">Staff Summary</h2>
        <div class="breakdown">
          ${hr.staff.map((staff) => `
            <div class="breakdown-row">
              <span>${staff.name}</span>
              <strong>${staff.open_shift ? "In" : "Out"}</strong>
              <small>${staff.month_hours} hrs this month / ${money.format(staff.estimated_month_pay)}</small>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
    <section class="card" style="margin-top:16px">
      <h2 class="section-title">Staff HR Table</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Rate / hour</th><th>Month hours</th><th>Est. pay</th><th>MC</th><th>Leave</th><th>Status</th><th>Save</th></tr></thead>
          <tbody>
            ${hr.staff.map((staff) => `
              <tr>
                <td>${staff.name}</td>
                <td>${staff.role}</td>
                <td><input class="table-input" data-hr-field="hourly_rate" data-user-id="${staff.user_id}" type="number" step="0.01" value="${staff.hourly_rate}" /></td>
                <td>${staff.month_hours}</td>
                <td>${money.format(staff.estimated_month_pay)}</td>
                <td><input class="table-input" data-hr-field="mc_days" data-user-id="${staff.user_id}" type="number" step="0.5" value="${staff.mc_days}" /></td>
                <td><input class="table-input" data-hr-field="leave_days" data-user-id="${staff.user_id}" type="number" step="0.5" value="${staff.leave_days}" /></td>
                <td>
                  <select class="table-input" data-hr-field="status" data-user-id="${staff.user_id}">
                    <option ${staff.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
                    <option ${staff.status === "INACTIVE" ? "selected" : ""}>INACTIVE</option>
                  </select>
                </td>
                <td><button class="text-button" data-save-hr="${staff.user_id}">Save</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
    <section class="card" style="margin-top:16px">
      <h2 class="section-title">Attendance Log</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Staff</th><th>Clock in</th><th>Clock out</th><th>Hours</th></tr></thead>
          <tbody>
            ${hr.staff.flatMap((staff) => staff.attendance.map((entry) => `
              <tr>
                <td>${staff.name}</td>
                <td>${formatDateTime(entry.clock_in)}</td>
                <td>${formatDateTime(entry.clock_out)}</td>
                <td>${entry.hours}</td>
              </tr>
            `)).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.querySelector("#leaveForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/admin/hr/leaves", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form))
    });
    state.view = "hr";
    await load();
  });

  document.querySelectorAll("[data-save-hr]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.saveHr;
      const payload = {};
      document.querySelectorAll(`[data-user-id="${userId}"]`).forEach((input) => {
        payload[input.dataset.hrField] = input.value;
      });
      await api(`/api/admin/hr/staff/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      state.view = "hr";
      await load();
    });
  });
}

function renderExpenses() {
  const summary = state.expenseSummary;
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Expenses</h1>
        <p>Stock purchases, delivery, ads, deposits, and operating costs.</p>
      </div>
    </header>
    <section class="grid kpis">
      ${kpi("Total Expenses", money.format(summary.total))}
      ${kpi("This Month", money.format(summary.month))}
      ${kpi("Today", money.format(summary.today))}
      ${kpi("Entries", summary.count)}
    </section>
    <section class="grid two-col" style="margin-top:16px">
      <article class="card">
        <h2 class="section-title">Add Expense</h2>
        <form class="expense-form" id="expenseForm">
          <input name="name" placeholder="Name of cost" required />
          <input name="amount" type="number" step="0.01" min="0" placeholder="Total cost" required />
          <select name="purchased_by" required>
            ${state.expenseAdmins.map((admin) => `<option value="${admin.id}">${admin.name}</option>`).join("")}
          </select>
          <input name="account" placeholder="Account / bank / cash" value="paramour bank" required />
          <input name="expense_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
          <input name="note" placeholder="Note" />
          <button type="submit">Save Expense</button>
        </form>
      </article>
      <article class="card">
        <h2 class="section-title">Breakdown</h2>
        <div class="breakdown">
          <div>
            <h3>By admin</h3>
            ${summary.by_admin.map((row) => breakdownRow(row.label, row.total, row.count)).join("")}
          </div>
          <div>
            <h3>By account</h3>
            ${summary.by_account.map((row) => breakdownRow(row.label, row.total, row.count)).join("")}
          </div>
        </div>
      </article>
    </section>
    <section class="card" style="margin-top:16px">
      <h2 class="section-title">Expense List</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Name of cost</th><th>Total cost</th><th>Admin</th><th>Account</th><th>Note</th><th></th></tr></thead>
          <tbody>
            ${state.expenses.map((expense) => `
              <tr>
                <td>${new Date(expense.expense_date).toLocaleDateString("en-MY")}</td>
                <td>${expense.name}</td>
                <td>${money.format(expense.amount)}</td>
                <td>${expense.purchaser_name}</td>
                <td>${expense.account}</td>
                <td>${expense.note || ""}</td>
                <td><button class="text-button danger" data-delete-expense="${expense.expense_id}">Delete</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.querySelector("#expenseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/admin/expenses", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form))
    });
    state.view = "expenses";
    await load();
  });

  document.querySelectorAll("[data-delete-expense]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/admin/expenses/${encodeURIComponent(button.dataset.deleteExpense)}`, {
        method: "DELETE"
      });
      state.view = "expenses";
      await load();
    });
  });
}

function breakdownRow(label, total, count) {
  return `
    <div class="breakdown-row">
      <span>${label}</span>
      <strong>${money.format(total)}</strong>
      <small>${count} entries</small>
    </div>
  `;
}

function renderItems() {
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Products & Cost Management</h1>
        <p>Product pricing, production costs, and margin.</p>
      </div>
    </header>
    <section class="card">
      <form class="item-form" id="itemForm">
        <input name="item_id" placeholder="Item ID" required />
        <input name="item_name" placeholder="Item name" required />
        <input name="base_cost" type="number" step="0.01" placeholder="Base cost" required />
        <input name="selling_price" type="number" step="0.01" placeholder="Selling price" required />
        <button type="submit">Save Item</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item ID</th><th>Name</th><th>Base cost</th><th>Selling price</th><th>Profit</th></tr></thead>
          <tbody>
            ${state.items.map((item) => `
              <tr>
                <td>${item.item_id}</td>
                <td>${item.item_name}</td>
                <td>${money.format(item.base_cost)}</td>
                <td>${money.format(item.selling_price)}</td>
                <td>${money.format(item.profit)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.querySelector("#itemForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/admin/items", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form))
    });
    state.view = "items";
    await load();
    renderShell();
  });
}

function renderFinancialOrders() {
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Order Financial Tracking</h1>
        <p>Per-order cost, sales, and profit tracking.</p>
      </div>
    </header>
    <section class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Item</th><th>Qty</th><th>Item cost</th><th>Price</th><th>Total cost</th><th>Total sales</th><th>Total profit</th></tr></thead>
          <tbody>
            ${state.financialOrders.map((order) => `
              <tr>
                <td>${order.order_id}</td>
                <td>${order.item_name}</td>
                <td>${order.quantity}</td>
                <td>${money.format(order.item_cost)}</td>
                <td>${money.format(order.selling_price)}</td>
                <td>${money.format(order.total_cost)}</td>
                <td>${money.format(order.total_sales)}</td>
                <td>${money.format(order.total_profit)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderVideoStudio() {
  const admin = state.user.role === "ADMIN";
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Video Studio</h1>
        <p>Raw footage briefs, TikTok captions, royalty-free track choice, fonts, and designer edits.</p>
      </div>
    </header>
    <section class="card video-brief">
      <h2 class="section-title">New Video Request</h2>
      <form id="videoForm" class="video-form">
        <input name="title" placeholder="Project title" required />
        <input name="sample_video_link" placeholder="Sample video link" />
        <input name="caption" placeholder="Caption / hook" required />
        <select name="selected_song">
          ${state.videoTracks.map((track) => `<option value="${track.title}">${track.title} (${track.mood})</option>`).join("")}
        </select>
        <select name="font_style">
          ${fontOptions()}
        </select>
        ${admin ? `
          <select name="assigned_designer">
            ${state.videoDesigners.map((designer) => `<option value="${designer.id}">${designer.name}</option>`).join("")}
          </select>
        ` : `<input type="hidden" name="assigned_designer" value="${state.user.id}" />`}
        <textarea name="notes" placeholder="Editing notes"></textarea>
        <label class="upload-button video-upload">Raw footage<input type="file" id="rawVideoFile" accept="video/*" multiple data-file-label="newRawFileName" /></label>
        <div class="file-picked" id="newRawFileName">No raw footage selected</div>
        <button type="submit">Create Brief</button>
      </form>
    </section>
    <section class="video-grid" style="margin-top:16px">
      ${state.videoRequests.map(videoCard).join("") || `<article class="card">No video requests yet</article>`}
    </section>
  `;

  document.querySelector("#videoForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    const files = [...(document.querySelector("#rawVideoFile")?.files ?? [])];
    if (files.length) {
      payload.raw_footage = await Promise.all(files.map(async (file) => ({
        filename: file.name,
        file_url: await readFileAsDataUrl(file)
      })));
      payload.raw_footage_url = payload.raw_footage[0].file_url;
      payload.raw_filename = payload.raw_footage[0].filename;
    }
    await api("/api/video-requests", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await load();
  });

  bindFileLabels();

  document.querySelectorAll("[data-video-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.videoSave;
      const payload = {};
      document.querySelectorAll(`[data-video-id="${id}"]`).forEach((input) => {
        payload[input.dataset.videoField] = input.value;
      });
      const finalFile = document.querySelector(`[data-video-final="${id}"]`)?.files?.[0];
      if (finalFile) payload.final_video_url = await readFileAsDataUrl(finalFile);
      const rawFiles = [...(document.querySelector(`[data-video-raw="${id}"]`)?.files ?? [])];
      if (rawFiles.length) {
        payload.raw_footage = await Promise.all(rawFiles.map(async (file) => ({
          filename: file.name,
          file_url: await readFileAsDataUrl(file)
        })));
        payload.raw_footage_url = payload.raw_footage[0].file_url;
        payload.raw_filename = payload.raw_footage[0].filename;
      }
      await api(`/api/video-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      await load();
    });
  });

  document.querySelectorAll("[data-video-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/video-requests/${encodeURIComponent(button.dataset.videoPlan)}`, {
        method: "PATCH",
        body: JSON.stringify({ regenerate_plan: true })
      });
      await load();
    });
  });

  document.querySelectorAll("[data-video-render]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.textContent = "Rendering...";
      button.disabled = true;
      try {
        await api(`/api/video-requests/${encodeURIComponent(button.dataset.videoRender)}/render`, {
          method: "POST"
        });
        await load();
      } catch (err) {
        alert(err.message);
        await load();
      }
    });
  });
}

function bindFileLabels() {
  document.querySelectorAll("[data-file-label]").forEach((input) => {
    input.addEventListener("change", () => {
      const label = document.querySelector(`#${input.dataset.fileLabel}`);
      if (label) label.textContent = input.files.length ? [...input.files].map((file) => file.name).join(", ") : "No file selected";
    });
  });
}

function fontOptions(selected = "Bold captions") {
  return ["Bold captions", "Clean minimal", "Luxury serif", "Streetwear block", "Playful bubble"]
    .map((font) => `<option value="${font}" ${font === selected ? "selected" : ""}>${font}</option>`)
    .join("");
}

function videoCard(request) {
  return `
    <article class="card video-card">
      <div class="section-head">
        <h2 class="section-title">${request.title}</h2>
        <span class="role-badge light">${request.status}</span>
      </div>
      <div class="detail-line"><span>Designer</span><strong>${request.assigned_designer_name}</strong></div>
      <label class="field compact">Caption
        <textarea data-video-id="${request.request_id}" data-video-field="caption">${request.caption || ""}</textarea>
      </label>
      <label class="field compact">Sample video link
        <input data-video-id="${request.request_id}" data-video-field="sample_video_link" value="${request.sample_video_link || ""}" />
      </label>
      <label class="field compact">Song
        <select data-video-id="${request.request_id}" data-video-field="selected_song">
          ${state.videoTracks.map((track) => `<option value="${track.title}" ${track.title === request.selected_song ? "selected" : ""}>${track.title} (${track.mood})</option>`).join("")}
        </select>
      </label>
      <label class="field compact">Font
        <select data-video-id="${request.request_id}" data-video-field="font_style">
          ${fontOptions(request.font_style)}
        </select>
      </label>
      <label class="field compact">Status
        <select data-video-id="${request.request_id}" data-video-field="status">
          ${state.videoStatuses.map((status) => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label class="field compact">Notes
        <textarea data-video-id="${request.request_id}" data-video-field="notes">${request.notes || ""}</textarea>
      </label>
      <div class="mini-list">
        <div><strong>Saved Raw Footage</strong><span>${(request.raw_footage ?? []).length} clip(s)</span></div>
        ${request.render_error ? `<div><strong>Render Error</strong><span>${request.render_error}</span></div>` : ""}
        ${request.sample_video_link ? `<div><strong>Sample</strong><a href="${request.sample_video_link}" target="_blank" rel="noreferrer">${request.sample_video_link}</a></div>` : ""}
        ${(request.raw_footage ?? []).map((clip, index) => `<div><strong>Raw ${index + 1}</strong><a href="${clip.file_url}" target="_blank" rel="noreferrer">${clip.filename || "Open footage"}</a></div>`).join("")}
        ${request.final_video_url ? `<div><strong>Final Video</strong><a href="${request.final_video_url}" target="_blank" rel="noreferrer">Open final</a></div>` : ""}
      </div>
      <label class="field compact">Edit Plan
        <textarea data-video-id="${request.request_id}" data-video-field="edit_plan">${request.edit_plan || ""}</textarea>
      </label>
      <label class="upload-button">Upload raw footage<input type="file" accept="video/*" multiple data-video-raw="${request.request_id}" data-file-label="rawFile-${request.request_id}" /></label>
      <div class="file-picked" id="rawFile-${request.request_id}">${(request.raw_footage ?? []).length ? `${request.raw_footage.length} raw clip(s) saved` : "No raw footage saved"}</div>
      <label class="upload-button">Upload final<input type="file" accept="video/*" data-video-final="${request.request_id}" data-file-label="finalFile-${request.request_id}" /></label>
      <div class="file-picked" id="finalFile-${request.request_id}">${request.final_video_url ? "Final video saved" : "No final video saved"}</div>
      <div class="action-grid">
        <button data-video-save="${request.request_id}">Save</button>
        <button data-video-render="${request.request_id}">Render with FFmpeg</button>
        <button data-video-plan="${request.request_id}">Regenerate Plan</button>
      </div>
    </article>
  `;
}

function renderWorkflow() {
  const selectedOrder = state.orders.find((order) => order.order_id === state.selectedOrderId) ?? state.orders[0];
  state.selectedOrderId = selectedOrder?.order_id ?? null;
  document.querySelector("#view").innerHTML = `
    <header class="topbar">
      <div class="page-title">
        <h1>Internal Order System</h1>
        <p>Customer orders, files, status timeline, and WhatsApp-ready message logs.</p>
      </div>
    </header>
    <section class="card order-create">
      <form id="newOrderForm" class="order-form">
        <input name="customer_name" placeholder="Customer name" required />
        <input name="phone_number" placeholder="WhatsApp phone" required />
        <input name="product_type" placeholder="Product type" required />
        <input name="quantity" type="number" min="1" value="1" required />
        <select name="assigned_staff">
          ${state.staffUsers.map((staff) => `<option value="${staff.id}">${staff.name}</option>`).join("")}
        </select>
        <input name="notes" placeholder="Notes" />
        <button type="submit">Create Order</button>
      </form>
    </section>
    <section class="workflow-tabs">
      <button data-workflow-mode="kanban" class="${state.workflowMode === "kanban" ? "active" : ""}">Kanban</button>
      <button data-workflow-mode="list" class="${state.workflowMode === "list" ? "active" : ""}">Order List</button>
      <button data-workflow-mode="customers" class="${state.workflowMode === "customers" ? "active" : ""}">Customers</button>
    </section>
    <section class="workflow-shell">
      <div>
        ${state.workflowMode === "kanban" ? kanbanView() : ""}
        ${state.workflowMode === "list" ? listView() : ""}
        ${state.workflowMode === "customers" ? customersView() : ""}
      </div>
      ${selectedOrder ? orderDetailPanel(selectedOrder) : `<aside class="card"><h2 class="section-title">Order Detail</h2>No order selected</aside>`}
    </section>
  `;

  document.querySelector("#newOrderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.workflowMode = "kanban";
    await load();
  });

  document.querySelectorAll("[data-workflow-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.workflowMode = button.dataset.workflowMode;
      renderWorkflow();
    });
  });

  document.querySelectorAll("[data-select-order]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOrderId = button.dataset.selectOrder;
      renderWorkflow();
    });
  });

  document.querySelectorAll("[data-drop-status]").forEach((lane) => {
    lane.addEventListener("dragover", (event) => event.preventDefault());
    lane.addEventListener("drop", async (event) => {
      event.preventDefault();
      const orderId = event.dataTransfer.getData("text/plain");
      if (!orderId) return;
      await updateOrder(orderId, { status: lane.dataset.dropStatus });
    });
  });

  document.querySelectorAll("[data-draggable-order]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", card.dataset.draggableOrder);
    });
  });

  document.querySelectorAll("[data-status-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      await updateOrder(select.dataset.statusSelect, { status: select.value });
    });
  });

  document.querySelector("#orderSearch")?.addEventListener("input", renderWorkflow);
  document.querySelector("#statusFilter")?.addEventListener("change", renderWorkflow);

  document.querySelector("#detailStatus")?.addEventListener("change", async (event) => {
    await updateOrder(state.selectedOrderId, { status: event.target.value });
  });

  document.querySelector("#paymentStatus")?.addEventListener("change", async (event) => {
    await updateOrder(state.selectedOrderId, { payment_status: event.target.value });
  });

  document.querySelector("#trackingNumber")?.addEventListener("change", async (event) => {
    await updateOrder(state.selectedOrderId, { tracking_number: event.target.value });
  });

  document.querySelectorAll("[data-quick-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateOrder(state.selectedOrderId, { status: button.dataset.quickStatus });
    });
  });

  document.querySelector("#sendSample")?.addEventListener("click", async () => {
    await api(`/api/orders/${encodeURIComponent(state.selectedOrderId)}/send-sample`, { method: "POST" });
    await load();
  });

  document.querySelectorAll("[data-simulate-reply]").forEach((button) => {
    button.addEventListener("click", async () => {
      const note = document.querySelector("#redesignNote")?.value ?? "";
      await api(`/api/orders/${encodeURIComponent(state.selectedOrderId)}/simulate-reply`, {
        method: "POST",
        body: JSON.stringify({ action: button.dataset.simulateReply, note })
      });
      await load();
    });
  });

  document.querySelector("#manualMessage")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/api/orders/${encodeURIComponent(state.selectedOrderId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message_content: form.get("message_content"), type: "manual" })
    });
    await load();
  });

  document.querySelectorAll("[data-order-file]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const fileType = document.querySelector("#fileType")?.value ?? "reference";
      const fileUrl = await readFileAsDataUrl(file);
      await api(`/api/orders/${encodeURIComponent(input.dataset.orderFile)}/files`, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, file_url: fileUrl, file_type: fileType })
      });
      await load();
    });
  });
}

async function updateOrder(orderId, payload) {
  await api(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  state.selectedOrderId = orderId;
  await load();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function kanbanView() {
  return `
    <section class="kanban order-kanban">
      ${state.orderStatuses.map((status) => `
        <div class="lane" data-drop-status="${status}">
          <h3>${status}</h3>
          ${state.orders.filter((order) => order.status === status).map(orderCard).join("") || ""}
        </div>
      `).join("")}
    </section>
  `;
}

function orderCard(order) {
  return `
    <article class="order-card" draggable="true" data-draggable-order="${order.order_id}">
      <strong>${order.order_id}</strong>
      <span>${order.customer_name}</span>
      <span>${order.phone_number}</span>
      <span>${order.product_type} x ${order.quantity}</span>
      <span>${order.assigned_staff_name}</span>
      <button class="text-button" data-select-order="${order.order_id}">Open</button>
    </article>
  `;
}

function listView() {
  const search = document.querySelector("#orderSearch")?.value?.toLowerCase() ?? "";
  const status = document.querySelector("#statusFilter")?.value ?? "all";
  const filtered = state.orders.filter((order) => {
    const matchesStatus = status === "all" || order.status === status;
    const matchesSearch = !search || `${order.customer_name} ${order.phone_number} ${order.order_id}`.toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });
  return `
    <section class="card">
      <div class="list-tools">
        <input id="orderSearch" placeholder="Search name / phone / order" value="${search}" />
        <select id="statusFilter">
          <option value="all">All statuses</option>
          ${state.orderStatuses.map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Product</th><th>Status</th><th>Payment</th><th>Staff</th><th></th></tr></thead>
          <tbody>
            ${filtered.map((order) => `
              <tr>
                <td>${order.order_id}</td>
                <td>${order.customer_name}</td>
                <td>${order.phone_number}</td>
                <td>${order.product_type} x ${order.quantity}</td>
                <td>
                  <select class="table-input wide" data-status-select="${order.order_id}">
                    ${state.orderStatuses.map((item) => `<option value="${item}" ${item === order.status ? "selected" : ""}>${item}</option>`).join("")}
                  </select>
                </td>
                <td>${order.payment_status}</td>
                <td>${order.assigned_staff_name}</td>
                <td><button class="text-button" data-select-order="${order.order_id}">Open</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function customersView() {
  return `
    <section class="card">
      <h2 class="section-title">Customers</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>WhatsApp</th><th>Orders</th><th>Latest</th></tr></thead>
          <tbody>
            ${state.customers.map((customer) => `
              <tr>
                <td>${customer.customer_name}</td>
                <td>${customer.phone_number}</td>
                <td>${customer.orders.length}</td>
                <td>${customer.orders[0]?.status ?? "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function orderDetailPanel(order) {
  return `
    <aside class="card order-detail">
      <h2 class="section-title">${order.order_id}</h2>
      <div class="detail-line"><span>Customer</span><strong>${order.customer_name}</strong></div>
      <div class="detail-line"><span>WhatsApp</span><strong>${order.phone_number}</strong></div>
      <div class="detail-line"><span>Product</span><strong>${order.product_type} x ${order.quantity}</strong></div>
      <label class="field compact">Status
        <select id="detailStatus">
          ${state.orderStatuses.map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label class="field compact">Payment
        <select id="paymentStatus">
          ${["Unpaid", "Deposit", "Ready", "Paid"].map((status) => `<option ${status === order.payment_status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label class="field compact">Tracking
        <input id="trackingNumber" value="${order.tracking_number || ""}" placeholder="Tracking number" />
      </label>
      <div class="action-grid">
        <button id="sendSample">Send sample</button>
        <button data-quick-status="Approved">Mark approved</button>
        <button data-quick-status="Ready for Payment">Ready payment</button>
        <button data-quick-status="Shipped">Shipped</button>
      </div>
      <div class="approval-sim">
        <input id="redesignNote" placeholder="Redesign note for simulation" />
        <button data-simulate-reply="confirm">Simulate Confirm</button>
        <button data-simulate-reply="redesign">Simulate Redesign</button>
      </div>
      <h3>Files</h3>
      <div class="file-upload-row">
        <select id="fileType">
          <option value="design">Design</option>
          <option value="final">Final</option>
          <option value="reference">Reference</option>
        </select>
        <label class="upload-button">Upload design<input type="file" data-order-file="${order.order_id}" /></label>
      </div>
      <div class="mini-list">
        ${order.files.map((file) => `<div><strong>${file.file_type}</strong><a href="${file.file_url}" target="_blank" rel="noreferrer">${file.filename ?? "Open file"}</a></div>`).join("") || "<p>No files uploaded</p>"}
      </div>
      <h3>Timeline</h3>
      <div class="mini-list">
        ${(order.timeline ?? []).map((item) => `<div><strong>${item.status}</strong><span>${formatDateTime(item.timestamp)}</span></div>`).join("")}
      </div>
      <h3>Messages</h3>
      <form id="manualMessage" class="manual-message">
        <input name="message_content" placeholder="Manual WhatsApp note" required />
        <button type="submit">Log message</button>
      </form>
      <div class="mini-list">
        ${(order.messages ?? []).map((message) => `<div><strong>${message.type}</strong><span>${message.message_content}</span><small>${message.status} - ${formatDateTime(message.sent_at)}</small></div>`).join("") || "<p>No messages yet</p>"}
      </div>
    </aside>
  `;
}

if (state.token && state.user) {
  load().catch(clearSession);
} else {
  renderLogin();
}
