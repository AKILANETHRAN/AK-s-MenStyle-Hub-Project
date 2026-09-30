import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_DIR = path.resolve(__dirname, '../../stylehub-frontend/public');
const BACKEND_DIR = path.resolve(__dirname, '../public');

async function getDDGToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const m = html.match(/vqd=([\d-]+)/);
  return m ? m[1] : null;
}

async function searchImage(query) {
  try {
    const vqd = await getDDGToken(query);
    if (!vqd) return null;
    await new Promise(r => setTimeout(r, 400));
    const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const d = await resImg.json();
    return d.results || [];
  } catch {
    return [];
  }
}
