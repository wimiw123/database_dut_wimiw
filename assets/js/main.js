import {
  createItem,
  deleteUnsoldItem,
  query,
  purchaseItem,
  resetDatabase,
  updateItemPrice,
} from "./db.js";

const CATEGORY_LABELS = {
  Book: "书籍",
  DailyGoods: "生活用品",
  Electronics: "电子产品",
  Furniture: "家具",
  Sports: "运动",
};

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("is-visible");

  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCategory(value) {
  const label = CATEGORY_LABELS[value];
  return label ? `${value} / ${label}` : value;
}

function formatStatus(value) {
  return Number(value) === 1
    ? '<span class="status-badge sold">已售出</span>'
    : '<span class="status-badge unsold">未售出</span>';
}

function renderTable(columns, rows, options = {}) {
  if (!rows.length) {
    return '<div class="empty-state">当前没有可展示的数据。</div>';
  }

  const headers = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const rawValue =
            typeof column.render === "function"
              ? column.render(row)
              : escapeHtml(row[column.key]);
          return `<td>${rawValue}</td>`;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="table-shell">
      <table>
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function fillSelect(selectElement, options, placeholder) {
  if (!selectElement) {
    return;
  }

  const placeholderMarkup = placeholder
    ? `<option value="">${escapeHtml(placeholder)}</option>`
    : "";

  selectElement.innerHTML =
    placeholderMarkup +
    options
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
      )
      .join("");
}

async function getUsers() {
  return query(`
    SELECT user_id, user_name, phone
    FROM "user"
    ORDER BY user_id;
  `);
}

async function getItems() {
  return query(`
    SELECT item_id, item_name, category, price, status, seller_id
    FROM item
    ORDER BY item_id;
  `);
}

async function getOrders() {
  return query(`
    SELECT order_id, item_id, buyer_id, order_date
    FROM orders
    ORDER BY order_date, order_id;
  `);
}

function buildQueryCard(title, description, sql, tableHtml) {
  return `
    <section class="query-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      <pre class="sql-block"><code>${escapeHtml(sql)}</code></pre>
      ${tableHtml}
    </section>
  `;
}

async function renderHomePage() {
  const statsContainer = document.getElementById("home-stats");
  const previewContainer = document.getElementById("home-preview");

  const [itemStats] = await query(`
    SELECT
      COUNT(*) AS total_items,
      SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS unsold_items,
      SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS sold_items,
      ROUND(AVG(price), 2) AS avg_price
    FROM item;
  `);
  const [userStats] = await query('SELECT COUNT(*) AS total_users FROM "user";');
  const [orderStats] = await query("SELECT COUNT(*) AS total_orders FROM orders;");
  const recentItems = await query(`
    SELECT item_id, item_name, category, price, status
    FROM item
    ORDER BY CAST(SUBSTR(item_id, 2) AS INTEGER) DESC
    LIMIT 4;
  `);

  statsContainer.innerHTML = `
    <article class="stat-card">
      <div class="stat-label">商品总数</div>
      <div class="stat-value">${itemStats.total_items}</div>
      <div class="stat-footnote">来自 item 表</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">未售商品</div>
      <div class="stat-value">${itemStats.unsold_items}</div>
      <div class="stat-footnote">status = 0</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">用户数量</div>
      <div class="stat-value">${userStats.total_users}</div>
      <div class="stat-footnote">来自 user 表</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">订单数量</div>
      <div class="stat-value">${orderStats.total_orders}</div>
      <div class="stat-footnote">当前已成交订单</div>
    </article>
  `;

  previewContainer.innerHTML = `
    <div class="preview-shell">
      <div class="tag-row">
        <span class="tag">平均价格 ¥${itemStats.avg_price}</span>
        <span class="tag">已售商品 ${itemStats.sold_items} 件</span>
        <span class="tag">订单 ${orderStats.total_orders} 条</span>
      </div>
      ${renderTable(
        [
          { key: "item_id", label: "商品ID" },
          { key: "item_name", label: "商品名称" },
          { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
          { key: "price", label: "价格", render: (row) => `¥${Number(row.price).toFixed(2)}` },
          { key: "status", label: "状态", render: (row) => formatStatus(row.status) },
        ],
        recentItems,
      )}
    </div>
  `;
}

