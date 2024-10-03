const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;

// Middleware
app.use(cors());

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Save file with a timestamp
  },
});
const upload = multer({ storage: storage });

// Connect to SQLite database
const db = new sqlite3.Database('./recipes.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    db.run(
      `CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        poster TEXT NOT NULL,
        ingredients TEXT NOT NULL,
        instructions TEXT NOT NULL,
        image TEXT NOT NULL,
        liked INTEGER DEFAULT 0,
        favorited INTEGER DEFAULT 0
      )`,
      (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        } else {
          console.log('Connected to the SQLite database.');
        }
      }
    );
  }
});

// Get all recipes
app.get('/api/recipes', (req, res) => {
  db.all('SELECT * FROM recipes', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    // Modify image paths to include the server address
    const modifiedRows = rows.map((row) => {
      return {
        ...row,
        image: `http://localhost:${port}/uploads/${path.basename(row.image)}`,
      };
    });
    res.json({
      data: modifiedRows,
    });
  });
});

// Add a new recipe
app.post('/api/recipes', upload.single('image'), (req, res) => {
  const { name, poster, ingredients, instructions } = req.body;
  const image = req.file.path;

  const sql =
    'INSERT INTO recipes (name, poster, ingredients, instructions, image) VALUES (?, ?, ?, ?, ?)';
  const params = [name, poster, ingredients, instructions, image];
  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      console.error('Error inserting recipe:', err.message);
      return;
    }
    console.log('Recipe inserted successfully with ID:', this.lastID);
    res.json({
      message: 'Recipe added successfully',
      data: {
        id: this.lastID,
        name,
        poster,
        ingredients,
        instructions,
        image: `http://localhost:${port}/uploads/${path.basename(image)}`,
        liked: 0,
        favorited: 0,
      },
    });
  });
});

// Delete a recipe
app.delete('/api/recipes/:id', (req, res) => {
  const id = req.params.id;
  // First, get the image path to delete the file
  db.get('SELECT image FROM recipes WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (row) {
      // Delete the image file
      fs.unlink(row.image, (err) => {
        if (err) {
          console.error('Error deleting image file:', err);
        }
      });
      // Delete the recipe from the database
      db.run('DELETE FROM recipes WHERE id = ?', id, function (err) {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }
        res.json({
          message: 'Recipe deleted successfully',
          data: { id },
        });
      });
    } else {
      res.status(404).json({ error: 'Recipe not found' });
    }
  });
});

// Update liked status of a recipe
app.put('/api/recipes/:id/like', express.json(), (req, res) => {
  const id = req.params.id;
  const { liked } = req.body;
  const sql = 'UPDATE recipes SET liked = ? WHERE id = ?';
  const params = [liked, id];
  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      message: 'Recipe liked status updated successfully',
      data: { id, liked },
    });
  });
});

// Update favorited status of a recipe
app.put('/api/recipes/:id/favorite', express.json(), (req, res) => {
  const id = req.params.id;
  const { favorited } = req.body;
  const sql = 'UPDATE recipes SET favorited = ? WHERE id = ?';
  const params = [favorited, id];
  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      message: 'Recipe favorited status updated successfully',
      data: { id, favorited },
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
