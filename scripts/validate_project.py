from pathlib import Path
import sqlite3


def main() -> None:
    base = Path(__file__).resolve().parents[1]
    connection = sqlite3.connect(":memory:")

    for sql_file in ["schema.sql", "seed.sql", "views.sql"]:
        connection.executescript((base / "sql" / sql_file).read_text(encoding="utf-8"))

    checks = {
        "user_count": connection.execute('SELECT COUNT(*) FROM "user";').fetchone()[0],
        "item_count": connection.execute("SELECT COUNT(*) FROM item;").fetchone()[0],
        "order_count": connection.execute("SELECT COUNT(*) FROM orders;").fetchone()[0],
        "unsold_count": connection.execute("SELECT COUNT(*) FROM unsold_item_view;").fetchone()[0],
        "sold_count": connection.execute("SELECT COUNT(*) FROM sold_item_view;").fetchone()[0],
        "avg_price": connection.execute("SELECT ROUND(AVG(price), 2) FROM item;").fetchone()[0],
    }

    print("SQL validation summary:")
    for key, value in checks.items():
        print(f"- {key}: {value}")

    connection.execute("BEGIN IMMEDIATE;")
    item_status = connection.execute(
        "SELECT status FROM item WHERE item_id = 'i001';"
    ).fetchone()[0]
    if item_status != 0:
        raise RuntimeError("Expected i001 to be unsold before purchase test.")

    connection.execute(
        """
        INSERT INTO orders(order_id, item_id, buyer_id, order_date)
        VALUES ('o003', 'i001', 'u003', '2024-05-06');
        """
    )
    connection.execute("UPDATE item SET status = 1 WHERE item_id = 'i001';")
    connection.commit()

    purchased_status = connection.execute(
        "SELECT status FROM item WHERE item_id = 'i001';"
    ).fetchone()[0]
    purchased_orders = connection.execute(
        "SELECT COUNT(*) FROM orders WHERE item_id = 'i001';"
    ).fetchone()[0]

    print("- purchase_test_status:", purchased_status)
    print("- purchase_test_orders:", purchased_orders)


if __name__ == "__main__":
    main()
