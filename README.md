# NOID – Dynamic ID Card Generation Web App (MERN Stack)

A complete **MERN Stack** (MongoDB, Express.js, React, Node.js) web application to generate student ID cards by PID. 
The application queries student records from **MongoDB** (with automatic seeding and graceful in-memory fallback) and renders a pixel-perfect, high-fidelity ID card.

## 🚀 MERN Tech Stack
- **M - MongoDB**: NoSQL Database with Mongoose ODM (models, auto-seeding, and indexing)
- **E - Express.js**: REST API backend server with static photo and asset routing
- **R - React.js**: Fast SPA built with Vite and pure CSS replicating exact original designs
- **N - Node.js**: JavaScript runtime powering both frontend build and backend execution

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Database & Environment
Default MongoDB connection is configured in `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/noid_db
```
*Note: If MongoDB is offline, the backend automatically runs in fallback mode with all 62 pre-loaded student records.*

### 3. Run the MERN Application
```bash
npm run dev
```

- **Frontend (React)**: `http://localhost:5173`
- **Backend API (Express + MongoDB)**: `http://localhost:5000`

---

## 🧪 Test PIDs to Try
- `EU1244004` (Shamitha Palai)
- `EU1244001` (Manaswi Gharat)
- `EU1244003` (Pooja Sahu)
- `EU1244051` (Vidhisha Sonar)
- `EU1244010` (Bhargavi Ahire)
- `EU1244017` (Saanj Bari)
- `EU1244033` (Shubham Kini)
- `EU1244049` (Sanskar Agre)

---

## 📁 MERN Project Structure

```
NOID/
├── package.json              # Root orchestration scripts (concurrently)
├── backend/
│   ├── package.json          # Express, Mongoose, dotenv, cors
│   ├── .env                  # MongoDB URI & Port config
│   └── src/
│       ├── server.js         # Express REST API routes
│       ├── db.js             # Mongoose connection & fallback mechanism
│       ├── seedData.js       # 62 Student seed records
│       └── models/
│           └── Student.js    # Mongoose Student Schema & Model
├── frontend/
│   ├── package.json          # React + Vite dependencies
│   ├── vite.config.js        # Vite config with backend proxy
│   ├── index.html            # HTML entrypoint
│   ├── public/
│   │   ├── photos/           # Student photos & logos
│   │   ├── NOID.jpg
│   │   └── aldel.jpg
│   └── src/
│       ├── main.jsx          # React mount
│       ├── App.jsx           # State & view router
│       ├── index.css         # High-fidelity ID card & layout styles
│       └── components/
│           ├── PidSearch.jsx # PID search form
│           └── IdCard.jsx    # ID Card presentation component
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & MongoDB status |
| `GET` | `/api/students/:pid` | Fetch student details from MongoDB by PID |
| `POST` | `/api/students/generate` | Generate/retrieve ID card by PID |
| `GET` | `/api/students/sample` | Get sample demo PIDs |
| `GET` | `/photos/:filename` | Serve student photo |
