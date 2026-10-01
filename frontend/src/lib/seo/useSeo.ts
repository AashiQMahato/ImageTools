import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { absoluteUrl, pageSeo, SITE } from "./seo";

function setMeta(attribute: "name" | "property", key: string, content: string) {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.append(element);
    }
    element.content = content;
}

function setCanonical(href: string) {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.append(link);
    }
    link.href = href;
}

/**
 * Keeps the page's title, description, canonical address and sharing tags right as you move between
 * tools in the app (each page's HTML already has them for crawlers and first loads).
 */
export function useSeo() {
    const { pathname } = useLocation();
    useEffect(() => {
        const page = pageSeo(pathname);
        const url = absoluteUrl(page.canonical ?? page.path);
        document.title = page.title;
        setMeta("name", "description", page.description);
        setCanonical(url);
        setMeta("property", "og:title", page.title);
        setMeta("property", "og:description", page.description);
        setMeta("property", "og:url", url);
        setMeta("name", "twitter:title", page.title);
        setMeta("name", "twitter:description", page.description);
        setMeta("property", "og:image", absoluteUrl(SITE.image));
    }, [pathname]);
}
