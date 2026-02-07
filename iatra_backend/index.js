require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const TRACKED_PATH = path.join(__dirname, 'tracked.json');

async function readTracked() {
  try {
    const raw = await fs.readFile(TRACKED_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeTracked(list) {
  await fs.writeFile(TRACKED_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

app.get('/api/asteroids', async (req, res) => {
  try {
    const API_KEY = process.env.neows_api;
    if (!API_KEY) {
      return res.status(500).json({ error: "Missing neows_api key in .env" });
    }

    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.start || today;
    const endDate = req.query.end || today;

    const toDate = (value) => new Date(`${value}T00:00:00Z`);
    const addDays = (value, days) => {
      const date = toDate(value);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().split("T")[0];
    };

    const normalizedStart = startDate <= endDate ? startDate : endDate;
    const normalizedEnd = startDate <= endDate ? endDate : startDate;
    const firstEnd =
      addDays(normalizedStart, 6) < normalizedEnd
        ? addDays(normalizedStart, 6)
        : normalizedEnd;

    const buildUrl = (start, end) =>
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${API_KEY}`;

    const aggregate = {
      links: {},
      element_count: 0,
      near_earth_objects: {}
    };

    let nextUrl = buildUrl(normalizedStart, firstEnd);
    let safety = 0;

    while (nextUrl) {
      const response = await fetch(nextUrl);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      aggregate.links = data.links || aggregate.links;
      aggregate.element_count += Number(data.element_count || 0);

      const objects = data.near_earth_objects || {};
      Object.entries(objects).forEach(([dateKey, list]) => {
        if (!aggregate.near_earth_objects[dateKey]) {
          aggregate.near_earth_objects[dateKey] = [];
        }
        aggregate.near_earth_objects[dateKey].push(...list);
      });

      const nextLink = data?.links?.next;
      if (!nextLink) break;

      const nextUrlObj = new URL(nextLink);
      const nextStart = nextUrlObj.searchParams.get("start_date");
      if (nextStart && nextStart > normalizedEnd) break;

      nextUrl = nextLink;
      safety += 1;
      if (safety > 20) break;
    }

    res.json(aggregate);
    console.log(`Data fetched successfully (${normalizedStart} to ${normalizedEnd})`);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/tracked', async (req, res) => {
  try {
    const { user } = req.query;
    const tracked = await readTracked();
    const filtered = user ? tracked.filter((item) => item.user === user) : tracked;
    res.json({ tracked: filtered });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read tracked list' });
  }
});

app.post('/api/tracked', async (req, res) => {
  try {
    const { id, name, approachDate, missKm, isHazardous, hazardLabel, user } = req.body || {};
    if (!id || !name || !user) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const tracked = await readTracked();
    const exists = tracked.some((item) => String(item.id) === String(id) && item.user === user);
    if (!exists) {
      tracked.push({
        id,
        name,
        approachDate,
        missKm,
        isHazardous,
        hazardLabel,
        user,
        savedAt: new Date().toISOString()
      });
      await writeTracked(tracked);
    }
    const filtered = tracked.filter((item) => item.user === user);
    res.json({ tracked: filtered });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save tracked item' });
  }
});

app.delete('/api/tracked/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.query;
    const tracked = await readTracked();
    const next = tracked.filter((item) => {
      if (String(item.id) !== String(id)) return true;
      if (!user) return false;
      return item.user !== user;
    });
    await writeTracked(next);
    const filtered = user ? next.filter((item) => item.user === user) : next;
    res.json({ tracked: filtered });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove tracked item' });
  }
});

// FIX 4: This is crucial! Without this, the server stops immediately.
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
