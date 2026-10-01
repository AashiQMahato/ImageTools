/**
 * After `vite build`: a real HTML file for every route, each with its own title, description,
 * canonical address, sharing tags and structured data — so every page answers 200 with the right
 * metadata, on hosts without rewrite rules too, before any JavaScript runs. Also writes the sitemap,
 * robots.txt and a 404 page. The metadata comes from src/lib/seo/pages.json (the app reads it too).
 *
 * The site's address: SITE_URL (or VITE_SITE_URL) when set, else the one in pages.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const { site, pages } = JSON.parse(await fs.readFile(path.join(root, "src/lib/seo/pages.json"), "utf8"));
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || site.url).replace(/\/$/, "");
const absolute = (page) => `${siteUrl}${page === "/" ? "/" : page}`;
const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const today = new Date().toISOString().slice(0, 10);

const template = await fs.readFile(path.join(dist, "index.html"), "utf8");
const BLOCK = /<!-- seo:start[\s\S]*?<!-- seo:end -->/;
if (!BLOCK.test(template)) throw new Error("dist/index.html has no <!-- seo:start --> … <!-- seo:end --> block.");
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no <div id="root"></div>.');

/** What kind of application a page is, for structured data. */
const category = (page) => (page.startsWith("/pdf") || page === "/documents" ? "BusinessApplication" : page.startsWith("/text") || page === "/ocr" ? "UtilitiesApplication" : "MultimediaApplication");
const shortTitle = (title) => title.replace(/\s*\|\s*Studio Tools$/, "");

function structuredData(page, data, canonical) {
    const app = {
        "@type": "WebApplication",
        name: page === "/" ? site.name : shortTitle(data.title),
        url: canonical,
        description: data.description,
        applicationCategory: category(page),
        operatingSystem: "Any (runs in the web browser)",
        browserRequirements: "Requires JavaScript",
        inLanguage: ["en", "ne"],
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    };
    if (page === "/") {
        return {
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "WebSite", name: site.name, url: absolute("/"), description: data.description, inLanguage: ["en", "ne"] },
                { ...app, featureList: Object.entries(pages).filter(([key, value]) => key !== "/" && !value.canonical).map(([, value]) => value.heading) },
            ],
        };
    }
    return {
        "@context": "https://schema.org",
        "@graph": [
            app,
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: site.name, item: absolute("/") },
                    { "@type": "ListItem", position: 2, name: data.heading, item: canonical },
                ],
            },
        ],
    };
}

function headTags(page, data, { noindex = false } = {}) {
    const canonical = absolute(data.canonical ?? page);
    const image = absolute(site.image);
    const json = JSON.stringify(structuredData(page, data, canonical)).replace(/</g, "\\u003c");
    return [
        `<title>${escape(data.title)}</title>`,
        `<meta name="description" content="${escape(data.description)}" />`,
        `<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}" />`,
        ...(noindex ? [] : [`<link rel="canonical" href="${canonical}" />`]),
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${escape(site.name)}" />`,
        `<meta property="og:title" content="${escape(data.title)}" />`,
        `<meta property="og:description" content="${escape(data.description)}" />`,
        `<meta property="og:url" content="${canonical}" />`,
        `<meta property="og:image" content="${image}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${escape(site.imageAlt)}" />`,
        `<meta property="og:locale" content="${site.locale}" />`,
        `<meta property="og:locale:alternate" content="ne_NP" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escape(data.title)}" />`,
        `<meta name="twitter:description" content="${escape(data.description)}" />`,
        `<meta name="twitter:image" content="${image}" />`,
        `<meta name="twitter:image:alt" content="${escape(site.imageAlt)}" />`,
        ...(noindex ? [] : [`<script type="application/ld+json">${json}</script>`]),
    ].join("\n    ");
}

/** For crawlers and browsers without JavaScript: the page's heading and description, and links to every tool. */
function fallback(data) {
    const links = Object.entries(pages)
        .filter(([, value]) => !value.canonical)
        .map(([page, value]) => `<li><a href="${page}">${escape(value.heading)}</a></li>`)
        .join("");
    return `<noscript><main style="max-width:44rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif;line-height:1.5"><h1>${escape(data.heading)}</h1><p>${escape(data.description)}</p><p>${escape(site.name)} runs in your browser and needs JavaScript turned on.</p><nav aria-label="Tools"><ul>${links}</ul></nav></main></noscript>`;
}

function render(page, data, options) {
    return template.replace(BLOCK, `<!-- seo -->\n    ${headTags(page, data, options)}`).replace('<div id="root"></div>', `<div id="root"></div>\n    ${fallback(data)}`);
}

// Gentle checks: search results cut titles at about 60 characters and descriptions at about 160.
for (const [page, data] of Object.entries(pages)) {
    if (data.title.length > 70) console.warn(`seo: ${page} title is ${data.title.length} characters`);
    if (data.description.length < 70 || data.description.length > 165) console.warn(`seo: ${page} description is ${data.description.length} characters`);
}

let written = 0;
for (const [page, data] of Object.entries(pages)) {
    const file = page === "/" ? path.join(dist, "index.html") : path.join(dist, page.slice(1), "index.html");
    await fs.mkdir(path.dirname(file), { recursive: true });
    const html = render(page, data);
    await fs.writeFile(file, html);
    // Static hosts differ: some serve /pdf/merge from pdf/merge/index.html, others from pdf/merge.html.
    // Both carry the same canonical address, so they never count as duplicates.
    if (page !== "/") await fs.writeFile(path.join(dist, `${page.slice(1)}.html`), html);
    written++;
}

// Unknown addresses: the app (it shows its own way back), never indexed.
await fs.writeFile(path.join(dist, "404.html"), render("/", { ...pages["/"], title: `Page not found | ${site.name}` }, { noindex: true }));

const urls = Object.entries(pages)
    .filter(([, data]) => !data.canonical)
    .map(([page, data]) => `  <url>\n    <loc>${absolute(page)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${data.priority.toFixed(1)}</priority>\n  </url>`);
await fs.writeFile(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
await fs.writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absolute("/sitemap.xml")}\n`);

console.log(`seo: ${written} pages, sitemap with ${urls.length} addresses, robots.txt and 404.html for ${siteUrl}`);
