import fs from "node:fs/promises";
import path from "node:path";

const apiToken = process.env.MONDAY_API_TOKEN;
const boardId = process.env.MONDAY_BOARD_ID;
const outPath = path.resolve("data/latest.json");

if (!apiToken || !boardId) {
  throw new Error("MONDAY_API_TOKEN and MONDAY_BOARD_ID are required.");
}

const query = `
query ($boardId: [ID!]) {
  boards(ids: $boardId) {
    id
    name
    items_page(limit: 500) {
      items {
        id
        name
        updated_at
        column_values {
          text
          column { title }
        }
      }
    }
  }
}`;

const response = await fetch("https://api.monday.com/v2", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: apiToken },
  body: JSON.stringify({ query, variables: { boardId } })
});

if (!response.ok) throw new Error(`Monday API request failed with ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(`Monday API error: ${payload.errors[0].message}`);

const board = payload.data?.boards?.[0];
if (!board) throw new Error("No board data returned.");

const campaigns = board.items_page.items.map((item) => {
  const byTitle = {};
  item.column_values.forEach((cv) => { byTitle[cv.column?.title || ""] = cv.text || ""; });
  return {
    id: item.id,
    name: item.name || "",
    subitems: byTitle.Subitems || "",
    stage: byTitle.Stage || "",
    status: byTitle.Status || "",
    assigned: byTitle.Assigned || "",
    inMarketStart: byTitle["In Market - Start"] || "",
    inMarketEnd: byTitle["In Market - End"] || "",
    offerSubtype: byTitle["Offer Subtype"] || "",
    productService: byTitle["Product/Service"] || "",
    audience: byTitle.Audience || "",
    offerType: byTitle["Offer Type"] || "",
    targetLaunch: byTitle["Target Launch"] || "",
    brand: byTitle.Brand || byTitle["Brand Name"] || "",
    updatedAt: item.updated_at
  };
});

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), board: { id: board.id, name: board.name }, campaigns }, null, 2)}\n`, "utf8");
console.log(`Wrote ${campaigns.length} campaigns to ${outPath}`);
