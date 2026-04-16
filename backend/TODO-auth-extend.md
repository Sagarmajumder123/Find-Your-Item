# Auth Extension TODO

## Backend [PENDING]
- Edit `models/LostItem.js`, `FoundItem.js`: Add `user` ref to User
- Edit `routes/lostRoutes.js`, `foundRoutes.js`: Protect POST w/ auth middleware, set item.user = req.user.id, populate GET (.populate('user', 'name email'))
- Edit `routes/authRoutes.js`: Add POST /logout (client-side)

## Frontend [PENDING]
- `frontend/src/context/AuthContext.js`: Context + useAuth hook, load from localStorage
- `frontend/src/components/ProtectedRoute.js`: Route guard
- `frontend/src/components/Dashboard.js`: User dashboard (my items?)
- Edit `App.js`: Wrap Router w/ AuthProvider, protect AddLost/AddFound/Dashboard
- Edit nav: Show user/logout if logged in
- Update lists: Show user name on items

## Completion
- Update TODO
- Test protected POST, populate
- attempt_completion
