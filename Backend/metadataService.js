const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

function stripWww(hostname) {
  return hostname.replace(/^www\./i, '');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function absolutizeUrl(value, baseUrl) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return new URL(text, baseUrl).toString();
  } catch {
    return '';
  }
}

function cleanTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTitle(title, domain) {
  let next = cleanTitle(title);
  if (!next) return '';

  const segments = next
    .split(/\s(?:\||-|\u2022|\u00b7|\u2014|\u2013)\s/)
    .map((segment) => cleanTitle(segment))
    .filter(Boolean);

  if (segments.length > 1) {
    const best = segments.find((segment) => {
      const lowered = segment.toLowerCase();
      return !lowered.includes(domain.toLowerCase()) && segment.length >= 6;
    });
    if (best) next = best;
  }

  next = next.replace(/^(watch|download|stream|read)\s+/i, '');
  next = next.replace(/\s+(online|free online).*$/i, '');
  next = next.replace(/\s+\|\s+chatgpt$/i, '');
  next = next.replace(/\s+-\s+chatgpt$/i, '');

  if (next.includes(':') && next.length > 70) {
    next = cleanTitle(next.split(':')[0]);
  }

  return cleanTitle(next);
}

function isWeakTitle(title, domain) {
  const normalizedTitle = cleanTitle(title).toLowerCase();
  const normalizedDomain = cleanTitle(domain).toLowerCase();
  if (!normalizedTitle) return true;
  if (normalizedTitle === normalizedDomain) return true;
  if (normalizedTitle === `www.${normalizedDomain}`) return true;
  return false;
}

function extractJsonLdValue(node) {
  if (!node || typeof node !== 'object') return '';
  return firstNonEmpty(
    node.headline,
    node.name,
    node.alternativeHeadline,
    node.title
  );
}

function extractJsonLdTitle($) {
  let best = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (best) return;
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const candidates = Array.isArray(node?.['@graph']) ? node['@graph'] : [node];
        for (const candidate of candidates) {
          const value = cleanTitle(extractJsonLdValue(candidate));
          if (value) {
            best = value;
            return false;
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });
  return best;
}

function extractTitleFromMirrorText(text, domain) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => cleanTitle(line))
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('Title:')) {
      const title = cleanTitle(line.slice(6));
      if (!isWeakTitle(title, domain)) return title;
    }
  }

  for (const line of lines) {
    if (line.startsWith('#')) {
      const title = cleanTitle(line.replace(/^#+\s*/, ''));
      if (!isWeakTitle(title, domain)) return title;
    }
  }

  for (const line of lines.slice(0, 20)) {
    if (!isWeakTitle(line, domain) && line.length <= 180) {
      return line;
    }
  }

  return '';
}

async function extractFromMirror(url, domain) {
  try {
    const response = await axios.get(`https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`, {
      timeout: 4500,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return {
      title: extractTitleFromMirrorText(response.data, domain),
      description: ''
    };
  } catch {
    return { title: '', description: '' };
  }
}

function asYouTubeWatchUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const videoId = parsed.pathname.replace(/^\/+/, '').trim();
      return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '';
    }
    if (host.endsWith('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '';
    }
    return '';
  } catch {
    return '';
  }
}

async function extractYouTubeTitle(url) {
  try {
    const watchUrl = asYouTubeWatchUrl(url);
    if (!watchUrl) return '';
    const response = await axios.get('https://www.youtube.com/oembed', {
      params: { url: watchUrl, format: 'json' },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return String(response.data?.title || '').trim();
  } catch {
    return '';
  }
}

async function extractMetadata(url) {
  const parsedUrl = new URL(url);
  const domain = stripWww(parsedUrl.hostname);

  try {
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname === 'youtu.be') {
      const title = await extractYouTubeTitle(url);
      if (title) {
        return {
          title,
          description: '',
          previewImage: '',
          favicon: '',
          domain
        };
      }
    }

    const response = await axios.get(url, {
      timeout: 4500,
      maxRedirects: 5,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });
    const finalUrl = response.request?.res?.responseUrl || url;
    const $ = cheerio.load(response.data);

    const title = firstNonEmpty(
      $('meta[property="og:title"]').attr('content'),
      $('meta[name="twitter:title"]').attr('content'),
      $('meta[name="title"]').attr('content'),
      $('meta[property="twitter:text:title"]').attr('content'),
      extractJsonLdTitle($),
      $('title').first().text(),
      $('h1').first().text(),
      domain
    );

    const description = firstNonEmpty(
      $('meta[property="og:description"]').attr('content'),
      $('meta[name="twitter:description"]').attr('content'),
      $('meta[name="description"]').attr('content')
    );

    const previewImage = absolutizeUrl(
      firstNonEmpty(
        $('meta[property="og:image"]').attr('content'),
        $('meta[name="twitter:image"]').attr('content')
      ),
      finalUrl
    );

    const favicon = absolutizeUrl(
      firstNonEmpty(
        $('link[rel="icon"]').attr('href'),
        $('link[rel="shortcut icon"]').attr('href'),
        $('link[rel="apple-touch-icon"]').attr('href')
      ),
      finalUrl
    );

    const mirrorPromise = extractFromMirror(url, domain);
    const resolvedTitle = !isWeakTitle(title, domain) ? title : domain;
    const finalTitle = normalizeTitle(resolvedTitle, domain) || domain;

    if (!isWeakTitle(finalTitle, domain)) {
      return {
        title: finalTitle,
        description,
        previewImage,
        favicon,
        domain
      };
    }

    const fallbackTitle = cleanTitle((await mirrorPromise).title);
    const retriedTitle = normalizeTitle(fallbackTitle || finalTitle, domain) || domain;

    return {
      title: retriedTitle,
      description,
      previewImage,
      favicon,
      domain
    };
  } catch {
    const fallback = await extractFromMirror(url, domain);
    return {
      title: normalizeTitle(fallback.title, domain) || domain,
      description: cleanTitle(fallback.description),
      previewImage: '',
      favicon: '',
      domain
    };
  }
}

module.exports = { extractMetadata };
