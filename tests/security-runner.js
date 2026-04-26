import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

process.env.EXPENSES_FILE = path.join(os.tmpdir(), `production-flow-expenses-${Date.now()}.json`);
process.env.HR_FILE = path.join(os.tmpdir(), `production-flow-hr-${Date.now()}.json`);
process.env.CLOSINGS_FILE = path.join(os.tmpdir(), `production-flow-closings-${Date.now()}.json`);
process.env.ORDERS_FILE = path.join(os.tmpdir(), `production-flow-orders-${Date.now()}.json`);
process.env.VIDEO_FILE = path.join(os.tmpdir(), `production-flow-video-${Date.now()}.json`);
process.env.FFMPEG_PATH = "definitely-missing-ffmpeg";
const { createServer } = await import("../server.js");

const forbiddenFinanceKeys = [
  "base_cost",
  "profit",
  "item_cost",
  "selling_price",
  "total_cost",
  "total_sales",
  "total_profit",
  "sales",
  "staff_performance"
];

const checks = [];
const forbiddenStaffHrKeys = ["hourly_rate", "estimated_month_pay", "clock_in_ip", "clock_out_ip"];

function check(name, fn) {
  checks.push({ name, fn });
}

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200);
  return response.json();
}

function containsForbiddenFinanceKey(payload) {
  const serialized = JSON.stringify(payload);
  return forbiddenFinanceKeys.some((key) => serialized.includes(`"${key}"`));
}

function containsForbiddenStaffHrKey(payload) {
  const serialized = JSON.stringify(payload);
  return forbiddenStaffHrKeys.some((key) => serialized.includes(`"${key}"`));
}

check("staff orders response never exposes financial fields", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const response = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(containsForbiddenFinanceKey(payload), false);
  });
});

check("designer cannot access admin financial endpoints", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "designer", "designer123");
    const endpoints = [
      "/api/admin/items",
      "/api/admin/orders/financial",
      "/api/admin/analytics",
      "/api/admin/expenses",
      "/api/admin/hr",
      "/api/admin/monthly-closings",
      "/api/admin/whatsapp-messages"
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      assert.equal(response.status, 403);
      assert.equal(containsForbiddenFinanceKey(payload), false);
    }
  });
});

check("admin receives calculated financial fields", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "admin", "admin123");
    const response = await fetch(`${baseUrl}/api/admin/orders/financial`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();
    const firstOrder = payload.orders[0];

    assert.equal(response.status, 200);
    assert.equal(firstOrder.total_profit, firstOrder.total_sales - firstOrder.total_cost);
    assert.ok("item_cost" in firstOrder);
    assert.ok("selling_price" in firstOrder);
  });
});

check("staff upload flow returns only public order fields", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const response = await fetch(`${baseUrl}/api/orders/ORD-1001/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ filename: "mockup.png" })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.order.files.at(-1).file_url, "mockup.png");
    assert.equal(containsForbiddenFinanceKey(payload), false);
  });
});

check("status automation logs WhatsApp-ready messages", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const response = await fetch(`${baseUrl}/api/orders/ORD-1004`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: "Ready for Payment" })
    });
    const payload = await response.json();
    const message = payload.order.messages.at(-1);

    assert.equal(response.status, 200);
    assert.equal(message.type, "auto");
    assert.match(message.message_content, /proceed with payment/i);
    assert.equal(message.status, "simulated");
  });
});

check("send sample and customer confirm moves order to approved", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const send = await fetch(`${baseUrl}/api/orders/ORD-1004/send-sample`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const sentPayload = await send.json();

    assert.equal(send.status, 201);
    assert.equal(sentPayload.order.status, "Waiting Approval");
    assert.deepEqual(sentPayload.message.interactive_actions, ["confirm", "redesign"]);

    const confirm = await fetch(`${baseUrl}/api/orders/ORD-1004/simulate-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action: "confirm" })
    });
    const confirmPayload = await confirm.json();

    assert.equal(confirm.status, 201);
    assert.equal(confirmPayload.order.status, "Approved");
    assert.equal(confirmPayload.message.customer_action, "confirm");
  });
});

check("customer redesign moves order back to designing and appears in admin WhatsApp panel", async () => {
  await withServer(async (baseUrl) => {
    const staff = await login(baseUrl, "staff", "staff123");
    await fetch(`${baseUrl}/api/orders/ORD-1003/simulate-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staff.token}`
      },
      body: JSON.stringify({ action: "redesign", note: "make logo bigger" })
    });

    const admin = await login(baseUrl, "admin", "admin123");
    const logs = await fetch(`${baseUrl}/api/admin/whatsapp-messages`, {
      headers: { Authorization: `Bearer ${admin.token}` }
    }).then((response) => response.json());
    const redesign = logs.messages.find((message) => message.customer_action === "redesign");

    assert.ok(redesign);
    assert.match(redesign.message_content, /make logo bigger/i);
  });
});

