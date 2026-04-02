/**
 * Simple JSON file-based storage.
 * Each "table" is a JSON file in /data.
 * Drop-in replacement for Prisma — swap to real DB later.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) {
  return path.join(DATA_DIR, name + '.json');
}

function readTable(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeTable(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

function nextId(table) {
  const rows = readTable(table);
  if (rows.length === 0) return 1;
  return Math.max(...rows.map(r => r.id)) + 1;
}

// ============ GENERIC CRUD ============

const db = {
  // Read all rows
  all(table) {
    return readTable(table);
  },

  // Find by predicate
  find(table, predicate) {
    return readTable(table).filter(predicate);
  },

  // Find one
  findOne(table, predicate) {
    return readTable(table).find(predicate) || null;
  },

  // Find by id
  findById(table, id) {
    return readTable(table).find(r => r.id === id) || null;
  },

  // Insert
  insert(table, row) {
    const rows = readTable(table);
    if (!row.id) row.id = nextId(table);
    rows.push(row);
    writeTable(table, rows);
    return row;
  },

  // Update by id
  update(table, id, updates) {
    const rows = readTable(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    Object.assign(rows[idx], updates);
    writeTable(table, rows);
    return rows[idx];
  },

  // Update by predicate (first match)
  updateWhere(table, predicate, updates) {
    const rows = readTable(table);
    const idx = rows.findIndex(predicate);
    if (idx === -1) return null;
    Object.assign(rows[idx], updates);
    writeTable(table, rows);
    return rows[idx];
  },

  // Delete by id
  remove(table, id) {
    const rows = readTable(table);
    const filtered = rows.filter(r => r.id !== id);
    if (filtered.length === rows.length) return false;
    writeTable(table, filtered);
    return true;
  },

  // Delete by predicate
  removeWhere(table, predicate) {
    const rows = readTable(table);
    const filtered = rows.filter(r => !predicate(r));
    const removed = rows.length - filtered.length;
    writeTable(table, filtered);
    return removed;
  },

  // Count
  count(table, predicate) {
    if (!predicate) return readTable(table).length;
    return readTable(table).filter(predicate).length;
  },

  // Upsert — find by predicate, update or insert
  upsert(table, predicate, data) {
    const existing = db.findOne(table, predicate);
    if (existing) {
      return db.update(table, existing.id, data);
    }
    return db.insert(table, data);
  }
};

module.exports = db;
