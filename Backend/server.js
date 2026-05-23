const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { User, Collection } = require('../database/schema');
const { extractMetadata } = require('./metadataService');
const { generateTags } = require('./tagService');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
  const { url, userId, collectionId, tags } = req.body;
  
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    
    // Find the collection
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    // Check if link already exists in this collection
    const existing = collection.links.find(link => link.url === url);
    if (existing) {
      return res.status(400).json({ error: 'Link already exists in this collection' });
    }
    
    // Create new link
    const newLink = {
      url,
      domain,
      tags: tags || [],
      processing: true,
      createdAt: new Date()
    };
    
    collection.links.push(newLink);
    await collection.save();
    
    const savedLink = collection.links[collection.links.length - 1];
    
    res.json({ id: savedLink._id, processing: true });
    
    // Background processing
    processMetadata(collectionId, savedLink._id, url);
  } catch (error) {
    res.status(400).json({ error: 'Invalid URL' });
  }
});

async function processMetadata(collectionId, linkId, url) {
  const metadata = await extractMetadata(url);
  const tags = generateTags(metadata.title, metadata.description);
  
  await Collection.findOneAndUpdate(
    { _id: collectionId, 'links._id': linkId },
    {
      $set: {
        'links.$.title': metadata.title,
        'links.$.description': metadata.description,
        'links.$.previewImage': metadata.previewImage,
        'links.$.favicon': metadata.favicon,
        'links.$.tags': tags,
        'links.$.processing': false
      }
    }
  );
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

// Get all links for a user (across all collections)
app.get('/api/links', async (req, res) => {
  const { userId, tag, collectionId, search } = req.query;
  
  try {
    let query = { userId };
    
    if (collectionId) {
      query._id = collectionId;
    }
    
    const collections = await Collection.find(query);
    
    // Flatten all links from all collections
    let allLinks = [];
    collections.forEach(collection => {
      collection.links.forEach(link => {
        allLinks.push({
          ...link.toObject(),
          collectionId: collection._id,
          collectionName: collection.name
        });
      });
    });
    
    // Apply filters
    if (tag) {
      allLinks = allLinks.filter(link => link.tags.includes(tag));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      allLinks = allLinks.filter(link => {
        return (
          link.title?.toLowerCase().includes(searchLower) ||
          link.description?.toLowerCase().includes(searchLower) ||
          link.domain?.toLowerCase().includes(searchLower) ||
          link.tags.some(t => t.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Sort by creation date (newest first)
    allLinks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(allLinks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Track link open
app.post('/api/links/:collectionId/:linkId/open', async (req, res) => {
  try {
    await Collection.findOneAndUpdate(
      { _id: req.params.collectionId, 'links._id': req.params.linkId },
      {
        $inc: { 'links.$.opens': 1 },
        $set: { 'links.$.lastOpenedAt': new Date() }
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track link open' });
  }
});

// Get all tags for user
app.get('/api/tags', async (req, res) => {
  const { userId } = req.query;
  
  try {
    const collections = await Collection.find({ userId });
    const allTags = new Set();
    
    collections.forEach(collection => {
      collection.links.forEach(link => {
        link.tags.forEach(tag => allTags.add(tag));
      });
    });
    
    res.json([...allTags]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get collections
app.get('/api/collections', async (req, res) => {
  const { userId } = req.query;
  
  try {
    const collections = await Collection.find({ userId });
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Get single collection with all its links
app.get('/api/collections/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  try {
    const collection = await Collection.findOne({ _id: id, userId });
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// Create collection
app.post('/api/collections', async (req, res) => {
  const { userId, name, description } = req.body;
  
  try {
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }
    
    const collection = await Collection.create({
      userId,
      name,
      description: description || '',
      links: []
    });
    
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Delete collection
app.delete('/api/collections/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  try {
    const result = await Collection.findOneAndDelete({ _id: id, userId });
    if (!result) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// Delete link from collection
app.delete('/api/links/:collectionId/:linkId', async (req, res) => {
  const { collectionId, linkId } = req.params;
  const { userId } = req.query;
  
  try {
    const collection = await Collection.findOne({ _id: collectionId, userId });
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    collection.links = collection.links.filter(link => link._id.toString() !== linkId);
    await collection.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(process.env.PORT || 3000, () => console.log(`Backend running on port ${process.env.PORT || 3000}`));