async function refreshItemPageData() {
  const items = await getItems();
  const users = await getUsers();

  const itemsTable = document.getElementById("items-table");
  const countPill = document.getElementById("items-count-pill");

  if (countPill) {
    countPill.textContent = `${items.length} 件商品`;
  }

  if (itemsTable) {
    itemsTable.innerHTML = renderTable(
      [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
        { key: "price", label: "价格", render: (row) => `¥${Number(row.price).toFixed(2)}` },
        { key: "status", label: "状态", render: (row) => formatStatus(row.status) },
        { key: "seller_id", label: "卖家ID" },
      ],
      items,
    );
  }

  const userOptions = users.map((user) => ({
    value: user.user_id,
    label: `${user.user_id} · ${user.user_name}`,
  }));

  fillSelect(document.getElementById("create-item-seller"), userOptions);
  fillSelect(document.getElementById("purchase-buyer-select"), userOptions);

  const itemOptions = items.map((item) => ({
    value: item.item_id,
    label: `${item.item_id} · ${item.item_name}`,
  }));
  const unsoldOptions = items
    .filter((item) => Number(item.status) === 0)
    .map((item) => ({
      value: item.item_id,
      label: `${item.item_id} · ${item.item_name} · ¥${Number(item.price).toFixed(2)}`,
    }));

  fillSelect(document.getElementById("update-item-select"), itemOptions);
  fillSelect(document.getElementById("delete-item-select"), unsoldOptions);
  fillSelect(document.getElementById("purchase-item-select"), unsoldOptions);
}

