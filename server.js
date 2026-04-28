import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const expensesFile = process.env.EXPENSES_FILE || path.join(dataDir, "expenses.json");
const expensesSheetFile = process.env.EXPENSES_SHEET_FILE || path.join(dataDir, "expenses-sheet.json");
const hrFile = process.env.HR_FILE || path.join(dataDir, "hr.json");
const closingsFile = process.env.CLOSINGS_FILE || path.join(dataDir, "monthly-closings.json");
const ordersFile = process.env.ORDERS_FILE || path.join(dataDir, "orders.json");
const videoFile = process.env.VIDEO_FILE || path.join(dataDir, "video-requests.json");
const videoAssetDir = path.join(dataDir, "video-assets");
const videoRenderDir = path.join(dataDir, "video-renders");
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const PORT = Number(process.env.PORT || 3000);

const users = [
  { id: "u_admin", name: "Admin", username: "admin", password: "admin123", role: "ADMIN" },
  { id: "u_admin_yh", name: "YH", username: "yh", password: "admin123", role: "ADMIN" },
  { id: "u_admin_jh", name: "JH", username: "jh", password: "admin123", role: "ADMIN" },
  { id: "u_admin_hang", name: "HANG", username: "hang", password: "admin123", role: "ADMIN" },
  { id: "u_admin_zx", name: "ZX", username: "zx", password: "admin123", role: "ADMIN" },
  { id: "u_staff_1", name: "Aina Staff", username: "staff", password: "staff123", role: "STAFF" },
  { id: "u_designer_1", name: "Ravi Designer", username: "designer", password: "designer123", role: "DESIGNER" }
];

const items = [
  { item_id: "ITM-001", item_name: "Premium Cap", base_cost: 18, selling_price: 45 },
  { item_id: "ITM-002", item_name: "Oversized Tee", base_cost: 24, selling_price: 69 },
  { item_id: "ITM-003", item_name: "Embroidery Patch", base_cost: 5, selling_price: 15 }
];

