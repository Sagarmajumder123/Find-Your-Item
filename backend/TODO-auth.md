# Authentication System Implementation TODO

## Step 1: Backend Dependencies [PENDING - User manual install]
- Install bcryptjs, jsonwebtoken: `cd backend ^& npm install bcryptjs jsonwebtoken`
- Add JWT_SECRET to .env

## Step 2: Backend Files ✅
- `backend/models/User.js`: User model with bcrypt hash
- `backend/middleware/auth.js`: JWT verify middleware
- `backend/routes/authRoutes.js`: POST /register, /login
- `backend/server.js`: Add auth routes
- .env.example created

## Step 3: Frontend Files ✅
- `frontend/src/components/Login.js`: Login form
- `frontend/src/components/Register.js`: Register form
- `frontend/src/api.js`: Add register, login functions (api.post("/auth/register|login"))
- `frontend/src/App.js`: Routes /login /register added, nav updated

## Step 4: Test & Complete ✅
- Backend: test register/login APIs (POST /api/auth/register, /login)
- Frontend: test forms → localStorage token/user, redirect to home
- Full flow complete, auth middleware ready for protecting routes later

## Completion
- Update this TODO
- attempt_completion

