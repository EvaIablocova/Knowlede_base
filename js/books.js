// Books Module - Book & Highlights Management

const Books = (() => {
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C42', '#98D8C8'];

  function renderDashboard() {
    const books = Storage.getBooks();
    const maps = Storage.getMindMaps();
    const container = document.getElementById('view-container');

    container.innerHTML = `
      <div class="dashboard">
        <div class="dashboard-header">
          <h1>My Knowledge Base</h1>
          <div class="dashboard-actions">
            <input type="text" id="search-input" class="search-input" placeholder="Search books..." />
            <button class="btn btn-primary" onclick="Books.showAddBookModal()">+ Add Book</button>
            <button class="btn btn-secondary" onclick="Storage.exportData()">Export</button>
            <label class="btn btn-secondary">
              Import
              <input type="file" accept=".json" style="display:none" onchange="Books.handleImport(event)" />
            </label>
          </div>
        </div>
        <div class="books-grid" id="books-grid">
          ${books.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📚</div>
              <h2>No books yet</h2>
              <p>Add your first book and start collecting highlights!</p>
              <button class="btn btn-primary" onclick="Books.showAddBookModal()">+ Add Your First Book</button>
            </div>
          ` : books.map(book => {
            const mapCount = maps.filter(m => m.bookId === book.id).length;
            return `
              <div class="book-card" style="border-top: 4px solid ${book.cover_color}" onclick="Books.renderBookDetail('${book.id}')">
                <div class="book-card-color" style="background: ${book.cover_color}">
                  <span class="book-icon">📖</span>
                </div>
                <div class="book-card-info">
                  <h3>${escapeHtml(book.title)}</h3>
                  <p class="book-author">${escapeHtml(book.author || 'Unknown author')}</p>
                  <div class="book-stats">
                    <span class="stat">${book.highlights.length} highlights</span>
                    <span class="stat">${mapCount} mind map${mapCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.book-card').forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? '' : 'none';
        });
      });
    }
  }

  function showAddBookModal(editBook = null) {
    const modal = document.getElementById('modal');
    const isEdit = !!editBook;
    modal.innerHTML = `
      <div class="modal-overlay" onclick="Books.closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h2>${isEdit ? 'Edit Book' : 'Add New Book'}</h2>
          <form id="book-form">
            <label>Title *</label>
            <input type="text" id="book-title" required value="${isEdit ? escapeHtml(editBook.title) : ''}" />
            <label>Author</label>
            <input type="text" id="book-author" value="${isEdit ? escapeHtml(editBook.author || '') : ''}" />
            <label>Color</label>
            <div class="color-picker">
              ${COLORS.map(c => `
                <div class="color-swatch ${(!isEdit && c === COLORS[0]) || (isEdit && c === editBook.cover_color) ? 'selected' : ''}"
                     style="background:${c}" data-color="${c}" onclick="Books.selectColor(this)"></div>
              `).join('')}
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" onclick="Books.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add Book'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    modal.style.display = 'block';

    document.getElementById('book-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('book-title').value.trim();
      const author = document.getElementById('book-author').value.trim();
      const color = document.querySelector('.color-swatch.selected')?.dataset.color || COLORS[0];

      if (!title) return;

      const book = isEdit
        ? { ...editBook, title, author, cover_color: color }
        : { id: Storage.generateId(), title, author, cover_color: color, created_at: new Date().toISOString(), highlights: [] };

      Storage.saveBook(book);
      closeModal();
      if (isEdit) renderBookDetail(book.id);
      else renderDashboard();
    });
  }

  function selectColor(el) {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
    modal.innerHTML = '';
  }

  function renderBookDetail(bookId) {
    const book = Storage.getBook(bookId);
    if (!book) return renderDashboard();
    const maps = Storage.getMindMaps().filter(m => m.bookId === bookId);
    const container = document.getElementById('view-container');

    container.innerHTML = `
      <div class="book-detail">
        <div class="detail-header">
          <button class="btn btn-back" onclick="Books.renderDashboard()">← Back</button>
          <div class="detail-title" style="border-left: 4px solid ${book.cover_color}">
            <h1>${escapeHtml(book.title)}</h1>
            <p class="book-author">${escapeHtml(book.author || 'Unknown author')}</p>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary" onclick="Books.showAddHighlightModal('${book.id}')">+ Add Highlight</button>
            <button class="btn btn-accent" onclick="MindMap.createFromBook('${book.id}')">🧠 Create Mind Map</button>
            <button class="btn btn-secondary" onclick="Books.showAddBookModal(Storage.getBook('${book.id}'))">Edit</button>
            <button class="btn btn-danger" onclick="Books.confirmDeleteBook('${book.id}')">Delete</button>
          </div>
        </div>

        ${maps.length > 0 ? `
          <div class="section">
            <h2>Mind Maps</h2>
            <div class="maps-list">
              ${maps.map(m => `
                <div class="map-card" onclick="MindMap.renderViewer('${m.id}')">
                  <span class="map-icon">🧠</span>
                  <span>${escapeHtml(m.title)}</span>
                  <span class="map-date">${new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="section">
          <h2>Highlights (${book.highlights.length})</h2>
          <div class="highlights-list" id="highlights-list">
            ${book.highlights.length === 0 ? `
              <div class="empty-state small">
                <p>No highlights yet. Start adding your favorite quotes!</p>
              </div>
            ` : book.highlights.map((h, i) => `
              <div class="highlight-card" style="border-left: 4px solid ${h.color || book.cover_color}">
                <div class="highlight-text">"${escapeHtml(h.text)}"</div>
                ${h.chapter ? `<div class="highlight-chapter">Chapter: ${escapeHtml(h.chapter)}</div>` : ''}
                ${h.tags && h.tags.length ? `<div class="highlight-tags">${h.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                <div class="highlight-actions">
                  <button class="btn-icon" onclick="event.stopPropagation(); Books.showAddHighlightModal('${book.id}', ${i})">✏️</button>
                  <button class="btn-icon" onclick="event.stopPropagation(); Books.deleteHighlight('${book.id}', ${i})">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function showAddHighlightModal(bookId, editIndex = null) {
    const book = Storage.getBook(bookId);
    const isEdit = editIndex !== null;
    const highlight = isEdit ? book.highlights[editIndex] : null;
    const modal = document.getElementById('modal');

    modal.innerHTML = `
      <div class="modal-overlay" onclick="Books.closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h2>${isEdit ? 'Edit Highlight' : 'Add Highlight'}</h2>
          <form id="highlight-form">
            <label>Quote / Note *</label>
            <textarea id="hl-text" rows="4" required>${isEdit ? escapeHtml(highlight.text) : ''}</textarea>
            <label>Chapter (optional)</label>
            <input type="text" id="hl-chapter" value="${isEdit && highlight.chapter ? escapeHtml(highlight.chapter) : ''}" />
            <label>Tags (comma-separated)</label>
            <input type="text" id="hl-tags" value="${isEdit && highlight.tags ? highlight.tags.join(', ') : ''}" />
            <label>Color</label>
            <div class="color-picker">
              ${COLORS.map(c => `
                <div class="color-swatch ${(isEdit && highlight.color === c) || (!isEdit && c === book.cover_color) ? 'selected' : ''}"
                     style="background:${c}" data-color="${c}" onclick="Books.selectColor(this)"></div>
              `).join('')}
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" onclick="Books.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    modal.style.display = 'block';

    document.getElementById('highlight-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = document.getElementById('hl-text').value.trim();
      if (!text) return;
      const chapter = document.getElementById('hl-chapter').value.trim();
      const tags = document.getElementById('hl-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const color = document.querySelector('.color-swatch.selected')?.dataset.color || book.cover_color;

      const hl = { id: isEdit ? highlight.id : Storage.generateId(), text, chapter, tags, color };

      if (isEdit) book.highlights[editIndex] = hl;
      else book.highlights.push(hl);

      Storage.saveBook(book);
      closeModal();
      renderBookDetail(bookId);
    });
  }

  function deleteHighlight(bookId, index) {
    if (!confirm('Delete this highlight?')) return;
    const book = Storage.getBook(bookId);
    book.highlights.splice(index, 1);
    Storage.saveBook(book);
    renderBookDetail(bookId);
  }

  function confirmDeleteBook(bookId) {
    if (!confirm('Delete this book and all its highlights and mind maps?')) return;
    Storage.deleteBook(bookId);
    renderDashboard();
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    Storage.importData(file).then(() => {
      renderDashboard();
    }).catch(err => alert(err.message));
  }

  return {
    renderDashboard, renderBookDetail, showAddBookModal, showAddHighlightModal,
    selectColor, closeModal, deleteHighlight, confirmDeleteBook, handleImport
  };
})();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
