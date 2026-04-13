import asyncio
from pathlib import Path

from pyppeteer import launch


BASE_URL = "http://127.0.0.1:8000"
SHOT_DIR = Path(__file__).resolve().parents[1] / "docs" / "screenshots"
VIEWPORT = {"width": 1440, "height": 1800, "deviceScaleFactor": 1}


async def prepare_page(browser, route: str):
    page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(f"{BASE_URL}/{route}", {"waitUntil": "networkidle2"})
    await page.waitForSelector(".site-header")
    return page


async def clear_local_storage(page):
    await page.evaluate(
        """
        () => {
          localStorage.clear();
        }
        """
    )


async def capture_static_pages(browser):
    pages = {
        "home.png": "index.html",
        "items.png": "items.html",
        "users.png": "users.html",
        "orders.png": "orders.html",
        "analysis.png": "analysis.html",
    }

    for filename, route in pages.items():
        page = await prepare_page(browser, route)
        await clear_local_storage(page)
        await page.reload({"waitUntil": "networkidle2"})
        await page.screenshot({"path": str(SHOT_DIR / filename), "fullPage": True})
        await page.close()


async def capture_item_operations(browser):
    page = await prepare_page(browser, "items.html")
    await clear_local_storage(page)
    await page.reload({"waitUntil": "networkidle2"})
    await page.waitForSelector("#create-item-seller option")
    await page.waitForSelector("#purchase-item-select option")

    await page.screenshot({"path": str(SHOT_DIR / "items-before-ops.png"), "fullPage": True})

    await page.type('input[name="item_name"]', "NotebookStand")
    await page.select('select[name="category"]', "Electronics")
    await page.select('select[name="seller_id"]', "u003")
    await page.type('input[name="price"]', "45")
    await page.click('#create-item-form button[type="submit"]')
    await page.waitFor(500)
    await page.screenshot({"path": str(SHOT_DIR / "items-inserted.png"), "fullPage": True})

    await page.select('#update-item-select', "i001")
    await page.click('#update-price-form input[name="price"]', {"clickCount": 3})
    await page.keyboard.press("Backspace")
    await page.type('#update-price-form input[name="price"]', "28")
    await page.click('#update-price-form button[type="submit"]')
    await page.waitFor(500)
    await page.screenshot({"path": str(SHOT_DIR / "items-updated.png"), "fullPage": True})

    await page.select('#delete-item-select', "i005")
    await page.click('#delete-item-form button[type="submit"]')
    await page.waitFor(500)
    await page.screenshot({"path": str(SHOT_DIR / "items-deleted.png"), "fullPage": True})

    await page.select('#purchase-item-select', "i001")
    await page.select('#purchase-buyer-select', "u004")
    await page.evaluate(
        """
        () => {
          const input = document.querySelector('#purchase-date');
          input.value = '2026-04-13';
        }
        """
    )
    await page.click('#purchase-item-form button[type="submit"]')
    await page.waitFor(700)
    await page.screenshot({"path": str(SHOT_DIR / "items-purchased.png"), "fullPage": True})

    await page.close()


async def main():
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    browser = await launch(
        headless=True,
        args=["--no-sandbox", "--disable-setuid-sandbox"],
    )

    try:
        await capture_static_pages(browser)
        await capture_item_operations(browser)
    finally:
        await browser.close()


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())
