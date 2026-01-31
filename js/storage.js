// Storage Module - LocalStorage + JSON Export/Import

const Storage = (() => {
  const BOOKS_KEY = 'kb_books';
  const MAPS_KEY = 'kb_mindmaps';

  function getBooks() {
    return JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]');
  }

  function saveBooks(books) {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  }

  function getMindMaps() {
    return JSON.parse(localStorage.getItem(MAPS_KEY) || '[]');
  }

  function saveMindMaps(maps) {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  }

  function getBook(id) {
    return getBooks().find(b => b.id === id) || null;
  }

  function saveBook(book) {
    const books = getBooks();
    const idx = books.findIndex(b => b.id === book.id);
    if (idx >= 0) books[idx] = book;
    else books.push(book);
    saveBooks(books);
  }

  function deleteBook(id) {
    saveBooks(getBooks().filter(b => b.id !== id));
    // Also delete associated mind maps
    saveMindMaps(getMindMaps().filter(m => m.bookId !== id));
  }

  function getMindMap(id) {
    return getMindMaps().find(m => m.id === id) || null;
  }

  function saveMindMap(map) {
    const maps = getMindMaps();
    const idx = maps.findIndex(m => m.id === map.id);
    if (idx >= 0) maps[idx] = map;
    else maps.push(map);
    saveMindMaps(maps);
  }

  function deleteMindMap(id) {
    saveMindMaps(getMindMaps().filter(m => m.id !== id));
  }

  function exportData() {
    const data = { books: getBooks(), mindmaps: getMindMaps(), exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge_base_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.books) saveBooks(data.books);
          if (data.mindmaps) saveMindMaps(data.mindmaps);
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  const GITHUB_DATA_URL =
    'https://raw.githubusercontent.com/EvaIablocova/Knowlede_base/main/knowledge_base_backup_2026-01-31.json';

  async function loadDefaults() {
    try {
      const res = await fetch(GITHUB_DATA_URL, { cache: 'no-store' });
      const data = await res.json();
      if (data.books) saveBooks(data.books);
      if (data.mindmaps) saveMindMaps(data.mindmaps);
      return true;
    } catch (err) {
      console.warn('Could not load data from GitHub:', err);
      return false;
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    getBooks, saveBooks, getBook, saveBook, deleteBook,
    getMindMaps, saveMindMaps, getMindMap, saveMindMap, deleteMindMap,
    exportData, importData, generateId, loadDefaults
  };
})();
