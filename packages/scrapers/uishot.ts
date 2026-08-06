import { chromium } from "playwright";
const vin = process.argv[2];
const b = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1100, height: 1100 } });
await p.goto(`http://localhost:3005/vin/${vin}`, { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(1500);
console.log("zdjec na stronie:", await p.locator('img[alt*="—"]').count());
await p.screenshot({ path: "/tmp/vinpage.png", fullPage: true });
await b.close();
