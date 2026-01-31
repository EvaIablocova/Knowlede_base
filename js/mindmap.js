// Mind Map Module - Builder & Renderer

const MindMap = (() => {
  const NODE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C42', '#98D8C8', '#A8E6CF', '#FFD93D'];
  let currentMap = null;
  let panOffset = { x: 0, y: 0 };
  let zoom = 1;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  function createFromBook(bookId) {
    const book = Storage.getBook(bookId);
    if (!book || book.highlights.length === 0) {
      alert('Add some highlights first to create a mind map.');
      return;
    }

    // Group highlights by chapter, or just flat list
    const chapters = {};
    const noChapter = [];
    book.highlights.forEach(h => {
      if (h.chapter) {
        if (!chapters[h.chapter]) chapters[h.chapter] = [];
        chapters[h.chapter].push(h);
      } else {
        noChapter.push(h);
      }
    });

    let outlineText = book.title + '\n';
    if (Object.keys(chapters).length > 0) {
      for (const [ch, hls] of Object.entries(chapters)) {
        outlineText += '\t' + ch + '\n';
        hls.forEach(h => { outlineText += '\t\t' + h.text.slice(0, 80) + '\n'; });
      }
    }
    noChapter.forEach(h => { outlineText += '\t' + h.text.slice(0, 80) + '\n'; });

    const map = {
      id: Storage.generateId(),
      bookId: book.id,
      title: `Mind Map: ${book.title}`,
      created_at: new Date().toISOString(),
      outline: outlineText,
      root: null
    };

    map.root = parseOutline(outlineText);
    Storage.saveMindMap(map);
    renderBuilder(map.id);
  }

  function parseOutline(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { text: 'Central Topic', color: NODE_COLORS[0], children: [] };

    const root = { text: lines[0].trim(), color: NODE_COLORS[0], children: [] };
    const stack = [{ node: root, depth: -1 }];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const depth = line.search(/\S/) === -1 ? 0 : (line.match(/^(\t*)/)[1].length || Math.floor((line.match(/^( *)/)[1].length) / 2));
      const text = line.trim();
      if (!text) continue;

      const node = { text, color: NODE_COLORS[(i) % NODE_COLORS.length], children: [] };

      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }

      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, depth });
    }

    return root;
  }

  function renderBuilder(mapId) {
    currentMap = Storage.getMindMap(mapId);
    if (!currentMap) return Books.renderDashboard();

    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="mindmap-builder">
        <div class="builder-header">
          <button class="btn btn-back" onclick="Books.renderBookDetail('${currentMap.bookId}')">← Back to Book</button>
          <input type="text" class="map-title-input" id="map-title" value="${escapeHtml(currentMap.title)}" />
          <div class="builder-actions">
            <button class="btn btn-primary" onclick="MindMap.saveCurrentMap()">Save</button>
            <button class="btn btn-secondary" onclick="MindMap.renderViewer('${mapId}')">Full View</button>
            <button class="btn btn-danger" onclick="MindMap.deleteMap('${mapId}')">Delete</button>
          </div>
        </div>
        <div class="builder-body">
          <div class="outline-panel">
            <h3>Text Outline</h3>
            <p class="hint">Use Tab to indent (create child nodes), Shift+Tab to outdent. Each line becomes a node.</p>
            <textarea id="outline-editor" spellcheck="false">${escapeHtml(currentMap.outline || '')}</textarea>
          </div>
          <div class="preview-panel">
            <h3>Preview</h3>
            <div class="canvas-controls">
              <button class="btn-icon" onclick="MindMap.zoomIn()">🔍+</button>
              <button class="btn-icon" onclick="MindMap.zoomOut()">🔍−</button>
              <button class="btn-icon" onclick="MindMap.resetView()">⟲</button>
            </div>
            <div class="canvas-wrapper" id="canvas-wrapper">
              <svg id="mindmap-svg" xmlns="http://www.w3.org/2000/svg"></svg>
            </div>
          </div>
        </div>
      </div>
    `;

    const editor = document.getElementById('outline-editor');
    editor.addEventListener('input', debounce(() => updatePreview(), 300));
    editor.addEventListener('keydown', handleTabKey);

    setupPanZoom();
    updatePreview();
  }

  function handleTabKey(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // Find current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', start);
      const actualEnd = lineEnd === -1 ? value.length : lineEnd;

      if (e.shiftKey) {
        // Remove one tab from line start
        if (value[lineStart] === '\t') {
          textarea.value = value.slice(0, lineStart) + value.slice(lineStart + 1);
          textarea.selectionStart = textarea.selectionEnd = start - 1;
        }
      } else {
        // Add tab at line start
        textarea.value = value.slice(0, lineStart) + '\t' + value.slice(lineStart);
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }

      textarea.dispatchEvent(new Event('input'));
    }
  }

  function updatePreview() {
    const editor = document.getElementById('outline-editor');
    if (!editor) return;
    const outline = editor.value;
    const root = parseOutline(outline);

    if (currentMap) {
      currentMap.outline = outline;
      currentMap.root = root;
    }

    renderSVG(root, document.getElementById('mindmap-svg'));
  }

  function renderSVG(root, svg, options = {}) {
    if (!svg || !root) return;

    const layout = computeLayout(root, 0, 0);
    const bounds = getBounds(layout);
    const padding = 60;

    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;
    const offsetX = -bounds.minX + padding;
    const offsetY = -bounds.minY + padding;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.transform = `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`;

    let html = `<defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.15"/>
      </filter>
    </defs>`;

    html += renderConnections(layout, offsetX, offsetY);
    html += renderNodes(layout, offsetX, offsetY);

    svg.innerHTML = html;
  }

  function computeLayout(node, depth, index) {
    const NODE_H = 44;
    const NODE_SPACING_Y = 16;
    const LEVEL_SPACING_X = 220;

    const result = {
      text: node.text,
      color: node.color,
      x: depth * LEVEL_SPACING_X,
      y: 0,
      width: Math.min(Math.max(node.text.length * 8 + 30, 100), 200),
      height: NODE_H,
      children: []
    };

    if (node.children.length > 0) {
      let totalHeight = 0;
      result.children = node.children.map((child, i) => {
        const childLayout = computeLayout(child, depth + 1, i);
        return childLayout;
      });

      // Calculate subtree heights
      const subtreeHeights = result.children.map(c => getSubtreeHeight(c, NODE_H, NODE_SPACING_Y));
      const totalChildrenHeight = subtreeHeights.reduce((s, h) => s + h, 0) + (result.children.length - 1) * NODE_SPACING_Y;

      let currentY = -totalChildrenHeight / 2;
      result.children.forEach((child, i) => {
        const sh = subtreeHeights[i];
        positionSubtree(child, currentY + sh / 2);
        currentY += sh + NODE_SPACING_Y;
      });
    }

    return result;
  }

  function getSubtreeHeight(node, nodeH, spacing) {
    if (node.children.length === 0) return nodeH;
    const childHeights = node.children.map(c => getSubtreeHeight(c, nodeH, spacing));
    return Math.max(nodeH, childHeights.reduce((s, h) => s + h, 0) + (node.children.length - 1) * spacing);
  }

  function positionSubtree(node, centerY) {
    const dy = centerY - node.y;
    node.y = centerY;
    node.children.forEach(c => { c.y += dy; positionSubtree(c, c.y); });
  }

  function getBounds(node) {
    let minX = node.x, maxX = node.x + node.width, minY = node.y - node.height / 2, maxY = node.y + node.height / 2;
    node.children.forEach(c => {
      const cb = getBounds(c);
      minX = Math.min(minX, cb.minX);
      maxX = Math.max(maxX, cb.maxX);
      minY = Math.min(minY, cb.minY);
      maxY = Math.max(maxY, cb.maxY);
    });
    return { minX, maxX, minY, maxY };
  }

  function renderConnections(node, ox, oy) {
    let html = '';
    node.children.forEach(child => {
      const x1 = node.x + node.width + ox;
      const y1 = node.y + oy;
      const x2 = child.x + ox;
      const y2 = child.y + oy;
      const cx = (x1 + x2) / 2;

      html += `<path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}"
        stroke="${child.color}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>`;
      html += renderConnections(child, ox, oy);
    });
    return html;
  }

  function renderNodes(node, ox, oy) {
    const x = node.x + ox;
    const y = node.y + oy;
    const w = node.width;
    const h = node.height;
    const r = 10;

    const isRoot = node.x === 0;
    const fontSize = isRoot ? 15 : 13;
    const displayText = node.text.length > 24 ? node.text.slice(0, 22) + '...' : node.text;

    let html = `
      <rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" rx="${r}" ry="${r}"
        fill="${node.color}" filter="url(#shadow)" opacity="0.9"/>
      <text x="${x + w / 2}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle"
        font-size="${fontSize}" font-family="'Nunito', sans-serif" font-weight="${isRoot ? '700' : '600'}" fill="#fff">
        ${escapeHtml(displayText)}
      </text>
    `;

    node.children.forEach(child => { html += renderNodes(child, ox, oy); });
    return html;
  }

  function setupPanZoom() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom *= e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.max(0.2, Math.min(3, zoom));
      updateSVGTransform();
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isPanning = true;
        panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
        wrapper.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      panOffset.x = e.clientX - panStart.x;
      panOffset.y = e.clientY - panStart.y;
      updateSVGTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      const wrapper = document.getElementById('canvas-wrapper');
      if (wrapper) wrapper.style.cursor = 'grab';
    });
  }

  function updateSVGTransform() {
    const svg = document.getElementById('mindmap-svg');
    if (svg) svg.style.transform = `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`;
  }

  function zoomIn() { zoom = Math.min(3, zoom * 1.2); updateSVGTransform(); }
  function zoomOut() { zoom = Math.max(0.2, zoom * 0.8); updateSVGTransform(); }
  function resetView() { zoom = 1; panOffset = { x: 0, y: 0 }; updateSVGTransform(); }

  function saveCurrentMap() {
    if (!currentMap) return;
    currentMap.title = document.getElementById('map-title')?.value || currentMap.title;
    currentMap.outline = document.getElementById('outline-editor')?.value || currentMap.outline;
    currentMap.root = parseOutline(currentMap.outline);
    Storage.saveMindMap(currentMap);
    showToast('Mind map saved!');
  }

  function renderViewer(mapId) {
    const map = Storage.getMindMap(mapId);
    if (!map) return;
    currentMap = map;
    zoom = 1;
    panOffset = { x: 0, y: 0 };

    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="mindmap-viewer">
        <div class="viewer-header">
          <button class="btn btn-back" onclick="MindMap.renderBuilder('${mapId}')">← Edit</button>
          <h2>${escapeHtml(map.title)}</h2>
          <div class="viewer-actions">
            <button class="btn btn-primary" onclick="MindMap.exportPNG()">Export PNG</button>
            <button class="btn btn-secondary" onclick="Books.renderBookDetail('${map.bookId}')">Back to Book</button>
          </div>
        </div>
        <div class="canvas-wrapper viewer-canvas" id="canvas-wrapper">
          <svg id="mindmap-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        </div>
      </div>
    `;

    setupPanZoom();
    if (map.root) renderSVG(map.root, document.getElementById('mindmap-svg'));
  }

  function exportPNG() {
    const svg = document.getElementById('mindmap-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);

      const a = document.createElement('a');
      a.download = `${currentMap?.title || 'mindmap'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function deleteMap(mapId) {
    if (!confirm('Delete this mind map?')) return;
    const map = Storage.getMindMap(mapId);
    Storage.deleteMindMap(mapId);
    if (map?.bookId) Books.renderBookDetail(map.bookId);
    else Books.renderDashboard();
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
  }

  function createNew() {
    const map = {
      id: Storage.generateId(),
      bookId: null,
      title: 'New Mind Map',
      created_at: new Date().toISOString(),
      outline: 'Central Topic\n\tBranch 1\n\t\tSub-topic\n\tBranch 2\n\tBranch 3',
      root: null
    };
    map.root = parseOutline(map.outline);
    Storage.saveMindMap(map);
    renderBuilder(map.id);
  }

  return {
    createFromBook, renderBuilder, renderViewer, saveCurrentMap,
    exportPNG, deleteMap, zoomIn, zoomOut, resetView, createNew, parseOutline
  };
})();

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
