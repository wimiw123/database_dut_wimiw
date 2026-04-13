-- 基础查询
SELECT * FROM item WHERE status = 0 ORDER BY item_id;
SELECT * FROM item WHERE price > 30 ORDER BY price DESC;
SELECT * FROM item WHERE category = 'DailyGoods' ORDER BY item_id;
SELECT * FROM item WHERE seller_id = 'u001' ORDER BY item_id;

-- 连接查询
SELECT i.item_name, u.user_name AS buyer_name
FROM item i
JOIN orders o ON i.item_id = o.item_id
JOIN "user" u ON o.buyer_id = u.user_id
ORDER BY i.item_id;

SELECT i.item_name, u.user_name AS buyer_name, o.order_date
FROM orders o
JOIN item i ON o.item_id = i.item_id
JOIN "user" u ON o.buyer_id = u.user_id
ORDER BY o.order_date;

SELECT
  i.item_id,
  i.item_name,
  CASE WHEN o.order_id IS NULL THEN '未购买' ELSE '已购买' END AS purchase_state
FROM item i
LEFT JOIN orders o ON i.item_id = o.item_id
WHERE i.seller_id = 'u001'
ORDER BY i.item_id;

-- 聚合与分组
SELECT COUNT(*) AS total_items FROM item;

SELECT category, COUNT(*) AS item_count
FROM item
GROUP BY category
ORDER BY item_count DESC, category;

SELECT ROUND(AVG(price), 2) AS avg_price FROM item;

SELECT u.user_id, u.user_name, COUNT(i.item_id) AS item_count
FROM "user" u
LEFT JOIN item i ON u.user_id = i.seller_id
GROUP BY u.user_id, u.user_name
ORDER BY item_count DESC, u.user_id
LIMIT 1;

-- 视图
SELECT * FROM sold_item_view ORDER BY item_name;
SELECT * FROM unsold_item_view ORDER BY item_id;

-- 事务购买（示例）
BEGIN IMMEDIATE;
INSERT INTO orders(order_id, item_id, buyer_id, order_date)
VALUES ('o003', 'i001', 'u003', '2024-05-06');
UPDATE item SET status = 1 WHERE item_id = 'i001';
COMMIT;
