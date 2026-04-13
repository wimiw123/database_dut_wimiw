const DB_STORAGE_KEY = "campus-market-db-v1";
const SQL_FILES = ["sql/schema.sql", "sql/seed.sql", "sql/views.sql"];

let databaseInstance = null;
let sqlJsPromise = null;

function ensureSqlJs() {
  if (!window.initSqlJs) {
    throw new Error("sql.js 未加载成功，请检查 assets/vendor/sql-wasm.js 文件。");
  }

  if (!sqlJsPromise) {
    sqlJsPromise = window.initSqlJs({
      locateFile: (file) => `assets/vendor/${file}`,
    });
  }

  return sqlJsPromise;
}

function enablePragmas(db) {
  db.exec("PRAGMA foreign_keys = ON;");
}

function toBase64(bytes) {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    const chunk = bytes.subarray(i, i + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function persistDatabase(db) {
  const data = db.export();
  localStorage.setItem(DB_STORAGE_KEY, toBase64(data));
}

function loadPersistedDatabase() {
  const saved = localStorage.getItem(DB_STORAGE_KEY);
  return saved ? fromBase64(saved) : null;
}

async function loadSqlScripts() {
  const scripts = [];

  for (const path of SQL_FILES) {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`无法加载 SQL 文件：${path}`);
    }

    scripts.push(await response.text());
  }

  return scripts;
}

function selectFromDatabase(db, sql, params = []) {
  const statement = db.prepare(sql);
  const rows = [];

  statement.bind(params);

  while (statement.step()) {
    rows.push(statement.getAsObject());
  }

  statement.free();
  return rows;
}

function runInDatabase(db, sql, params = []) {
  const statement = db.prepare(sql);
  statement.run(params);
  statement.free();
}

async function initializeDatabase(db) {
  const scripts = await loadSqlScripts();

  for (const script of scripts) {
    db.exec(script);
  }

  persistDatabase(db);
}

export async function getDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  const SQL = await ensureSqlJs();
  const savedData = loadPersistedDatabase();

  if (savedData) {
    databaseInstance = new SQL.Database(savedData);
    enablePragmas(databaseInstance);
    return databaseInstance;
  }

  databaseInstance = new SQL.Database();
  enablePragmas(databaseInstance);
  await initializeDatabase(databaseInstance);
  return databaseInstance;
}

export async function query(sql, params = []) {
  const db = await getDatabase();
  return selectFromDatabase(db, sql, params);
}

export async function execute(sql, params = []) {
  const db = await getDatabase();
  runInDatabase(db, sql, params);
  persistDatabase(db);
}

export async function transaction(worker) {
  const db = await getDatabase();
  db.exec("BEGIN IMMEDIATE;");

  try {
    const result = worker({
      query: (sql, params = []) => selectFromDatabase(db, sql, params),
      execute: (sql, params = []) => runInDatabase(db, sql, params),
    });
    db.exec("COMMIT;");
    persistDatabase(db);
    return result;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export async function resetDatabase() {
  localStorage.removeItem(DB_STORAGE_KEY);
  databaseInstance = null;
  await getDatabase();
}

export async function getNextId(tableName, columnName, prefix) {
  const rows = await query(
    `SELECT MAX(CAST(SUBSTR(${columnName}, 2) AS INTEGER)) AS max_id FROM ${tableName};`,
  );
  const currentMax = rows.length && rows[0].max_id !== null ? rows[0].max_id : 0;
  const nextNumber = currentMax + 1;
  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

export async function createItem(payload) {
  const itemId = await getNextId("item", "item_id", "i");

  await execute(
    `
      INSERT INTO item(item_id, item_name, category, price, status, seller_id)
      VALUES (?, ?, ?, ?, 0, ?);
    `,
    [itemId, payload.item_name, payload.category, payload.price, payload.seller_id],
  );

  return itemId;
}

export async function updateItemPrice(itemId, price) {
  await execute("UPDATE item SET price = ? WHERE item_id = ?;", [price, itemId]);
}

export async function deleteUnsoldItem(itemId) {
  const rows = await query("SELECT status FROM item WHERE item_id = ?;", [itemId]);

  if (!rows.length) {
    throw new Error("未找到对应商品。");
  }

  if (Number(rows[0].status) !== 0) {
    throw new Error("只能删除未售出的商品。");
  }

  await execute("DELETE FROM item WHERE item_id = ?;", [itemId]);
}

export async function purchaseItem(payload) {
  const orderId = await getNextId("orders", "order_id", "o");

  await transaction(({ query: txQuery, execute: txExecute }) => {
    const statusRows = txQuery("SELECT status FROM item WHERE item_id = ?;", [payload.item_id]);

    if (!statusRows.length) {
      throw new Error("商品不存在。");
    }

    if (Number(statusRows[0].status) !== 0) {
      throw new Error("已售商品不能再次购买。");
    }

    txExecute(
      `
        INSERT INTO orders(order_id, item_id, buyer_id, order_date)
        VALUES (?, ?, ?, ?);
      `,
      [orderId, payload.item_id, payload.buyer_id, payload.order_date],
    );

    txExecute("UPDATE item SET status = 1 WHERE item_id = ?;", [payload.item_id]);
  });

  return orderId;
}
