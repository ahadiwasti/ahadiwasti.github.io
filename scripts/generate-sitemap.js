const fs = require("fs");
const path = require("path");

const posts = JSON.parse(fs.readFileSync(path.join(__dirname, "../blog/posts.json"), "utf8"));
const BASE_URL = "https://ahadiwasti.com";

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/all-posts.html", priority: "0.8", changefreq: "daily" },
];

const postEntries = posts.map(post => ({
  url: `/post.html?url=${encodeURIComponent(post.url)}`,
  priority: "0.7",
  changefreq: "monthly",
  lastmod: post.updated_at || post.date
}));

const allEntries = [...staticPages, ...postEntries];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.map(entry => `  <url>
    <loc>${BASE_URL}${entry.url}</loc>
    <lastmod>${entry.lastmod || new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

fs.writeFileSync(path.join(__dirname, "../sitemap.xml"), xml);
console.log(`Generated sitemap.xml with ${allEntries.length} entries`);