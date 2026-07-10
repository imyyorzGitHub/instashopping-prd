const partUrls = [
  "./app-parts/part-01.js.txt",
  "./app-parts/part-02.js.txt",
  "./app-parts/part-03.js.txt",
  "./app-parts/part-04.js.txt",
  "./app-parts/part-05.js.txt",
  "./app-parts/part-06.js.txt"
];

const responses = await Promise.all(partUrls.map((url) => fetch(url)));
for (const response of responses) {
  if (!response.ok) throw new Error(`Failed to load ${response.url}: ${response.status}`);
}
const source = (await Promise.all(responses.map((response) => response.text()))).join("");
const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
