require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/asteroids', async (req, res) => {
  try {
    // FIX 1: Make sure this matches your .env file variable exactly
    const API_KEY = process.env.neows_api;

    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      // FIX 3: Capital 'Error' and backticks for the message
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
    console.log("Data fetched successfully");

  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// FIX 4: This is crucial! Without this, the server stops immediately.
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});