async function bindItemsPage() {
  await refreshItemPageData();

  const createForm = document.getElementById("create-item-form");
  const updateForm = document.getElementById("update-price-form");
  const deleteForm = document.getElementById("delete-item-form");
  const purchaseForm = document.getElementById("purchase-item-form");
  const purchaseDateInput = document.getElementById("purchase-date");

  if (purchaseDateInput) {
    purchaseDateInput.value = new Date().toISOString().slice(0, 10);
  }

  if (createForm) {
    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(createForm);
      const itemName = String(formData.get("item_name") || "").trim();
      const category = String(formData.get("category") || "").trim();
      const sellerId = String(formData.get("seller_id") || "").trim();
      const price = Number(formData.get("price"));

      if (!itemName || !category || !sellerId || Number.isNaN(price)) {
        showToast("请完整填写新增商品信息。", "error");
        return;
      }

      try {
        const itemId = await createItem({
          item_name: itemName,
          category,
          price,
          seller_id: sellerId,
        });
        createForm.reset();
        await refreshItemPageData();
        showToast(`新增商品成功：${itemId}`);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (updateForm) {
    updateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(updateForm);
      const itemId = String(formData.get("item_id") || "").trim();
      const price = Number(formData.get("price"));

      if (!itemId || Number.isNaN(price)) {
        showToast("请选择商品并输入新价格。", "error");
        return;
      }

      try {
        await updateItemPrice(itemId, price);
        await refreshItemPageData();
        showToast(`商品 ${itemId} 价格已更新。`);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (deleteForm) {
    deleteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(deleteForm);
      const itemId = String(formData.get("item_id") || "").trim();

      if (!itemId) {
        showToast("请选择要删除的未售商品。", "error");
        return;
      }

      try {
        await deleteUnsoldItem(itemId);
        await refreshItemPageData();
        showToast(`商品 ${itemId} 已删除。`);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (purchaseForm) {
    purchaseForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(purchaseForm);
      const itemId = String(formData.get("item_id") || "").trim();
      const buyerId = String(formData.get("buyer_id") || "").trim();
      const orderDate = String(formData.get("order_date") || "").trim();

      if (!itemId || !buyerId || !orderDate) {
        showToast("请完整填写购买信息。", "error");
        return;
      }

      try {
        const orderId = await purchaseItem({
          item_id: itemId,
          buyer_id: buyerId,
          order_date: orderDate,
        });
        await refreshItemPageData();
        showToast(`购买事务成功，订单号：${orderId}`);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }
}

async function renderUsersPage() {
  const users = await getUsers();
  const sellerStats = await query(`
    SELECT
      u.user_id,
      u.user_name,
      COUNT(i.item_id) AS item_count
    FROM "user" u
    LEFT JOIN item i ON u.user_id = i.seller_id
    GROUP BY u.user_id, u.user_name
    ORDER BY item_count DESC, u.user_id;
  `);

  document.getElementById("users-count-pill").textContent = `${users.length} 位用户`;
  document.getElementById("users-table").innerHTML = renderTable(
    [
      { key: "user_id", label: "用户ID" },
      { key: "user_name", label: "用户名", render: (row) => escapeHtml(row.user_name) },
      { key: "phone", label: "手机号" },
    ],
    users,
  );

  document.getElementById("seller-summary").innerHTML = renderTable(
    [
      { key: "user_id", label: "用户ID" },
      { key: "user_name", label: "用户名", render: (row) => escapeHtml(row.user_name) },
      { key: "item_count", label: "已发布商品数" },
    ],
    sellerStats,
  );
}

async function renderOrdersPage() {
  const orders = await getOrders();
  const soldItems = await query(`
    SELECT
      i.item_name,
      u.user_name AS buyer_name,
      o.order_date
    FROM orders o
    JOIN item i ON o.item_id = i.item_id
    JOIN "user" u ON o.buyer_id = u.user_id
    ORDER BY o.order_date, o.order_id;
  `);

  document.getElementById("orders-count-pill").textContent = `${orders.length} 条订单`;
  document.getElementById("orders-table").innerHTML = renderTable(
    [
      { key: "order_id", label: "订单ID" },
      { key: "item_id", label: "商品ID" },
      { key: "buyer_id", label: "买家ID" },
      { key: "order_date", label: "下单日期" },
    ],
    orders,
  );

  document.getElementById("sold-items-table").innerHTML = renderTable(
    [
      { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
      { key: "buyer_name", label: "买家姓名", render: (row) => escapeHtml(row.buyer_name) },
      { key: "order_date", label: "购买日期" },
    ],
    soldItems,
  );
}

async function renderAnalysisPage() {
  const basicQueriesContainer = document.getElementById("basic-queries");
  const joinQueriesContainer = document.getElementById("join-queries");
  const aggregateQueriesContainer = document.getElementById("aggregate-queries");
  const viewsContainer = document.getElementById("views-section");

  const basicQueries = [
    {
      title: "查询所有未售出的商品",
      description: "筛选当前仍可交易的商品记录。",
      sql: "SELECT * FROM item WHERE status = 0 ORDER BY item_id;",
      rows: await query("SELECT * FROM item WHERE status = 0 ORDER BY item_id;"),
      columns: [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
        { key: "price", label: "价格", render: (row) => `¥${Number(row.price).toFixed(2)}` },
        { key: "seller_id", label: "卖家ID" },
      ],
    },
    {
      title: "查询价格大于 30 的商品",
      description: "按价格条件筛选商品，便于查看较高价格区间的数据。",
      sql: "SELECT * FROM item WHERE price > 30 ORDER BY price DESC;",
      rows: await query("SELECT * FROM item WHERE price > 30 ORDER BY price DESC;"),
      columns: [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "price", label: "价格", render: (row) => `¥${Number(row.price).toFixed(2)}` },
        { key: "status", label: "状态", render: (row) => formatStatus(row.status) },
      ],
    },
    {
      title: "查询“生活用品”类商品",
      description: "按商品分类筛选生活用品类记录。",
      sql: "SELECT * FROM item WHERE category = 'DailyGoods' ORDER BY item_id;",
      rows: await query("SELECT * FROM item WHERE category = 'DailyGoods' ORDER BY item_id;"),
      columns: [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
        { key: "price", label: "价格", render: (row) => `¥${Number(row.price).toFixed(2)}` },
      ],
    },
    {
      title: "查询 u001 发布的所有商品",
      description: "按卖家编号筛选指定用户发布的商品。",
      sql: "SELECT * FROM item WHERE seller_id = 'u001' ORDER BY item_id;",
      rows: await query("SELECT * FROM item WHERE seller_id = 'u001' ORDER BY item_id;"),
      columns: [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
        { key: "status", label: "状态", render: (row) => formatStatus(row.status) },
      ],
    },
  ];

  const joinQueries = [
    {
      title: "查询所有已售商品及其买家姓名",
      description: "连接 item、orders、user 三张表得到结果。",
      sql: `
SELECT i.item_name, u.user_name AS buyer_name
FROM item i
JOIN orders o ON i.item_id = o.item_id
JOIN "user" u ON o.buyer_id = u.user_id
ORDER BY i.item_id;`.trim(),
      rows: await query(`
        SELECT i.item_name, u.user_name AS buyer_name
        FROM item i
        JOIN orders o ON i.item_id = o.item_id
        JOIN "user" u ON o.buyer_id = u.user_id
        ORDER BY i.item_id;
      `),
      columns: [
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "buyer_name", label: "买家姓名", render: (row) => escapeHtml(row.buyer_name) },
      ],
    },
    {
      title: "查询每个订单：商品名 + 买家名 + 日期",
      description: "连接订单、商品和用户数据，形成订单明细视图。",
      sql: `
SELECT i.item_name, u.user_name AS buyer_name, o.order_date
FROM orders o
JOIN item i ON o.item_id = i.item_id
JOIN "user" u ON o.buyer_id = u.user_id
ORDER BY o.order_date;`.trim(),
      rows: await query(`
        SELECT i.item_name, u.user_name AS buyer_name, o.order_date
        FROM orders o
        JOIN item i ON o.item_id = i.item_id
        JOIN "user" u ON o.buyer_id = u.user_id
        ORDER BY o.order_date;
      `),
      columns: [
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "buyer_name", label: "买家姓名", render: (row) => escapeHtml(row.buyer_name) },
        { key: "order_date", label: "购买日期" },
      ],
    },
    {
      title: "查询卖家是 u001 的商品是否被购买",
      description: "用 LEFT JOIN 判断每个商品是否已进入订单表。",
      sql: `
SELECT
  i.item_id,
  i.item_name,
  CASE WHEN o.order_id IS NULL THEN '未购买' ELSE '已购买' END AS purchase_state
FROM item i
LEFT JOIN orders o ON i.item_id = o.item_id
WHERE i.seller_id = 'u001'
ORDER BY i.item_id;`.trim(),
      rows: await query(`
        SELECT
          i.item_id,
          i.item_name,
          CASE WHEN o.order_id IS NULL THEN '未购买' ELSE '已购买' END AS purchase_state
        FROM item i
        LEFT JOIN orders o ON i.item_id = o.item_id
        WHERE i.seller_id = 'u001'
        ORDER BY i.item_id;
      `),
      columns: [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "purchase_state", label: "购买状态" },
      ],
    },
  ];

  const aggregateQueries = [
    {
      title: "统计商品总数",
      description: "聚合函数 COUNT(*)。",
      sql: "SELECT COUNT(*) AS total_items FROM item;",
      rows: await query("SELECT COUNT(*) AS total_items FROM item;"),
      columns: [{ key: "total_items", label: "商品总数" }],
    },
    {
      title: "统计每类商品数量",
      description: "按 category 分组统计。",
      sql: "SELECT category, COUNT(*) AS item_count FROM item GROUP BY category ORDER BY item_count DESC;",
      rows: await query(`
        SELECT category, COUNT(*) AS item_count
        FROM item
        GROUP BY category
        ORDER BY item_count DESC, category;
      `),
      columns: [
        { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
        { key: "item_count", label: "数量" },
      ],
    },
    {
      title: "计算所有商品平均价格",
      description: "聚合函数 AVG(price)。",
      sql: "SELECT ROUND(AVG(price), 2) AS avg_price FROM item;",
      rows: await query("SELECT ROUND(AVG(price), 2) AS avg_price FROM item;"),
      columns: [{ key: "avg_price", label: "平均价格", render: (row) => `¥${row.avg_price}` }],
    },
    {
      title: "查询发布商品数量最多的用户",
      description: "按用户分组并取第一名。",
      sql: `
SELECT u.user_id, u.user_name, COUNT(i.item_id) AS item_count
FROM "user" u
LEFT JOIN item i ON u.user_id = i.seller_id
GROUP BY u.user_id, u.user_name
ORDER BY item_count DESC, u.user_id
LIMIT 1;`.trim(),
      rows: await query(`
        SELECT u.user_id, u.user_name, COUNT(i.item_id) AS item_count
        FROM "user" u
        LEFT JOIN item i ON u.user_id = i.seller_id
        GROUP BY u.user_id, u.user_name
        ORDER BY item_count DESC, u.user_id
        LIMIT 1;
      `),
      columns: [
        { key: "user_id", label: "用户ID" },
        { key: "user_name", label: "用户名", render: (row) => escapeHtml(row.user_name) },
        { key: "item_count", label: "发布数量" },
      ],
    },
  ];

  const views = [
    {
      title: "已售商品视图 sold_item_view",
      description: "包含商品名和买家 ID。",
      sql: "SELECT * FROM sold_item_view ORDER BY item_name;",
      rows: await query("SELECT * FROM sold_item_view ORDER BY item_name;"),
      columns: [
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "buyer_id", label: "买家ID" },
      ],
    },
    {
      title: "未售商品视图 unsold_item_view",
      description: "包含所有未售商品。",
      sql: "SELECT * FROM unsold_item_view ORDER BY item_id;",
      rows: await query("SELECT * FROM unsold_item_view ORDER BY item_id;"),
      columns: [
        { key: "item_id", label: "商品ID" },
        { key: "item_name", label: "商品名称", render: (row) => escapeHtml(row.item_name) },
        { key: "category", label: "分类", render: (row) => escapeHtml(formatCategory(row.category)) },
        { key: "price", label: "价格", render: (row) => `¥${Number(row.price).toFixed(2)}` },
        { key: "seller_id", label: "卖家ID" },
      ],
    },
  ];

  basicQueriesContainer.innerHTML = `<div class="query-group">${basicQueries
    .map((entry) => buildQueryCard(entry.title, entry.description, entry.sql, renderTable(entry.columns, entry.rows)))
    .join("")}</div>`;

  joinQueriesContainer.innerHTML = `<div class="query-group">${joinQueries
    .map((entry) => buildQueryCard(entry.title, entry.description, entry.sql, renderTable(entry.columns, entry.rows)))
    .join("")}</div>`;

  aggregateQueriesContainer.innerHTML = `<div class="query-group">${aggregateQueries
    .map((entry) => buildQueryCard(entry.title, entry.description, entry.sql, renderTable(entry.columns, entry.rows)))
    .join("")}</div>`;

  viewsContainer.innerHTML = `<div class="query-group">${views
    .map((entry) => buildQueryCard(entry.title, entry.description, entry.sql, renderTable(entry.columns, entry.rows)))
    .join("")}</div>`;
}

async function bindSharedActions() {
  const resetButtons = document.querySelectorAll(".reset-db-button");

  resetButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await resetDatabase();
      showToast("数据库已重置为初始状态。");
      window.setTimeout(() => {
        window.location.reload();
      }, 400);
    });
  });
}

async function initPage() {
  await bindSharedActions();
  const page = document.body.dataset.page;

  switch (page) {
    case "home":
      await renderHomePage();
      break;
    case "items":
      await bindItemsPage();
      break;
    case "users":
      await renderUsersPage();
      break;
    case "orders":
      await renderOrdersPage();
      break;
    case "analysis":
      await renderAnalysisPage();
      break;
    default:
      break;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await initPage();
  } catch (error) {
    console.error(error);
    showToast(error.message || "页面初始化失败，请检查控制台。", "error");
  }
});
