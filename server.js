const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { User, Collection, Link } = require('../database/schema');
const { extractMetadata } = require('./metadataService');
const { generateTags } = require('./tagService');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_link_organizer');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || '').split(':');
  if (!salt || !originalHash) return false;
  const candidateHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email
  };
}

app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ error: 'Account already exists.' });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: hashPassword(password)
  });

  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ error: "User doesn't exist." });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  res.json({ user: sanitizeUser(user) });
});

// Submit URL - automated processing
app.post('/api/links', async (req, res) => {
  const { url, userId, collectionId } = req.body;
  
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    
    const existing = await Link.findOne({ userId, url });
    if (existing) return res.status(400).json({ error: 'Link already exists' });
    
    const link = await Link.create({
      userId,
      collectionId: collectionId || null,
      url,
      domain,
      processing: true
    });
    
    res.json({ id: link._id, processing: true });
    
    // Background processing
    processMetadata(link._id, url);
  } catch (error) {
    res.status(400).json({ error: 'Invalid URL' });
  }
});

async function processMetadata(linkId, url) {
  const metadata = await extractMetadata(url);
  const tags = generateTags(metadata.title, metadata.description);
  
  await Link.findByIdAndUpdate(linkId, {
    ...metadata,
    tags,
    processing: false
  });
}

app.get('/api/metadata', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const metadata = await extractMetadata(url);
    res.json(metadata);
  } catch {
    res.status(400).json({ error: 'Unable to extract metadata' });
  }
});

// Get all links
app.get('/api/links', async (req, res) => {
  const { userId, tag, collectionId, search } = req.query;
  const query = { userId };
  
  if (tag) query.tags = tag;
  if (collectionId) query.collectionId = collectionId;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { title: new RegExp(escaped, 'i') },
      { description: new RegExp(escaped, 'i') },
      { domain: new RegExp(escaped, 'i') }
    ];
  }
  
  const links = await Link.find(query).sort({ createdAt: -1 });
  res.json(links);
});

// Track link open
app.post('/api/links/:id/open', async (req, res) => {
  await Link.findByIdAndUpdate(req.params.id, {
    $inc: { opens: 1 },
    lastOpenedAt: new Date()
  });
  res.json({ success: true });
});

// Get all tags for user
app.get('/api/tags', async (req, res) => {
  const { userId } = req.query;
  const links = await Link.find({ userId }, 'tags');
  const allTags = [...new Set(links.flatMap(l => l.tags))];
  res.json(allTags);
});

// Get collections
app.get('/api/collections', async (req, res) => {
  const { userId } = req.query;
  const collections = await Collection.find({ userId });
  res.json(collections);
});

// Create collection
app.post('/api/collections', async (req, res) => {
  const collection = await Collection.create(req.body);
  res.json(collection);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(process.env.PORT || 3000, () => console.log(`Backend running on port ${process.env.PORT || 3000}`));