const orderStatuses = [
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

const seedCustomers = [
  { customer_id: "CUS-1001", customer_name: "Paramour Studio", phone_number: "+60123450001", created_at: daysAgo(80) },
  { customer_id: "CUS-1002", customer_name: "GZ Collective", phone_number: "+60123450002", created_at: daysAgo(30) },
  { customer_id: "CUS-1003", customer_name: "ISCAMU", phone_number: "+60123450003", created_at: daysAgo(20) },
  { customer_id: "CUS-1004", customer_name: "Rex Subang", phone_number: "+60123450004", created_at: daysAgo(10) }
];

const seedOrders = [
  {
    order_id: "ORD-1001",
    customer_id: "CUS-1001",
    customer_name: "Paramour Studio",
    phone_number: "+60123450001",
    item_id: "ITM-001",
    product_type: "Premium Cap",
    quantity: 8,
    status: "Completed",
    payment_status: "Paid",
    tracking_number: "MY123456789",
    assigned_staff: "u_staff_1",
    notes: "Repeat customer. Black cap with embroidery.",
    files: [],
    messages: [],
    timeline: [{ status: "New Order", changed_by: "u_staff_1", timestamp: daysAgo(6) }, { status: "Completed", changed_by: "u_staff_1", timestamp: todayAt(9) }],
    created_at: daysAgo(6),
    updated_at: todayAt(9)
  },
  {
    order_id: "ORD-1002",
    customer_id: "CUS-1002",
    customer_name: "GZ Collective",
    phone_number: "+60123450002",
    item_id: "ITM-002",
    product_type: "Oversized Tee",
    quantity: 12,
    status: "Printing",
    payment_status: "Deposit",
    tracking_number: "",
    assigned_staff: "u_staff_1",
    notes: "Front print proof approved.",
    files: [{ file_url: "front-print-proof.png", file_type: "design", uploaded_by: "u_designer_1", timestamp: daysAgo(2) }],
    messages: [],
    timeline: [{ status: "New Order", changed_by: "u_staff_1", timestamp: daysAgo(3) }, { status: "Printing", changed_by: "u_staff_1", timestamp: daysAgo(1) }],
    created_at: daysAgo(3),
    updated_at: daysAgo(1)
  },
  {
    order_id: "ORD-1003",
    customer_id: "CUS-1003",
    customer_name: "ISCAMU",
    phone_number: "+60123450003",
    item_id: "ITM-003",
    product_type: "Embroidery Patch",
    quantity: 40,
    status: "Waiting Approval",
    payment_status: "Unpaid",
    tracking_number: "",
    assigned_staff: "u_designer_1",
    notes: "Waiting customer approval on patch mockup.",
    files: [{ file_url: "patch-reference.jpg", file_type: "reference", uploaded_by: "u_staff_1", timestamp: daysAgo(18) }],
    messages: [],
    timeline: [{ status: "New Order", changed_by: "u_staff_1", timestamp: daysAgo(18) }, { status: "Waiting Approval", changed_by: "u_designer_1", timestamp: daysAgo(16) }],
    created_at: daysAgo(18),
    updated_at: daysAgo(16)
  },
  {
    order_id: "ORD-1004",
    customer_id: "CUS-1004",
    customer_name: "Rex Subang",
    phone_number: "+60123450004",
    item_id: "ITM-001",
    product_type: "Premium Cap",
    quantity: 5,
    status: "Designing",
    payment_status: "Unpaid",
    tracking_number: "",
    assigned_staff: "u_designer_1",
    notes: "Logo needs cleanup before mockup.",
    files: [],
    messages: [],
    timeline: [{ status: "New Order", changed_by: "u_staff_1", timestamp: daysAgo(2) }, { status: "Designing", changed_by: "u_designer_1", timestamp: daysAgo(1) }],
    created_at: daysAgo(2),
    updated_at: daysAgo(1)
  }
];

const seedExpenses = [
  { expense_id: "EXP-1001", name: "lalamove", amount: 100, purchased_by: "u_admin_hang", account: "paramour bank", expense_date: todayAt(10), note: "" },
  { expense_id: "EXP-1002", name: "pray", amount: 120, purchased_by: "u_admin_hang", account: "cash", expense_date: daysAgo(1), note: "" },
  { expense_id: "EXP-1003", name: "sg ads top up", amount: 330, purchased_by: "u_admin_yh", account: "paramour bank", expense_date: daysAgo(2), note: "" },
  { expense_id: "EXP-1004", name: "SYSTEM DEPO", amount: 950, purchased_by: "u_admin_hang", account: "bank transfer", expense_date: daysAgo(3), note: "" },
  { expense_id: "EXP-1005", name: "lalamove + food", amount: 10, purchased_by: "u_admin_hang", account: "cash", expense_date: daysAgo(3), note: "" },
  { expense_id: "EXP-1006", name: "DTF X2 + sash + note pay", amount: 2900, purchased_by: "u_admin_zx", account: "paramour bank", expense_date: daysAgo(5), note: "" },
  { expense_id: "EXP-1007", name: "make app", amount: 50, purchased_by: "u_admin_yh", account: "cash", expense_date: daysAgo(6), note: "" },
  { expense_id: "EXP-1008", name: "righway", amount: 30.5, purchased_by: "u_admin_hang", account: "cash", expense_date: daysAgo(9), note: "" }
];

const seedHr = {
  staff: [
    { user_id: "u_staff_1", name: "Aina Staff", role: "STAFF", hourly_rate: 12, mc_days: 1, leave_days: 2, status: "ACTIVE" },
    { user_id: "u_designer_1", name: "Ravi Designer", role: "DESIGNER", hourly_rate: 15, mc_days: 0, leave_days: 1, status: "ACTIVE" }
  ],
  attendance: [
    { entry_id: "ATT-1001", user_id: "u_staff_1", clock_in: daysAgo(1), clock_out: addHours(daysAgo(1), 8), clock_in_ip: "127.0.0.1", clock_out_ip: "127.0.0.1" },
    { entry_id: "ATT-1002", user_id: "u_designer_1", clock_in: daysAgo(1), clock_out: addHours(daysAgo(1), 6.5), clock_in_ip: "127.0.0.1", clock_out_ip: "127.0.0.1" }
  ],
  leaves: [
    { leave_id: "LEV-1001", user_id: "u_staff_1", type: "MC", start_date: daysAgo(12), end_date: daysAgo(12), days: 1, note: "Clinic MC" },
    { leave_id: "LEV-1002", user_id: "u_designer_1", type: "Annual Leave", start_date: daysAgo(20), end_date: daysAgo(20), days: 1, note: "" }
  ]
};

const seedClosings = [
  {
    closing_id: "CLS-2026-03",
    month: "2026-03",
    expenses: [
      { label: "YH", amount: 6300 },
      { label: "JH", amount: 6300 },
      { label: "AFDAL", amount: 2233.4 },
      { label: "SYED", amount: 521.77 },
      { label: "TNB", amount: 500 },
      { label: "RENTAL", amount: 1500 },
      { label: "MKT", amount: 2200 },
      { label: "ZX", amount: 5300 },
      { label: "Shahril", amount: 1887 },
      { label: "adam", amount: 625.61 },
      { label: "miza", amount: 869 },
      { label: "water", amount: 35 },
      { label: "HAFIZ PT", amount: 537.6 },
      { label: "RENTAL", amount: 1600 }
    ],
    stock_expenses: [
      { label: "YH", amount: 6577, note: "" },
      { label: "jh spay", amount: 0, note: "" },
      { label: "JH", amount: 5705, note: "stock purchase" },
      { label: "ZX SPAY", amount: 961.3, note: "" }
    ],
    shopee_cash_out: [
      { label: "RS SHOPEE", amount: 6130 },
      { label: "PR SHOPEE", amount: 12035 },
      { label: "SG SHOPEE", amount: 10600 },
      { label: "DM Shopee", amount: 4089.43 },
      { label: "MG Shopee", amount: 3617.36 },
      { label: "tiktok", amount: 400 }
    ],
    shopee_sales: [
      { label: "RS SHOPEE", amount: 10110 },
      { label: "PR SHOPEE", amount: 15683 },
      { label: "SG SHOPEE", amount: 9200 },
      { label: "DM Shopee", amount: 6248 },
      { label: "MG Shopee", amount: 6281.99 },
      { label: "tiktok", amount: 534 }
    ],
    offline_unpaid: 43507,
    offline_sales: 100127,
    offline_half_deposit: 0,
    bank_balance: 346344,
    note: "stock purchase - rm20,000"
  }
];

const royaltyFreeTracks = [
  { track_id: "rf_001", title: "Bright Pop Bounce", mood: "upbeat", source: "royalty-free catalog" },
  { track_id: "rf_002", title: "Clean Fashion Beat", mood: "stylish", source: "royalty-free catalog" },
  { track_id: "rf_003", title: "Soft Product Glow", mood: "calm", source: "royalty-free catalog" },
  { track_id: "rf_004", title: "Fast Promo Pulse", mood: "energetic", source: "royalty-free catalog" }
];

const seedVideoRequests = [
  {
    request_id: "VID-1001",
    title: "Cap packing TikTok",
    raw_footage_url: "",
    raw_footage: [],
    sample_video_link: "https://www.tiktok.com/",
    caption: "Custom caps packed and ready.",
    selected_song: "Bright Pop Bounce",
    font_style: "Bold captions",
    assigned_designer: "u_designer_1",
    status: "Brief",
    edit_plan: "Hook in first 2 seconds, quick cuts, product close-up, bold caption overlays, upbeat royalty-free track.",
    final_video_url: "",
    notes: "Make it fast and clean.",
    created_by: "u_admin",
    created_at: daysAgo(1),
    updated_at: daysAgo(1)
  }
];

const expenses = await loadExpenses();
const expensesSheetConfig = await loadExpensesSheetConfig();
const hr = await loadHr();
const monthlyClosings = await loadClosings();
const orderStore = await loadOrderStore();
const videoRequests = await loadVideoRequests();
const customers = orderStore.customers;
const orders = orderStore.orders;
const sessions = new Map();

function todayAt(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function addHours(dateIso, hours) {
  const date = new Date(dateIso);
  date.setMinutes(date.getMinutes() + hours * 60);
  return date.toISOString();
}

function itemWithProfit(item) {
  return {
    ...item,
    profit: roundMoney(item.selling_price - item.base_cost)
  };
}

function orderFinancials(order) {
  const item = items.find((candidate) => candidate.item_id === order.item_id);
  const item_cost = item?.base_cost ?? 0;
  const selling_price = item?.selling_price ?? 0;
  const total_cost = roundMoney(item_cost * order.quantity);
  const total_sales = roundMoney(selling_price * order.quantity);
  const total_profit = roundMoney(total_sales - total_cost);

  return {
    ...order,
    item_name: item?.item_name ?? "Unknown item",
    item_cost,
    selling_price,
    total_cost,
    total_sales,
    total_profit
  };
}

function publicOrder(order) {
  const item = items.find((candidate) => candidate.item_id === order.item_id);
  const assignee = users.find((user) => user.id === order.assigned_staff);
  return {
    order_id: order.order_id,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    phone_number: order.phone_number,
    item_id: order.item_id,
    item_name: item?.item_name ?? order.product_type,
    product_type: order.product_type,
    quantity: order.quantity,
    status: order.status,
    payment_status: order.payment_status,
    tracking_number: order.tracking_number,
    assigned_staff: order.assigned_staff,
    assigned_staff_name: assignee?.name ?? "Unassigned",
    notes: order.notes,
    files: order.files,
    timeline: order.timeline,
    messages: order.messages,
    file_count: order.files.length,
    message_count: order.messages.length,
    created_at: order.created_at,
    updated_at: order.updated_at
  };
}

function orderDetail(order) {
  return {
    ...publicOrder(order),
    timeline: order.timeline,
    messages: order.messages,
    files: order.files,
    customer: customerDetail(order.customer_id)
  };
}

function customerDetail(customerId) {
  const customer = customers.find((candidate) => candidate.customer_id === customerId);
  if (!customer) return null;
  return {
    ...customer,
    orders: orders
      .filter((order) => order.customer_id === customer.customer_id)
      .map((order) => ({
        order_id: order.order_id,
        product_type: order.product_type,
        status: order.status,
        created_at: order.created_at
      }))
  };
}

function findOrCreateCustomer(customer_name, phone_number) {
  const existing = customers.find((customer) => customer.phone_number === phone_number);
  if (existing) {
    existing.customer_name = customer_name || existing.customer_name;
    return existing;
  }
  const customer = {
    customer_id: `CUS-${Date.now()}`,
    customer_name,
    phone_number,
    created_at: new Date().toISOString()
  };
  customers.push(customer);
  return customer;
}

function staffUsers() {
  return users
    .filter((user) => user.role === "STAFF" || user.role === "DESIGNER")
    .map((user) => ({ id: user.id, name: user.name, role: user.role }));
}

function automationMessage(order, nextStatus) {
  if (nextStatus === "Waiting Approval") {
    return `Your design is ready. Please review and reply Confirm or Redesign. Approval ID: ${order.order_id}`;
  }
  if (nextStatus === "Ready for Payment") {
    return "Your order is ready. Please proceed with payment.";
  }
  if (nextStatus === "Shipped") {
    return `Your order has shipped. Tracking number: ${order.tracking_number || "pending"}`;
  }
  return null;
}

function latestDesignFile(order) {
  return [...order.files].reverse().find((file) => file.file_type === "design") ?? null;
}

function appendMessage(order, content, type = "manual", extra = {}) {
  const message = {
    message_id: `MSG-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    order_id: order.order_id,
    customer_name: order.customer_name,
    phone_number: order.phone_number,
    message_content: content,
    type,
    sent_at: new Date().toISOString(),
    status: "simulated",
    direction: type === "customer_reply" ? "inbound" : "outbound",
    provider: "simulation",
    customer_action: null,
    related_file_url: null,
    ...extra
  };
  order.messages.push(message);
  return message;
}

function whatsappMessages() {
  return orders
    .flatMap((order) => order.messages.map((message) => ({ ...message, order_status: order.status })))
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
}

function simulateCustomerApproval(order, action, note, user) {
  const normalized = String(action).toLowerCase();
  if (!["confirm", "redesign"].includes(normalized)) {
    throw new Error("action must be confirm or redesign");
  }
  const content =
    normalized === "confirm"
      ? "Customer confirmed the design."
      : `Customer requested redesign${note ? `: ${note}` : "."}`;
  const message = appendMessage(order, content, "customer_reply", {
    customer_action: normalized,
    status: "received"
  });
  applyStatusChange(order, normalized === "confirm" ? "Approved" : "Designing", user, {});
  if (note) order.notes = `${order.notes ? `${order.notes}\n` : ""}Redesign note: ${note}`;
  return message;
}

function applyStatusChange(order, nextStatus, user, extra = {}) {
  if (!orderStatuses.includes(nextStatus)) {
    throw new Error("Invalid order status");
  }
  order.status = nextStatus;
  if (extra.payment_status !== undefined) order.payment_status = String(extra.payment_status);
  if (extra.tracking_number !== undefined) order.tracking_number = String(extra.tracking_number);
  order.updated_at = new Date().toISOString();
  order.timeline.push({
    status: nextStatus,
    changed_by: user.id,
    timestamp: order.updated_at
  });

  const automated = automationMessage(order, nextStatus);
  if (automated) appendMessage(order, automated, "auto");
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function loadExpenses() {
  try {
    return JSON.parse(await readFile(expensesFile, "utf8"));
  } catch {
    await persistExpenses(seedExpenses);
    return [...seedExpenses];
  }
}

async function persistExpenses(nextExpenses = expenses) {
  await mkdir(path.dirname(expensesFile), { recursive: true });
  await writeFile(expensesFile, JSON.stringify(nextExpenses, null, 2));
}

async function loadExpensesSheetConfig() {
  try {
    return JSON.parse(await readFile(expensesSheetFile, "utf8"));
  } catch {
    const config = { sheet_url: "", last_synced_at: null, last_count: 0, last_error: "" };
    await persistExpensesSheetConfig(config);
    return config;
  }
}

async function persistExpensesSheetConfig(config = expensesSheetConfig) {
  await mkdir(path.dirname(expensesSheetFile), { recursive: true });
  await writeFile(expensesSheetFile, JSON.stringify(config, null, 2));
}

async function loadHr() {
  try {
    return JSON.parse(await readFile(hrFile, "utf8"));
  } catch {
    await persistHr(seedHr);
    return structuredClone(seedHr);
  }
}

async function persistHr(nextHr = hr) {
  await mkdir(path.dirname(hrFile), { recursive: true });
  await writeFile(hrFile, JSON.stringify(nextHr, null, 2));
}

async function loadOrderStore() {
  try {
    return JSON.parse(await readFile(ordersFile, "utf8"));
  } catch {
    const store = {
      customers: structuredClone(seedCustomers),
      orders: structuredClone(seedOrders)
    };
    await persistOrderStore(store);
    return store;
  }
}

async function persistOrderStore(store = orderStore) {
  await mkdir(path.dirname(ordersFile), { recursive: true });
  await writeFile(ordersFile, JSON.stringify(store, null, 2));
}

async function loadVideoRequests() {
  try {
    return JSON.parse(await readFile(videoFile, "utf8"));
  } catch {
    await persistVideoRequests(seedVideoRequests);
    return structuredClone(seedVideoRequests);
  }
}

async function persistVideoRequests(nextRequests = videoRequests) {
  await mkdir(path.dirname(videoFile), { recursive: true });
  await writeFile(videoFile, JSON.stringify(nextRequests, null, 2));
}

async function loadClosings() {
  try {
    return JSON.parse(await readFile(closingsFile, "utf8"));
  } catch {
    await persistClosings(seedClosings);
    return structuredClone(seedClosings);
  }
}

async function persistClosings(nextClosings = monthlyClosings) {
  await mkdir(path.dirname(closingsFile), { recursive: true });
  await writeFile(closingsFile, JSON.stringify(nextClosings, null, 2));
}

function requireAuth(req, res) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = token ? sessions.get(token) : null;
  if (!user) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    sendJson(res, 403, { error: "Admin access required" });
    return null;
  }
  return user;
}

function requireDesigner(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== "DESIGNER") {
    sendJson(res, 403, { error: "Designer access required" });
    return null;
  }
  return user;
}

function requireVideoAccess(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "DESIGNER") {
    sendJson(res, 403, { error: "Video studio access requires Admin or Designer role" });
    return null;
  }
  return user;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "")
    .replace(/^::ffff:/, "");
}

function isOfficeNetwork(req) {
  const ip = clientIp(req);
  const allowedIps = (process.env.OFFICE_IPS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    allowedIps.includes(ip)
  );
}

function requireOfficeNetwork(req, res) {
  if (isOfficeNetwork(req)) return true;
  sendJson(res, 403, { error: "Clock in/out is allowed only from office WiFi/network" });
  return false;
}

function samePeriod(dateIso, period) {
  const now = new Date();
  const date = new Date(dateIso);

  if (period === "today") {
    return date.toDateString() === now.toDateString();
  }

  if (period === "week") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return date >= start && date <= now;
  }

  if (period === "month") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  return date.getFullYear() === now.getFullYear();
}

function summarize(period) {
  const filtered = orders.map(orderFinancials).filter((order) => samePeriod(order.created_at, period));
  return filtered.reduce(
    (summary, order) => ({
      sales: roundMoney(summary.sales + order.total_sales),
      profit: roundMoney(summary.profit + order.total_profit),
      orders: summary.orders + 1
    }),
    { sales: 0, profit: 0, orders: 0 }
  );
}

function staffPerformance() {
  return users
    .filter((user) => user.role === "STAFF" || user.role === "DESIGNER")
    .map((user) => {
      const userOrders = orders
        .filter((order) => order.assigned_staff === user.id)
        .map(orderFinancials);
      return {
        user_id: user.id,
        name: user.name,
        role: user.role,
        orders_handled: userOrders.length,
        orders_completed: userOrders.filter((order) => order.status === "Completed").length,
        total_sales_generated: roundMoney(userOrders.reduce((total, order) => total + order.total_sales, 0)),
        total_profit_generated: roundMoney(userOrders.reduce((total, order) => total + order.total_profit, 0))
      };
    });
}

function trendData() {
  const buckets = new Map();
  for (const order of orders.map(orderFinancials)) {
    const key = order.created_at.slice(0, 10);
    const existing = buckets.get(key) ?? { date: key, sales: 0, profit: 0 };
    existing.sales = roundMoney(existing.sales + order.total_sales);
    existing.profit = roundMoney(existing.profit + order.total_profit);
    buckets.set(key, existing);
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function adminUsers() {
  return users
    .filter((user) => user.role === "ADMIN")
    .map((user) => ({ id: user.id, name: user.name }));
}

function expenseRecord(expense) {
  const purchaser = users.find((user) => user.id === expense.purchased_by);
  return {
    ...expense,
    purchaser_name: purchaser?.name ?? "Unknown admin",
    amount: roundMoney(expense.amount)
  };
}

function addToBucket(map, key, label, amount) {
  const existing = map.get(key) ?? { key, label, total: 0, count: 0 };
  existing.total = roundMoney(existing.total + amount);
  existing.count += 1;
  map.set(key, existing);
}

function expenseSummary() {
  const byAdmin = new Map();
  const byAccount = new Map();
  const records = expenses.map(expenseRecord);
  const total = records.reduce((sum, expense) => roundMoney(sum + expense.amount), 0);
  const month = records
    .filter((expense) => samePeriod(expense.expense_date, "month"))
    .reduce((sum, expense) => roundMoney(sum + expense.amount), 0);
  const today = records
    .filter((expense) => samePeriod(expense.expense_date, "today"))
    .reduce((sum, expense) => roundMoney(sum + expense.amount), 0);

  for (const expense of records) {
    addToBucket(byAdmin, expense.purchased_by, expense.purchaser_name, expense.amount);
    addToBucket(byAccount, expense.account, expense.account, expense.amount);
  }

  return {
    total,
    month,
    today,
    count: records.length,
    by_admin: [...byAdmin.values()].sort((a, b) => b.total - a.total),
    by_account: [...byAccount.values()].sort((a, b) => b.total - a.total)
  };
}

function googleSheetCsvUrl(sheetUrl) {
  const raw = String(sheetUrl || "").trim();
  if (!raw) return "";
  if (/\/pub\?/.test(raw) || /output=csv/i.test(raw) || /\/export\?format=csv/i.test(raw)) return raw;

  const id = raw.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!id) return raw;
  const gid = raw.match(/[?&]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseMoney(value) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? roundMoney(match[0]) : 0;
}

function sheetAdminFromRow(headers, row) {
  const adminHeaders = adminUsers();
  for (let index = 0; index < headers.length; index += 1) {
    const header = String(headers[index] || "").trim();
    const normalizedHeader = normalizeHeader(header);
    const admin = adminHeaders.find((candidate) => {
      const normalizedName = normalizeHeader(candidate.name);
      return normalizedHeader === normalizedName || normalizedHeader.endsWith(`_${normalizedName}`) || normalizedHeader.includes(`_${normalizedName}_`);
    });
    if (admin && String(row[index] || "").trim()) return admin.id;
  }
  return "u_admin";
}

function sheetAccountFromRow(headers, row) {
  const normalized = headers.map(normalizeHeader);
  const accountIndex = normalized.findIndex((header) => ["account", "bank", "payment_account"].includes(header));
  if (accountIndex >= 0 && String(row[accountIndex] || "").trim()) return String(row[accountIndex]).trim();

  const knownAccounts = ["paramour bank", "bank transfer", "cash", "transfer", "bank"];
  for (let index = 0; index < headers.length; index += 1) {
    const header = String(headers[index] || "").trim().toLowerCase();
    if (knownAccounts.includes(header) && String(row[index] || "").trim()) return header;
  }
  return "google sheet";
}

function sheetDateFromRow(headers, row) {
  const normalized = headers.map(normalizeHeader);
  const dateIndex = normalized.findIndex((header) => ["date", "expense_date", "day"].includes(header));
  if (dateIndex < 0 || !String(row[dateIndex] || "").trim()) return new Date().toISOString();
  const parsed = new Date(row[dateIndex]);
  return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
}

function expensesFromSheetCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => String(value || "").trim());
  const normalized = headers.map(normalizeHeader);
  const nameIndex = normalized.findIndex((header) => ["name_of_cost", "name", "cost_name", "expense", "item"].includes(header));
  const amountIndex = normalized.findIndex((header) => ["total_cost", "amount", "total", "cost", "rm"].includes(header));
  if (nameIndex < 0 || amountIndex < 0) {
    throw new Error("Sheet must include NAME OF COST and TOTAL COST columns");
  }

  return rows.slice(1).map((row, index) => {
    const name = String(row[nameIndex] || "").trim();
    const amount = parseMoney(row[amountIndex]);
    if (!name || amount <= 0) return null;
    return {
      expense_id: `GSHEET-${index + 2}-${Buffer.from(`${name}:${amount}`).toString("base64url").slice(0, 12)}`,
      name,
      amount,
      purchased_by: sheetAdminFromRow(headers, row),
      account: sheetAccountFromRow(headers, row),
      expense_date: sheetDateFromRow(headers, row),
      note: "Google Sheet sync",
      source: "google_sheet",
      source_row: index + 2
    };
  }).filter(Boolean);
}

async function syncExpensesFromSheet(sheetUrl = expensesSheetConfig.sheet_url) {
  const csvUrl = googleSheetCsvUrl(sheetUrl);
  if (!csvUrl) throw new Error("Google Sheet URL is required");
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error(`Google Sheet sync failed with ${response.status}`);
  const importedExpenses = expensesFromSheetCsv(await response.text());
  const manualExpenses = expenses.filter((expense) => expense.source !== "google_sheet");
  expenses.splice(0, expenses.length, ...manualExpenses, ...importedExpenses);
  expensesSheetConfig.sheet_url = sheetUrl;
  expensesSheetConfig.last_synced_at = new Date().toISOString();
  expensesSheetConfig.last_count = importedExpenses.length;
  expensesSheetConfig.last_error = "";
  await persistExpenses();
  await persistExpensesSheetConfig();
  return importedExpenses;
}

function attendanceHours(entry) {
  if (!entry.clock_in || !entry.clock_out) return 0;
  return roundMoney((new Date(entry.clock_out) - new Date(entry.clock_in)) / 36e5);
}

function staffProfile(userId) {
  const user = users.find((candidate) => candidate.id === userId);
  const profile = hr.staff.find((candidate) => candidate.user_id === userId);
  if (!user || !profile) return null;
  const attendance = hr.attendance.filter((entry) => entry.user_id === userId);
  const completed = attendance.filter((entry) => entry.clock_out);
  const openShift = attendance.find((entry) => !entry.clock_out);
  const totalHours = completed.reduce((sum, entry) => roundMoney(sum + attendanceHours(entry)), 0);
  const monthHours = completed
    .filter((entry) => samePeriod(entry.clock_in, "month"))
    .reduce((sum, entry) => roundMoney(sum + attendanceHours(entry)), 0);

  return {
    ...profile,
    name: user.name,
    role: user.role,
    total_hours: totalHours,
    month_hours: monthHours,
    estimated_month_pay: roundMoney(monthHours * profile.hourly_rate),
    open_shift: openShift ?? null,
    attendance: attendance
      .map((entry) => ({ ...entry, hours: attendanceHours(entry) }))
      .sort((a, b) => b.clock_in.localeCompare(a.clock_in)),
    leaves: hr.leaves
      .filter((leave) => leave.user_id === userId)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
  };
}

function adminHrSummary() {
  const staff = hr.staff.map((profile) => staffProfile(profile.user_id)).filter(Boolean);
  return {
    staff,
    total_month_hours: roundMoney(staff.reduce((sum, profile) => sum + profile.month_hours, 0)),
    estimated_month_pay: roundMoney(staff.reduce((sum, profile) => sum + profile.estimated_month_pay, 0)),
    active_now: staff.filter((profile) => profile.open_shift).length,
    leave_records: hr.leaves.length
  };
}

function publicClockProfile(user) {
  const profile = staffProfile(user.id);
  if (!profile) return null;
  return {
    user_id: profile.user_id,
    name: profile.name,
    role: profile.role,
    open_shift: profile.open_shift,
    attendance: profile.attendance.slice(0, 10).map((entry) => ({
      entry_id: entry.entry_id,
      clock_in: entry.clock_in,
      clock_out: entry.clock_out,
      hours: entry.hours
    })),
    leaves: profile.leaves.map((leave) => ({
      leave_id: leave.leave_id,
      type: leave.type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      days: leave.days,
      note: leave.note
    }))
  };
}

function designerUsers() {
  return users
    .filter((user) => user.role === "DESIGNER")
    .map((user) => ({ id: user.id, name: user.name }));
}

function videoRequestRecord(request) {
  const designer = users.find((user) => user.id === request.assigned_designer);
  return {
    ...request,
    raw_footage: request.raw_footage ?? (request.raw_footage_url ? [{ footage_id: "legacy", filename: "Raw footage", file_url: request.raw_footage_url, uploaded_at: request.created_at }] : []),
    assigned_designer_name: designer?.name ?? "Unassigned"
  };
}

function buildVideoEditPlan({ caption, sample_video_link, selected_song, font_style, notes }) {
  const hook = caption ? `Open with caption hook: "${caption}".` : "Open with a bold product hook.";
  const reference = sample_video_link ? `Match pacing from sample: ${sample_video_link}.` : "Use short TikTok-style pacing.";
  const music = selected_song ? `Use royalty-free track: ${selected_song}.` : "Choose the best royalty-free upbeat track.";
  const font = font_style ? `Caption style: ${font_style}.` : "Caption style: bold, readable mobile text.";
  const note = notes ? `Editor notes: ${notes}.` : "Keep cut under 20 seconds if possible.";
  return `${hook} ${reference} ${music} ${font} Add quick cuts, product close-ups, beat-synced transitions, and a final call-to-action. ${note}`;
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function normalizedPhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function isAllowedDesignFile(filename, fileUrl) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  const mime = /^data:([^;]+);base64,/i.exec(String(fileUrl || ""))?.[1]?.toLowerCase() ?? "";
  const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".pdf", ".ppt", ".pptx", ".webp", ".svg", ".ai", ".psd"]);
  const allowedMimes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/postscript",
    "image/vnd.adobe.photoshop",
    ""
  ]);
  return allowedExtensions.has(extension) && allowedMimes.has(mime);
}

function videoExtension(mime) {
  if (mime === "video/quicktime") return ".mov";
  if (mime === "video/webm") return ".webm";
  return ".mp4";
}

function ffmpegText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

function trackFrequency(trackTitle) {
  const index = Math.max(0, royaltyFreeTracks.findIndex((track) => track.title === trackTitle));
  return [220, 277, 330, 392][index % 4];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT" || error.code === "EPERM") {
        reject(new Error("FFmpeg is not installed or not available on PATH"));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-1200) || `FFmpeg exited with code ${code}`));
    });
  });
}

async function renderVideoRequest(request) {
  const footage = request.raw_footage?.[0]?.file_url || request.raw_footage_url;
  const raw = dataUrlToBuffer(footage);
  if (!raw) {
    throw new Error("Upload raw footage before rendering");
  }

  await mkdir(videoAssetDir, { recursive: true });
  await mkdir(videoRenderDir, { recursive: true });

  const inputPath = path.join(videoAssetDir, `${request.request_id}-raw${videoExtension(raw.mime)}`);
  const outputName = `${request.request_id}-${Date.now()}.mp4`;
  const outputPath = path.join(videoRenderDir, outputName);
  await writeFile(inputPath, raw.buffer);

  const caption = ffmpegText(request.caption);
  const frequency = trackFrequency(request.selected_song);
  const filter = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,trim=duration=20,setpts=PTS-STARTPTS,drawtext=text='${caption}':fontcolor=white:fontsize=64:box=1:boxcolor=black@0.58:boxborderw=24:x=(w-text_w)/2:y=h-360[v]`,
    `[1:a]atrim=duration=20,afade=t=out:st=18:d=2[a]`
  ].join(";");

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequency}:sample_rate=44100`,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  ]);

  return `/media/video-renders/${outputName}`;
}

function moneyItems(items = []) {
  return items
    .filter((item) => item && String(item.label ?? "").trim())
    .map((item) => ({
      label: String(item.label).trim(),
      amount: roundMoney(item.amount || 0),
      ...(item.note ? { note: String(item.note) } : {})
    }));
}

function sumItems(items = []) {
  return roundMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

function closingCalculations(closing) {
  const expensesTotal = sumItems(closing.expenses);
  const stockTotal = sumItems(closing.stock_expenses);
  const totalExpenses = roundMoney(expensesTotal + stockTotal);
  const shopeeCashOutTotal = sumItems(closing.shopee_cash_out);
  const shopeeSalesTotal = sumItems(closing.shopee_sales);
  const offlineSales = roundMoney(closing.offline_sales || 0);
  const offlineHalfDeposit = roundMoney(closing.offline_half_deposit || 0);
  const offlineUnpaid = roundMoney(closing.offline_unpaid || 0);
  const offlinePaidSales = roundMoney(Math.max(offlineSales - offlineUnpaid - offlineHalfDeposit, 0));
  const offlinePlusShopeeSales = roundMoney(offlineSales + shopeeSalesTotal);
  const collectedSales = roundMoney(offlinePaidSales + offlineHalfDeposit + shopeeCashOutTotal);
  const gainProfit = roundMoney(collectedSales - totalExpenses);
  const bankBalance = roundMoney(closing.bank_balance || 0);
  const bankNewBalance = roundMoney(bankBalance + gainProfit);

  return {
    expenses_total: expensesTotal,
    stock_total: stockTotal,
    total_expenses: totalExpenses,
    shopee_cash_out_total: shopeeCashOutTotal,
    shopee_sales_total: shopeeSalesTotal,
    offline_sales: offlineSales,
    offline_half_deposit: offlineHalfDeposit,
    offline_unpaid: offlineUnpaid,
    offline_paid_sales: offlinePaidSales,
    offline_plus_shopee_sales: offlinePlusShopeeSales,
    collected_sales: collectedSales,
    bank_balance: bankBalance,
    gain_profit: gainProfit,
    bank_new_balance: bankNewBalance
  };
}

function closingRecord(closing) {
  return {
    ...closing,
    calculations: closingCalculations(closing)
  };
}

function normalizeClosing(body) {
  const month = String(body.month || new Date().toISOString().slice(0, 7));
  return {
    closing_id: String(body.closing_id || `CLS-${month}`),
    month,
    expenses: moneyItems(body.expenses),
    stock_expenses: moneyItems(body.stock_expenses),
    shopee_cash_out: moneyItems(body.shopee_cash_out),
    shopee_sales: moneyItems(body.shopee_sales),
    offline_unpaid: roundMoney(body.offline_unpaid || 0),
    offline_sales: roundMoney(body.offline_sales || 0),
    offline_half_deposit: roundMoney(body.offline_half_deposit || 0),
    bank_balance: roundMoney(body.bank_balance || 0),
    note: body.note ? String(body.note) : ""
  };
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res) {
  const requested = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = requested === "/" ? "/index.html" : requested;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    }[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function serveMedia(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relative = requested.replace(/^\/media\//, "");
  const filePath = path.normalize(path.join(dataDir, relative));

  if (!filePath.startsWith(dataDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm"
    }[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const user = users.find((candidate) => candidate.username === body.username && candidate.password === body.password);
    if (!user) {
      sendJson(res, 401, { error: "Invalid username or password" });
      return;
    }
    const token = randomUUID();
    sessions.set(token, user);
    sendJson(res, 200, {
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const user = requireAuth(req, res);
    if (!user) return;
    sendJson(res, 200, { id: user.id, name: user.name, username: user.username, role: user.role });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/orders") {
    const user = requireAuth(req, res);
    if (!user) return;
    sendJson(res, 200, {
      orders: orders.map(publicOrder),
      statuses: orderStatuses,
      staff: staffUsers()
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const user = requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    if (!body.customer_name || !body.phone_number || !body.product_type || !body.quantity) {
      sendJson(res, 400, { error: "customer_name, phone_number, product_type, and quantity are required" });
      return;
    }
    const customer = findOrCreateCustomer(String(body.customer_name), String(body.phone_number));
    const now = new Date().toISOString();
    const order = {
      order_id: `ORD-${Date.now()}`,
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      phone_number: customer.phone_number,
      item_id: body.item_id ? String(body.item_id) : "",
      product_type: String(body.product_type),
      quantity: Number(body.quantity),
      status: "New Order",
      payment_status: body.payment_status ? String(body.payment_status) : "Unpaid",
      tracking_number: body.tracking_number ? String(body.tracking_number) : "",
      assigned_staff: body.assigned_staff ? String(body.assigned_staff) : user.id,
      notes: body.notes ? String(body.notes) : "",
      files: [],
      messages: [],
      timeline: [{ status: "New Order", changed_by: user.id, timestamp: now }],
      created_at: now,
      updated_at: now
    };
    orders.unshift(order);
    await persistOrderStore();
    sendJson(res, 201, { order: orderDetail(order) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/customers") {
    const user = requireAuth(req, res);
    if (!user) return;
    sendJson(res, 200, { customers: customers.map((customer) => customerDetail(customer.customer_id)) });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/orders/")) {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = decodeURIComponent(url.pathname.split("/").at(-1));
    const order = orders.find((candidate) => candidate.order_id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    await persistOrderStore();
    sendJson(res, 200, { order: orderDetail(order) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/hr/me") {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role === "ADMIN") {
      sendJson(res, 200, { profile: null, office_network: isOfficeNetwork(req) });
      return;
    }
    const profile = publicClockProfile(user);
    if (!profile) {
      sendJson(res, 404, { error: "Staff profile not found" });
      return;
    }
    sendJson(res, 200, { profile, office_network: isOfficeNetwork(req) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/video-requests") {
    const user = requireVideoAccess(req, res);
    if (!user) return;
    const requests = user.role === "ADMIN"
      ? videoRequests
      : videoRequests.filter((request) => request.assigned_designer === user.id);
    sendJson(res, 200, {
      requests: requests.map(videoRequestRecord).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      designers: designerUsers(),
      tracks: royaltyFreeTracks,
      statuses: ["Brief", "Editing", "Review", "Revision", "Ready", "Posted"]
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/video-requests") {
    const user = requireVideoAccess(req, res);
    if (!user) return;
    const body = await readBody(req);
    if (!body.title || !body.caption) {
      sendJson(res, 400, { error: "title and caption are required" });
      return;
    }
    const assignedDesigner = body.assigned_designer || designerUsers()[0]?.id || "";
    const selectedSong = body.selected_song || royaltyFreeTracks[0].title;
    const now = new Date().toISOString();
    const request = {
      request_id: `VID-${Date.now()}`,
      title: String(body.title),
      raw_footage_url: body.raw_footage_url ? String(body.raw_footage_url) : "",
      raw_footage: Array.isArray(body.raw_footage)
        ? body.raw_footage.map((clip, index) => ({
            footage_id: `RAW-${Date.now()}-${index}`,
            filename: String(clip.filename || `Raw footage ${index + 1}`),
            file_url: String(clip.file_url || clip.raw_footage_url || ""),
            uploaded_at: now
          })).filter((clip) => clip.file_url)
        : body.raw_footage_url
          ? [{ footage_id: `RAW-${Date.now()}`, filename: String(body.raw_filename || "Raw footage"), file_url: String(body.raw_footage_url), uploaded_at: now }]
          : [],
      sample_video_link: body.sample_video_link ? String(body.sample_video_link) : "",
      caption: String(body.caption),
      selected_song: String(selectedSong),
      font_style: body.font_style ? String(body.font_style) : "Bold captions",
      assigned_designer: String(assignedDesigner),
      status: "Brief",
      edit_plan: buildVideoEditPlan({ ...body, selected_song: selectedSong }),
      final_video_url: "",
      notes: body.notes ? String(body.notes) : "",
      created_by: user.id,
      created_at: now,
      updated_at: now
    };
    videoRequests.unshift(request);
    await persistVideoRequests();
    sendJson(res, 201, { request: videoRequestRecord(request) });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/video-requests/")) {
    const user = requireVideoAccess(req, res);
    if (!user) return;
    const requestId = decodeURIComponent(url.pathname.split("/").at(-1));
    const request = videoRequests.find((candidate) => candidate.request_id === requestId);
    if (!request) {
      sendJson(res, 404, { error: "Video request not found" });
      return;
    }
    if (user.role !== "ADMIN" && request.assigned_designer !== user.id) {
      sendJson(res, 403, { error: "Designer can update only assigned video requests" });
      return;
    }
    const body = await readBody(req);
    for (const key of ["status", "final_video_url", "notes", "selected_song", "font_style", "sample_video_link", "caption", "edit_plan"]) {
      if (body[key] !== undefined) request[key] = String(body[key]);
    }
    if (body.raw_footage_url !== undefined) {
      request.raw_footage_url = String(body.raw_footage_url);
      request.raw_footage ??= [];
      request.raw_footage.push({
        footage_id: `RAW-${Date.now()}`,
        filename: String(body.raw_filename || `Raw footage ${request.raw_footage.length + 1}`),
        file_url: String(body.raw_footage_url),
        uploaded_at: new Date().toISOString()
      });
    }
    if (Array.isArray(body.raw_footage)) {
      request.raw_footage ??= [];
      for (const clip of body.raw_footage) {
        if (!clip.file_url) continue;
        request.raw_footage.push({
          footage_id: `RAW-${Date.now()}-${request.raw_footage.length}`,
          filename: String(clip.filename || `Raw footage ${request.raw_footage.length + 1}`),
          file_url: String(clip.file_url),
          uploaded_at: new Date().toISOString()
        });
      }
      request.raw_footage_url = request.raw_footage[0]?.file_url || "";
    }
    if (user.role === "ADMIN" && body.assigned_designer !== undefined) request.assigned_designer = String(body.assigned_designer);
    if (body.regenerate_plan) request.edit_plan = buildVideoEditPlan(request);
    request.updated_at = new Date().toISOString();
    await persistVideoRequests();
    sendJson(res, 200, { request: videoRequestRecord(request) });
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/render") && url.pathname.startsWith("/api/video-requests/")) {
    const user = requireVideoAccess(req, res);
    if (!user) return;
    const requestId = decodeURIComponent(url.pathname.split("/").at(-2));
    const request = videoRequests.find((candidate) => candidate.request_id === requestId);
    if (!request) {
      sendJson(res, 404, { error: "Video request not found" });
      return;
    }
    if (user.role !== "ADMIN" && request.assigned_designer !== user.id) {
      sendJson(res, 403, { error: "Designer can render only assigned video requests" });
      return;
    }

    request.status = "Editing";
    request.render_status = "rendering";
    request.render_error = "";
    request.updated_at = new Date().toISOString();
    await persistVideoRequests();

    try {
      const finalUrl = await renderVideoRequest(request);
      request.final_video_url = finalUrl;
      request.status = "Review";
      request.render_status = "done";
      request.updated_at = new Date().toISOString();
      await persistVideoRequests();
      sendJson(res, 200, { request: videoRequestRecord(request) });
    } catch (error) {
      request.render_status = "failed";
      request.render_error = error.message;
      request.updated_at = new Date().toISOString();
      await persistVideoRequests();
      const status = /FFmpeg is not installed|ENOENT|not recognized|spawn/i.test(error.message) ? 501 : 400;
      sendJson(res, status, { error: error.message, request: videoRequestRecord(request) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/hr/clock-in") {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role === "ADMIN") {
      sendJson(res, 403, { error: "Admin users do not clock in here" });
      return;
    }
    if (!requireOfficeNetwork(req, res)) return;
    if (!staffProfile(user.id)) {
      sendJson(res, 404, { error: "Staff profile not found" });
      return;
    }
    if (hr.attendance.some((entry) => entry.user_id === user.id && !entry.clock_out)) {
      sendJson(res, 409, { error: "You are already clocked in" });
      return;
    }
    hr.attendance.push({
      entry_id: `ATT-${Date.now()}`,
      user_id: user.id,
      clock_in: new Date().toISOString(),
      clock_out: null,
      clock_in_ip: clientIp(req),
      clock_out_ip: null
    });
    await persistHr();
    sendJson(res, 201, { profile: publicClockProfile(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/hr/clock-out") {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role === "ADMIN") {
      sendJson(res, 403, { error: "Admin users do not clock out here" });
      return;
    }
    if (!requireOfficeNetwork(req, res)) return;
    const entry = hr.attendance.find((candidate) => candidate.user_id === user.id && !candidate.clock_out);
    if (!entry) {
      sendJson(res, 409, { error: "You are not clocked in" });
      return;
    }
    entry.clock_out = new Date().toISOString();
    entry.clock_out_ip = clientIp(req);
    await persistHr();
    sendJson(res, 200, { profile: publicClockProfile(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/designer/design-submissions") {
    const user = requireDesigner(req, res);
    if (!user) return;
    const body = await readBody(req);
    const orderId = String(body.order_id || "").trim();
    const phoneNumber = String(body.phone_number || "").trim();
    const filename = String(body.filename || "").trim();
    const fileUrl = String(body.file_url || "");

    if (!orderId) {
      sendJson(res, 400, { error: "order_id is required" });
      return;
    }
    if (!phoneNumber) {
      sendJson(res, 400, { error: "phone_number is required" });
      return;
    }
    if (!filename || !fileUrl) {
      sendJson(res, 400, { error: "design file is required" });
      return;
    }

    const order = orders.find((candidate) => candidate.order_id.toLowerCase() === orderId.toLowerCase());
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    if (normalizedPhone(order.phone_number) !== normalizedPhone(phoneNumber)) {
      sendJson(res, 403, { error: "Phone number does not match this order" });
      return;
    }
    if (!isAllowedDesignFile(filename, fileUrl)) {
      sendJson(res, 400, { error: "Upload PNG, JPEG, PDF, PPT, PPTX, WEBP, SVG, AI, or PSD files only" });
      return;
    }

    const file = {
      file_id: `FILE-${Date.now()}`,
      filename,
      file_url: fileUrl,
      file_type: "customer_design",
      uploaded_by: user.id,
      source: "shopee_customer_upload",
      phone_number: phoneNumber,
      timestamp: new Date().toISOString()
    };
    order.files.push(file);
    order.updated_at = file.timestamp;
    await persistOrderStore();
    sendJson(res, 201, { order: orderDetail(order), file });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/orders/")) {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = decodeURIComponent(url.pathname.split("/").at(-1));
    const order = orders.find((candidate) => candidate.order_id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    const body = await readBody(req);
    try {
      if (typeof body.status === "string" && body.status !== order.status) {
        applyStatusChange(order, body.status, user, body);
      } else {
        if (body.payment_status !== undefined) order.payment_status = String(body.payment_status);
        if (body.tracking_number !== undefined) order.tracking_number = String(body.tracking_number);
        order.updated_at = new Date().toISOString();
      }
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    if (body.assigned_staff !== undefined) order.assigned_staff = String(body.assigned_staff);
    if (body.notes !== undefined) order.notes = String(body.notes);
    sendJson(res, 200, { order: orderDetail(order) });
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/files") && url.pathname.startsWith("/api/orders/")) {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = decodeURIComponent(url.pathname.split("/").at(-2));
    const order = orders.find((candidate) => candidate.order_id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    const body = await readBody(req);
    if (!body.filename) {
      sendJson(res, 400, { error: "filename is required" });
      return;
    }
    const file = {
      file_id: `FILE-${Date.now()}`,
      filename: String(body.filename),
      file_url: String(body.file_url || body.filename),
      file_type: String(body.file_type || "reference"),
      uploaded_by: user.id,
      timestamp: new Date().toISOString()
    };
    order.files.push(file);
    order.updated_at = file.timestamp;
    await persistOrderStore();
    sendJson(res, 201, { order: orderDetail(order), file });
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/messages") && url.pathname.startsWith("/api/orders/")) {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = decodeURIComponent(url.pathname.split("/").at(-2));
    const order = orders.find((candidate) => candidate.order_id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    const body = await readBody(req);
    if (!body.message_content) {
      sendJson(res, 400, { error: "message_content is required" });
      return;
    }
    const message = appendMessage(order, String(body.message_content), body.type === "auto" ? "auto" : "manual");
    await persistOrderStore();
    sendJson(res, 201, { order: orderDetail(order), message });
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/send-sample") && url.pathname.startsWith("/api/orders/")) {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = decodeURIComponent(url.pathname.split("/").at(-2));
    const order = orders.find((candidate) => candidate.order_id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    const designFile = latestDesignFile(order);
    const body = await readBody(req);
    const message = appendMessage(
      order,
      body.message_content ||
        `Hi ${order.customer_name}, your design sample is ready. Please choose Confirm or Redesign. Approval ID: ${order.order_id}`,
      "auto",
      {
        template_name: "design_sample_approval",
        interactive_actions: ["confirm", "redesign"],
        related_file_url: designFile?.file_url ?? null,
        status: "sent_simulation"
      }
    );
    applyStatusChange(order, "Waiting Approval", user, {});
    await persistOrderStore();
    sendJson(res, 201, { order: orderDetail(order), message });
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/simulate-reply") && url.pathname.startsWith("/api/orders/")) {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = decodeURIComponent(url.pathname.split("/").at(-2));
    const order = orders.find((candidate) => candidate.order_id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return;
    }
    const body = await readBody(req);
    try {
      const message = simulateCustomerApproval(order, body.action, body.note ? String(body.note) : "", user);
      await persistOrderStore();
      sendJson(res, 201, { order: orderDetail(order), message });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/whatsapp-messages") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { messages: whatsappMessages() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/items") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { items: items.map(itemWithProfit) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/items") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    if (!body.item_id || !body.item_name || Number.isNaN(Number(body.base_cost)) || Number.isNaN(Number(body.selling_price))) {
      sendJson(res, 400, { error: "item_id, item_name, base_cost, and selling_price are required" });
      return;
    }
    const existing = items.find((item) => item.item_id === body.item_id);
    const payload = {
      item_id: String(body.item_id),
      item_name: String(body.item_name),
      base_cost: roundMoney(body.base_cost),
      selling_price: roundMoney(body.selling_price)
    };
    if (existing) Object.assign(existing, payload);
    else items.push(payload);
    sendJson(res, existing ? 200 : 201, { item: itemWithProfit(payload) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/orders/financial") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { orders: orders.map(orderFinancials) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/analytics") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, {
      summary: {
        today: summarize("today"),
        week: summarize("week"),
        month: summarize("month"),
        year: summarize("year")
      },
      staff_performance: staffPerformance(),
      trend: trendData()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/expenses") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, {
      admins: adminUsers(),
      expenses: expenses.map(expenseRecord).sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
      summary: expenseSummary(),
      sheet: expensesSheetConfig
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/expenses/sync-sheet") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const sheetUrl = body.sheet_url !== undefined ? String(body.sheet_url).trim() : expensesSheetConfig.sheet_url;
    try {
      const importedExpenses = await syncExpensesFromSheet(sheetUrl);
      sendJson(res, 200, {
        imported_count: importedExpenses.length,
        admins: adminUsers(),
        expenses: expenses.map(expenseRecord).sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
        summary: expenseSummary(),
        sheet: expensesSheetConfig
      });
    } catch (error) {
      expensesSheetConfig.sheet_url = sheetUrl;
      expensesSheetConfig.last_error = error.message;
      await persistExpensesSheetConfig();
      sendJson(res, 400, { error: error.message, sheet: expensesSheetConfig });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/hr") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, adminHrSummary());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/monthly-closings") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, {
      closings: monthlyClosings
        .map(closingRecord)
        .sort((a, b) => b.month.localeCompare(a.month))
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/monthly-closings") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const closing = normalizeClosing(body);
    const existingIndex = monthlyClosings.findIndex((item) => item.month === closing.month);
    if (existingIndex >= 0) monthlyClosings[existingIndex] = closing;
    else monthlyClosings.push(closing);
    await persistClosings();
    sendJson(res, existingIndex >= 0 ? 200 : 201, { closing: closingRecord(closing) });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/hr/staff/")) {
    if (!requireAdmin(req, res)) return;
    const userId = decodeURIComponent(url.pathname.split("/").at(-1));
    const profile = hr.staff.find((candidate) => candidate.user_id === userId);
    if (!profile) {
      sendJson(res, 404, { error: "Staff profile not found" });
      return;
    }
    const body = await readBody(req);
    if (body.hourly_rate !== undefined) profile.hourly_rate = roundMoney(body.hourly_rate);
    if (body.mc_days !== undefined) profile.mc_days = Number(body.mc_days);
    if (body.leave_days !== undefined) profile.leave_days = Number(body.leave_days);
    if (typeof body.status === "string") profile.status = body.status;
    await persistHr();
    sendJson(res, 200, adminHrSummary());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/hr/leaves") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const profile = hr.staff.find((candidate) => candidate.user_id === body.user_id);
    const days = Number(body.days);
    if (!profile || !body.type || !body.start_date || !body.end_date || !Number.isFinite(days) || days <= 0) {
      sendJson(res, 400, { error: "user_id, type, start_date, end_date, and days are required" });
      return;
    }
    const leave = {
      leave_id: `LEV-${Date.now()}`,
      user_id: String(body.user_id),
      type: String(body.type),
      start_date: new Date(body.start_date).toISOString(),
      end_date: new Date(body.end_date).toISOString(),
      days: roundMoney(days),
      note: body.note ? String(body.note) : ""
    };
    hr.leaves.push(leave);
    if (leave.type.toLowerCase() === "mc") profile.mc_days = roundMoney(profile.mc_days + leave.days);
    else profile.leave_days = roundMoney(profile.leave_days + leave.days);
    await persistHr();
    sendJson(res, 201, adminHrSummary());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/expenses") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const amount = Number(body.amount);
    const purchaserExists = users.some((user) => user.id === body.purchased_by && user.role === "ADMIN");
    if (!body.name || !Number.isFinite(amount) || amount < 0 || !purchaserExists || !body.account) {
      sendJson(res, 400, { error: "name, amount, purchased_by, and account are required" });
      return;
    }
    const expense = {
      expense_id: `EXP-${Date.now()}`,
      name: String(body.name),
      amount: roundMoney(amount),
      purchased_by: String(body.purchased_by),
      account: String(body.account),
      expense_date: body.expense_date ? new Date(body.expense_date).toISOString() : new Date().toISOString(),
      note: body.note ? String(body.note) : ""
    };
    expenses.push(expense);
    await persistExpenses();
    sendJson(res, 201, { expense: expenseRecord(expense), summary: expenseSummary() });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/expenses/")) {
    if (!requireAdmin(req, res)) return;
    const expenseId = decodeURIComponent(url.pathname.split("/").at(-1));
    const index = expenses.findIndex((expense) => expense.expense_id === expenseId);
    if (index === -1) {
      sendJson(res, 404, { error: "Expense not found" });
      return;
    }
    expenses.splice(index, 1);
    await persistExpenses();
    sendJson(res, 200, { ok: true, summary: expenseSummary() });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/api/")) await handleApi(req, res);
      else if (req.url?.startsWith("/media/")) await serveMedia(req, res);
      else await serveStatic(req, res);
    } catch (error) {
      sendJson(res, 500, { error: "Server error" });
      console.error(error);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => {
    console.log(`Production Flow Portal running at http://localhost:${PORT}`);
  });
}