check("staff can create order and customer history links it", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        customer_name: "New Buyer",
        phone_number: "+60128889999",
        product_type: "Custom Tee",
        quantity: 2,
        notes: "rush"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.order.status, "New Order");

    const customers = await fetch(`${baseUrl}/api/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((res) => res.json());
    const customer = customers.customers.find((item) => item.phone_number === "+60128889999");
    assert.equal(customer.orders.length, 1);
  });
});

check("admin can add an expense and totals update", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "admin", "admin123");
    const beforeResponse = await fetch(`${baseUrl}/api/admin/expenses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const before = await beforeResponse.json();

    const response = await fetch(`${baseUrl}/api/admin/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "test stock",
        amount: 88.8,
        purchased_by: "u_admin_yh",
        account: "paramour bank",
        expense_date: new Date().toISOString().slice(0, 10),
        note: "runner"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.expense.amount, 88.8);
    assert.equal(payload.summary.total, before.summary.total + 88.8);
  });
});

check("staff clock screen does not expose payroll admin fields", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const response = await fetch(`${baseUrl}/api/hr/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(containsForbiddenStaffHrKey(payload), false);
  });
});

check("staff can clock in and out from office network", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const clockIn = await fetch(`${baseUrl}/api/hr/clock-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const clockInPayload = await clockIn.json();

    assert.equal(clockIn.status, 201);
    assert.ok(clockInPayload.profile.open_shift);

    const clockOut = await fetch(`${baseUrl}/api/hr/clock-out`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const clockOutPayload = await clockOut.json();

    assert.equal(clockOut.status, 200);
    assert.equal(clockOutPayload.profile.open_shift, null);
  });
});

check("admin can update staff hourly rate and leave", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "admin", "admin123");
    const rateResponse = await fetch(`${baseUrl}/api/admin/hr/staff/u_staff_1`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ hourly_rate: 18, mc_days: 2, leave_days: 3 })
    });
    const ratePayload = await rateResponse.json();
    const staff = ratePayload.staff.find((candidate) => candidate.user_id === "u_staff_1");

    assert.equal(rateResponse.status, 200);
    assert.equal(staff.hourly_rate, 18);
    assert.equal(staff.mc_days, 2);

    const leaveResponse = await fetch(`${baseUrl}/api/admin/hr/leaves`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: "u_staff_1",
        type: "Annual Leave",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        days: 1,
        note: "test"
      })
    });

    assert.equal(leaveResponse.status, 201);
  });
});

check("admin can save monthly closing and get calculated totals", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "admin", "admin123");
    const response = await fetch(`${baseUrl}/api/admin/monthly-closings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        month: "2026-04",
        expenses: [
          { label: "staff", amount: 1000 },
          { label: "rental", amount: 500 }
        ],
        stock_expenses: [{ label: "stock", amount: 200 }],
        shopee_cash_out: [{ label: "RS Shopee", amount: 3000 }],
        shopee_sales: [{ label: "RS Shopee", amount: 3500 }],
        offline_unpaid: 100,
        offline_sales: 2000,
        offline_half_deposit: 250,
        bank_balance: 10000,
        note: "runner"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.closing.calculations.total_expenses, 1700);
    assert.equal(payload.closing.calculations.offline_plus_shopee_sales, 5500);
    assert.equal(payload.closing.calculations.collected_sales, 4900);
    assert.equal(payload.closing.calculations.gain_profit, 3200);
    assert.equal(payload.closing.calculations.bank_new_balance, 13200);
  });
});

check("video studio is blocked for staff", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "staff", "staff123");
    const response = await fetch(`${baseUrl}/api/video-requests`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 403);
  });
});

check("admin can create video edit request with generated plan", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "admin", "admin123");
    const response = await fetch(`${baseUrl}/api/video-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: "TikTok sample",
        sample_video_link: "https://example.com/sample",
        caption: "Custom cap glow up",
        selected_song: "Fast Promo Pulse",
        font_style: "Streetwear block",
        assigned_designer: "u_designer_1",
        notes: "quick cuts"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.match(payload.request.edit_plan, /Custom cap glow up/i);
    assert.equal(payload.request.assigned_designer, "u_designer_1");
  });
});

check("designer can update assigned video request", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "designer", "designer123");
    const list = await fetch(`${baseUrl}/api/video-requests`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((response) => response.json());
    const request = list.requests[0];

    const response = await fetch(`${baseUrl}/api/video-requests/${request.request_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: "Ready", final_video_url: "data:video/mp4;base64,AAAA", edit_plan: "Manual plan" })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.request.status, "Ready");
    assert.equal(payload.request.edit_plan, "Manual plan");
    assert.ok(payload.request.final_video_url);
  });
});

check("video render endpoint is wired and reports missing FFmpeg clearly", async () => {
  await withServer(async (baseUrl) => {
    const { token } = await login(baseUrl, "admin", "admin123");
    const create = await fetch(`${baseUrl}/api/video-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: "Render test",
        caption: "Hello TikTok",
        raw_footage_url: "data:video/mp4;base64,AAAA",
        raw_filename: "clip1.mp4",
        raw_footage: [
          { filename: "clip1.mp4", file_url: "data:video/mp4;base64,AAAA" },
          { filename: "clip2.mp4", file_url: "data:video/mp4;base64,BBBB" }
        ],
        assigned_designer: "u_designer_1"
      })
    }).then((response) => response.json());

    const response = await fetch(`${baseUrl}/api/video-requests/${create.request.request_id}/render`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();

    assert.equal(response.status, 501);
    assert.match(payload.error, /FFmpeg|spawn/i);
    assert.equal(payload.request.raw_footage.length, 2);
  });
});

for (const { name, fn } of checks) {
  await fn();
  console.log(`PASS ${name}`);
}

console.log(`${checks.length} security checks passed`);
