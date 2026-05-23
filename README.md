# Smart Link Organizer

A full-stack web application to save, organize, and manage your important links with collections, tags, and automatic metadata extraction.

## Features

- 🔐 User authentication (Sign up / Login)
- 📁 Organize links into collections
- 🏷️ Tag-based categorization
- 🔍 Search across links, domains, and tags
- 📊 Dashboard with statistics and most-opened links
- 🤖 Automatic metadata extraction (title, description, favicon)
- 🎯 AI-powered tag generation
- 📈 Link open tracking
- 👤 User profile management

## Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Responsive design

**Backend:**
- Node.js
- Express.js
- MongoDB (v7.0.34)
- Mongoose ODM

**Key Libraries:**
- `axios` - HTTP client for metadata fetching
- `cheerio` - HTML parsing for web scraping
- `natural` - Natural language processing for tag generation
- `stopwords` - Common words filtering

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v7.0.34)
- **macOS:** Homebrew
- **Windows:** MongoDB installer or Chocolatey

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Fsd_Smart_Link_Org
```

### 2. Install MongoDB

**macOS:**

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
```

**Windows:**

Option 1 - Using Chocolatey:
```bash
choco install mongodb
```

Option 2 - Manual Installation:
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Run the installer (.msi file)
3. Choose "Complete" installation
4. Install MongoDB as a Service (check the option during installation)

### 3. Install Node.js dependencies

```bash
npm install
```

## Running the Application

### 1. Start MongoDB

**macOS:**

```bash
brew services start mongodb/brew/mongodb-community@7.0
```

**Verify MongoDB is running:**

```bash
brew services list
```

You should see `mongodb-community@7.0` with status `started`.

**Windows:**

If installed as a service (default), MongoDB starts automatically. Otherwise:

```bash
# Start MongoDB service
net start MongoDB

# Or run mongod directly
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath="C:\data\db"
```

**Verify MongoDB is running:**

```bash
mongosh
```

If it connects successfully, MongoDB is running. Type `exit` to quit.

### 2. Start the Backend Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Open the Application

Open your browser and navigate to:

```
http://localhost:3000
```

## Usage

1. **Sign Up**: Create a new account with your name, email, and password
2. **Create Collections**: Organize your links by creating collections (e.g., "Work", "Learning", "Tools")
3. **Add Links**: Save links to your collections with automatic metadata extraction
4. **Browse & Search**: View all links, filter by tags/collections, or search
5. **Track Usage**: See which links you open most frequently on the dashboard

## Project Structure

```
Fsd_Smart_Link_Org/
├── Backend/
│   ├── server.js           # Express server and API routes
│   ├── metadataService.js  # URL metadata extraction
│   └── tagService.js       # AI tag generation
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── app.js              # Frontend JavaScript
│   └── styles.css          # Styling
├── database/
│   └── schema.js           # MongoDB schemas (User, Collection, Link)
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login existing user

### Collections
- `GET /api/collections?userId=<id>` - Get all collections for a user
- `GET /api/collections/:id?userId=<id>` - Get single collection with links
- `POST /api/collections` - Create new collection
- `DELETE /api/collections/:id?userId=<id>` - Delete collection

### Links
- `POST /api/links` - Add new link to collection
- `GET /api/links?userId=<id>` - Get all links for a user
- `GET /api/links?userId=<id>&collectionId=<id>` - Get links from specific collection
- `POST /api/links/:collectionId/:linkId/open` - Track link open
- `DELETE /api/links/:collectionId/:linkId?userId=<id>` - Delete link

### Tags
- `GET /api/tags?userId=<id>` - Get all tags for a user

### Metadata
- `GET /api/metadata?url=<url>` - Extract metadata from URL

## Database Schema

### User
- `name`: String
- `email`: String (unique)
- `passwordHash`: String
- `createdAt`: Date

### Collection
- `userId`: ObjectId (ref: User)
- `name`: String
- `description`: String
- `links`: Array of Link objects
- `createdAt`: Date

### Link (nested in Collection)
- `url`: String
- `title`: String
- `description`: String
- `domain`: String
- `tags`: Array of Strings
- `previewImage`: String
- `favicon`: String
- `opens`: Number
- `processing`: Boolean
- `lastOpenedAt`: Date
- `createdAt`: Date

## Stopping the Application

### Stop the Backend Server

Press `Ctrl+C` in the terminal where the server is running (works on both macOS and Windows).

### Stop MongoDB

**macOS:**

```bash
brew services stop mongodb/brew/mongodb-community@7.0
```

**Windows:**

```bash
# Stop MongoDB service
net stop MongoDB

# Or if running mongod directly, press Ctrl+C in that terminal
```

## Development

To run the server with auto-restart on file changes:

```bash
npm run dev
```

(Requires `nodemon` - already included in devDependencies)

## MongoDB Version

This project uses **MongoDB v7.0.34**

## Notes

- Each user's data is completely isolated (separate collections and links)
- Links are stored inside collections (nested structure)
- Metadata extraction works for most websites (YouTube, articles, documentation, etc.)
- Tags are auto-generated using NLP but can also be manually created
- Password hashing uses Node.js crypto module with scrypt

## Troubleshooting

**MongoDB connection error:**

*macOS:*
```bash
# Check if MongoDB is running
brew services list

# Restart MongoDB
brew services restart mongodb/brew/mongodb-community@7.0
```

*Windows:*
```bash
# Check if MongoDB service is running
sc query MongoDB

# Restart MongoDB service
net stop MongoDB
net start MongoDB
```

**Port 3000 already in use:**

*macOS/Linux:*
```bash
# Find and kill the process
lsof -ti:3000
kill -9 $(lsof -ti:3000)
```

*Windows:*
```bash
# Find the process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Module not found errors:**

*macOS/Linux:*
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

*Windows:*
```bash
# Reinstall dependencies
rmdir /s /q node_modules
del package-lock.json
npm install
```

## License

ISC

## Author

Your Name
