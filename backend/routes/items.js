const express = require('express');
const Item = require('../models/Item');
const router = express.Router();

// GET all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST new item
router.post('/', async (req, res) => {
  const item = new Item({
    title: req.body.title,
    description: req.body.description,
    type: req.body.type,
    location: req.body.location,
    contact: req.body.contact
  });

  try {
    const newItem = await item.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE item by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Item.findByIdAndDelete(id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
