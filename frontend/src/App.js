import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';

import Home from './components/Home';
import LostItems from './components/LostItems';
import FoundItems from './components/FoundItems';
import AddLost from './components/AddLost';
import AddFound from './components/AddFound';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ItemDetail from './components/ItemDetail';
import EditLost from './components/EditLost';
import Chat from './components/Chat';
import Matches from './components/Matches';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import Footer from './components/Footer';

function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/lost" element={<LostItems />} />
          <Route path="/found" element={<FoundItems />} />
          <Route path="/item/:type/:id" element={<ItemDetail />} />
          <Route path="/matches" element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/add-lost" element={
            <ProtectedRoute>
              <AddLost />
            </ProtectedRoute>
          } />
          <Route path="/add-found" element={
            <ProtectedRoute>
              <AddFound />
            </ProtectedRoute>
          } />
          <Route path="/edit/lost/:id" element={
            <ProtectedRoute>
              <EditLost />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/chat/:userId" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
      <Toast />
      <Footer />
    </div>
  );
}

export default App;
