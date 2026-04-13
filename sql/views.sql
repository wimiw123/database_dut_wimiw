DROP VIEW IF EXISTS sold_item_view;
DROP VIEW IF EXISTS unsold_item_view;

CREATE VIEW sold_item_view AS
SELECT
  i.item_name,
  o.buyer_id
FROM item i
JOIN orders o ON i.item_id = o.item_id;

CREATE VIEW unsold_item_view AS
SELECT
  item_id,
  item_name,
  category,
  price,
  seller_id
FROM item
WHERE status = 0;
