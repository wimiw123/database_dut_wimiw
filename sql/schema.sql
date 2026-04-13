PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS item;
DROP TABLE IF EXISTS "user";

CREATE TABLE "user" (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE CHECK (length(phone) >= 11)
);

CREATE TABLE item (
  item_id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  status INTEGER NOT NULL CHECK (status IN (0, 1)),
  seller_id TEXT NOT NULL,
  FOREIGN KEY (seller_id) REFERENCES "user"(user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE orders (
  order_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  buyer_id TEXT NOT NULL,
  order_date TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES item(item_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  FOREIGN KEY (buyer_id) REFERENCES "user"(user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX idx_item_status ON item(status);
CREATE INDEX idx_item_category ON item(category);
CREATE INDEX idx_item_seller ON item(seller_id);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);

CREATE TRIGGER trg_orders_mark_sold
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  UPDATE item
  SET status = 1
  WHERE item_id = NEW.item_id;
END;

CREATE TRIGGER trg_item_prevent_unsold_with_order
BEFORE UPDATE OF status ON item
FOR EACH ROW
WHEN NEW.status = 0 AND EXISTS (
  SELECT 1
  FROM orders
  WHERE item_id = NEW.item_id
)
BEGIN
  SELECT RAISE(ABORT, '已成交商品不能改回未售出');
END;

CREATE TRIGGER trg_item_prevent_delete_sold
BEFORE DELETE ON item
FOR EACH ROW
WHEN OLD.status = 1 OR EXISTS (
  SELECT 1
  FROM orders
  WHERE item_id = OLD.item_id
)
BEGIN
  SELECT RAISE(ABORT, '已成交商品不能删除');
END;
