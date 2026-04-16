# Lost & Found Portal

## Full-Stack Web Application

A modern Lost & Found portal built with React (Frontend) + Node.js/Express/MongoDB (Backend).

## Folder Structure
```
lost-found-portal/
│
├── backend/           # Node.js + Express + MongoDB API
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── .env
│
├── frontend/          # React Application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.js
│   └── package.json
└── README.md
```

## Setup Instructions

### Backend Setup
1. Navigate to backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file and add:
   ```
   MONGODB_URI=your_mongodb_connection_string
   PORT=5000
   ```

4. Start backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start frontend (runs on http://localhost:3000):
   ```bash
   npm start
   ```

## Features
- View all lost/found items
- Add new lost/found items
- Filter by Lost/Found
- Responsive design
- RESTful API

## API Endpoints
- `GET /items` - Fetch all items
- `POST /items` - Create new item
- `DELETE /items/:id` - Delete item

## Tech Stack
**Backend:** Node.js, Express, MongoDB, Mongoose  
**Frontend:** React, Axios, Modern CSS
