(function () {
    const SUPABASE_URL = 'https://bnxxvbpjyuvjuqdjsxaw.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_7Es2Dkzgh3iKMuFGpiyFgw_RubTfAt_';
    const sb = (typeof supabase !== 'undefined')
        ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    const canvasHex = document.getElementById('hexCanvas');
    const canvasMarkers = document.getElementById('markerCanvas');
    const ctxHex = canvasHex.getContext('2d');
    const ctxMarkers = canvasMarkers.getContext('2d');

    // === UI Elements ===
    const modeToggle = document.getElementById('modeToggle');
    const tooltip = document.getElementById('markerTooltip');
    const editPanel = document.getElementById('editPanel');

    // Marker controls
    const markerIdInput = document.getElementById('markerId');
    const markerDetailsInput = document.getElementById('markerDetails');
    const markerShapeInput = document.getElementById('markerShape');
    const markerColorInput = document.getElementById('markerColor');
    const saveMarkerBtn = document.getElementById('saveMarker');
    const deleteMarkerBtn = document.getElementById('deleteMarker');
    const clearAllMarkersBtn = document.getElementById('clearAllMarkersBtn');

    // Grid controls
    const gridType = document.getElementById('gridType');
    const gridWidth = document.getElementById('gridWidth');
    const gridHeight = document.getElementById('gridHeight');
    const backgroundImageUpload = document.getElementById('backgroundImageUpload');
    const sceneWidth = document.getElementById('sceneWidth');
    const sceneHeight = document.getElementById('sceneHeight');
    const offsetBgHorizontal = document.getElementById('offsetBgHorizontal');
    const offsetBgVertical = document.getElementById('offsetBgVertical');
    const gridStyle = document.getElementById('gridStyle');
    const gridThickness = document.getElementById('gridThickness');
    const gridColorPicker = document.getElementById('gridColorPicker');
    const gridColorHex = document.getElementById('gridColorHex');
    const gridOpacitySlider = document.getElementById('gridOpacitySlider');
    const gridOpacityValue = document.getElementById('gridOpacityValue');
    const resetViewBtn = document.getElementById('resetView');
    const calibrateBtn = document.getElementById('calibrateGrid');
    const exportBtn = document.getElementById('exportMarkers');
    const importBtn = document.getElementById('importMarkers');
    const importExportArea = document.getElementById('importExportArea');
    const markerInfoPanel = document.getElementById('markerInfoPanel');
    const infoPanelContent = document.getElementById('infoPanelContent');
    const minimapCanvas = document.getElementById('minimapCanvas');
    const ctxMinimap = minimapCanvas.getContext('2d');

    // Viewport HUD overlay refs
    const vpHexReadout = document.getElementById('vpHexReadout');
    const vpZoomReadout = document.getElementById('vpZoomReadout');
    const vpEditModePill = document.getElementById('vpEditModePill');

    // Tab buttons
    const tabButtons = document.querySelectorAll('.edit-tab-btn');
    const tabContents = document.querySelectorAll('.edit-tab-content');

    let isEditMode = false;
    let isCalibrating = false;
    let calibrationPoints = [];
    let markers = [];
    let selectedMarker = null;
    let hoverMarker = null;
    let hoverHex = null;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let pendingMarker = null;
    let isDragging = false;
    let dragMarker = null;

    let minimapVisible = false;

    const state = {
        gridType: 'hexRowsOdd',
        gridWidth: 70,
        gridHeight: 70,
        gridStyle: 'solid',
        gridThickness: 1,
        gridColor: '#000000',
        gridOpacity: 0.1,
        zoom: 1,
        gridPan: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
        canvasSize: { w: 0, h: 0 },
    };

    // === GRID DRAWING FUNCTIONS ===

    function drawHexagon(ctx, x, y, radius) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i; // 60° increments for flat-top
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    function drawGridLine(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function drawPoint(ctx, x, y, size, style) {
        ctx.save();
        switch (style) {
            case 'squarePoints':
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
                break;
            case 'diamondPoints':
                ctx.beginPath();
                ctx.moveTo(x, y - size / 2);
                ctx.lineTo(x + size / 2, y);
                ctx.lineTo(x, y + size / 2);
                ctx.lineTo(x - size / 2, y);
                ctx.closePath();
                ctx.fill();
                break;
            case 'roundPoints':
            default:
                ctx.beginPath();
                ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
        ctx.restore();
    }

    function drawSquareGrid(ctx, canvasWidth, canvasHeight) {
        const startX = Math.floor(-state.gridPan.x / state.gridWidth) * state.gridWidth;
        const startY = Math.floor(-state.gridPan.y / state.gridHeight) * state.gridHeight;
        const endX = canvasWidth - (state.gridPan.x % state.gridWidth);
        const endY = canvasHeight - (state.gridPan.y % state.gridHeight);

        if (state.gridStyle === 'solid' || state.gridStyle === 'dashed' || state.gridStyle === 'dotted') {
            // Draw lines
            if (state.gridStyle === 'dashed') {
                ctx.setLineDash([5, 5]);
            } else if (state.gridStyle === 'dotted') {
                ctx.setLineDash([2, 4]);
            }

            for (let x = startX; x < endX + state.gridWidth; x += state.gridWidth) {
                drawGridLine(ctx, x, 0, x, canvasHeight);
            }
            for (let y = startY; y < endY + state.gridHeight; y += state.gridHeight) {
                drawGridLine(ctx, 0, y, canvasWidth, y);
            }

            ctx.setLineDash([]);
        } else {
            // Draw points
            const pointSize = 2;
            for (let x = startX; x < endX + state.gridWidth; x += state.gridWidth) {
                for (let y = startY; y < endY + state.gridHeight; y += state.gridHeight) {
                    drawPoint(ctx, x, y, pointSize, state.gridStyle);
                }
            }
        }
    }

    function drawHexagonalGrid(ctx, canvasWidth, canvasHeight) {
        const stepX = state.gridWidth;  // Horizontal spacing between hex centers
        const stepY = state.gridHeight; // Vertical spacing between hex centers
        const hexRadius = stepX / 1.5;  // Derive hex radius from horizontal spacing
        const hexHeight = Math.sqrt(3) * hexRadius;  // Actual visual height of hex

        const cols = Math.ceil(canvasWidth / stepX) + 2;
        const rows = Math.ceil(canvasHeight / stepY) + 2;

        const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
        const isOddOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexColsOdd';

        if (state.gridStyle === 'solid' || state.gridStyle === 'dashed' || state.gridStyle === 'dotted') {
            // Draw hex outlines
            if (state.gridStyle === 'dashed') {
                ctx.setLineDash([5, 5]);
            } else if (state.gridStyle === 'dotted') {
                ctx.setLineDash([2, 4]);
            }

            if (isRowOffset) {
                // Row-offset hexagons (odd-r or even-r)
                for (let col = -1; col < cols; col++) {
                    for (let row = -1; row < rows; row++) {
                        const x = col * stepX + (row % 2) * (stepX / 2) - state.gridPan.x;
                        const y = row * stepY - state.gridPan.y;
                        drawHexagon(ctx, x, y, hexRadius);
                        ctx.stroke();
                    }
                }
            } else {
                // Column-offset hexagons (odd-q or even-q)
                for (let col = -1; col < cols; col++) {
                    for (let row = -1; row < rows; row++) {
                        const x = col * stepX - state.gridPan.x;
                        const y = row * stepY + (col % 2) * (stepY / 2) - state.gridPan.y;
                        drawHexagon(ctx, x, y, hexRadius);
                        ctx.stroke();
                    }
                }
            }

            ctx.setLineDash([]);
        } else {
            // Draw hex center points
            const pointSize = 2;
            if (isRowOffset) {
                for (let col = -1; col < cols; col++) {
                    for (let row = -1; row < rows; row++) {
                        const x = col * stepX + (row % 2) * (stepX / 2) - state.gridPan.x;
                        const y = row * stepY - state.gridPan.y;
                        drawPoint(ctx, x, y, pointSize, state.gridStyle);
                    }
                }
            } else {
                for (let col = -1; col < cols; col++) {
                    for (let row = -1; row < rows; row++) {
                        const x = col * stepX - state.gridPan.x;
                        const y = row * stepY + (col % 2) * (stepY / 2) - state.gridPan.y;
                        drawPoint(ctx, x, y, pointSize, state.gridStyle);
                    }
                }
            }
        }
    }

    function drawHoverGlow(ctx) {
        if (!hoverHex || state.gridType === 'gridless') return;
        const stepX = state.gridWidth;
        const stepY = state.gridHeight;
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#b0b8c8';
        ctx.shadowBlur = 24;
        ctx.shadowColor = 'rgba(180, 190, 210, 0.9)';
        if (state.gridType.includes('hex')) {
            const hexRadius = stepX / 1.5;
            const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
            let hx, hy;
            if (isRowOffset) {
                hx = hoverHex.col * stepX + (hoverHex.row % 2) * (stepX / 2) - state.gridPan.x;
                hy = hoverHex.row * stepY - state.gridPan.y;
            } else {
                hx = hoverHex.col * stepX - state.gridPan.x;
                hy = hoverHex.row * stepY + (hoverHex.col % 2) * (stepY / 2) - state.gridPan.y;
            }
            drawHexagon(ctx, hx, hy, hexRadius);
        } else {
            const hx = hoverHex.col * stepX - state.gridPan.x;
            const hy = hoverHex.row * stepY - state.gridPan.y;
            ctx.beginPath();
            ctx.rect(hx - stepX / 2, hy - stepY / 2, stepX, stepY);
        }
        ctx.fill();
        ctx.restore();
    }

    function renderGrid() {
        ctxHex.setTransform(1, 0, 0, 1, 0, 0);
        ctxHex.clearRect(0, 0, state.canvasSize.w, state.canvasSize.h);

        if (state.gridType !== 'gridless') {
            ctxHex.strokeStyle = state.gridColor;
            ctxHex.fillStyle = state.gridColor;
            ctxHex.lineWidth = state.gridThickness;
            ctxHex.globalAlpha = state.gridOpacity;

            if (state.gridType === 'square') {
                drawSquareGrid(ctxHex, state.canvasSize.w, state.canvasSize.h);
            } else {
                drawHexagonalGrid(ctxHex, state.canvasSize.w, state.canvasSize.h);
            }

            ctxHex.globalAlpha = 1;
        }

        drawHoverGlow(ctxHex);
    }

    function updateImageTransform() {
        const img = document.getElementById('backgroundImg');
        // Lock image to grid: no scaling, just pan (grid doesn't scale either)
        img.style.transform = `translate(calc(-50% - ${state.gridPan.x}px), calc(-50% - ${state.gridPan.y}px))`;
    }

    function resizeCanvas() {
        const rect = document.getElementById('mapContainer').getBoundingClientRect();
        state.canvasSize.w = rect.width;
        state.canvasSize.h = rect.height;
        canvasHex.width = rect.width * devicePixelRatio;
        canvasHex.height = rect.height * devicePixelRatio;
        canvasMarkers.width = canvasHex.width;
        canvasMarkers.height = canvasHex.height;
        canvasHex.style.width = rect.width + 'px';
        canvasHex.style.height = rect.height + 'px';
        canvasMarkers.style.width = rect.width + 'px';
        canvasMarkers.style.height = rect.height + 'px';
        ctxHex.setTransform(1, 0, 0, 1, 0, 0);
        ctxMarkers.setTransform(1, 0, 0, 1, 0, 0);

        state.origin.x = rect.width / 2;
        state.origin.y = rect.height / 2;

        render();
    }

    function updateHover(e) {
        const rect = canvasMarkers.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const marker = getMarkerAt(x, y);
        if (marker) {
            hoverMarker = marker;
            tooltip.style.display = 'block';
            tooltip.textContent = marker.identifier || '(no label)';
            tooltip.style.left = `${e.clientX + 12}px`;
            tooltip.style.top = `${e.clientY + 12}px`;
        } else {
            hoverMarker = null;
            tooltip.style.display = 'none';
        }

        const newHex = (state.gridType !== 'gridless') ? getHexAt(x, y) : null;
        const changed = (!hoverHex !== !newHex) ||
            (newHex && hoverHex && (newHex.col !== hoverHex.col || newHex.row !== hoverHex.row));
        hoverHex = newHex;
        updateViewportHud({ hex: newHex });
        if (changed) renderGrid();
    }

    function getMarkerAt(x, y) {
        const stepX = state.gridWidth;
        const hexRadius = stepX / 1.5;

        // Ships render on top — check them first
        const allMarkers = pendingMarker ? [...markers, pendingMarker] : markers;
        for (const marker of allMarkers) {
            if (marker.shape !== 'ship') continue;
            let mx, my;
            if (state.gridType.includes('hex')) {
                const stepY = state.gridHeight;
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    mx = marker.col * stepX + (marker.row % 2) * (stepX / 2);
                    my = marker.row * stepY;
                } else {
                    mx = marker.col * stepX;
                    my = marker.row * stepY + (marker.col % 2) * (stepY / 2);
                }
            } else {
                mx = marker.col * stepX;
                my = marker.row * state.gridHeight;
            }
            mx -= state.gridPan.x;
            my -= state.gridPan.y;
            if (Math.hypot(x - mx, y - my) < hexRadius * 0.55) return marker;
        }

        // Regular markers
        const threshold = hexRadius * 0.8;
        for (const marker of markers) {
            if (marker.shape === 'ship') continue;
            let mx, my;
            if (state.gridType.includes('hex')) {
                const stepY = state.gridHeight;
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    mx = marker.col * stepX + (marker.row % 2) * (stepX / 2);
                    my = marker.row * stepY;
                } else {
                    mx = marker.col * stepX;
                    my = marker.row * stepY + (marker.col % 2) * (stepY / 2);
                }
            } else {
                mx = marker.col * state.gridWidth;
                my = marker.row * state.gridHeight;
            }
            mx -= state.gridPan.x;
            my -= state.gridPan.y;
            if (Math.hypot(x - mx, y - my) < threshold) return marker;
        }
        return null;
    }

    function getHexAt(x, y) {
        const stepX = state.gridWidth;
        const stepY = state.gridHeight;
        const screenX = x + state.gridPan.x;
        const screenY = y + state.gridPan.y;
        let col, row;
        if (state.gridType.includes('hex')) {
            const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
            if (isRowOffset) {
                row = Math.round(screenY / stepY);
                col = Math.round((screenX - (row % 2) * (stepX / 2)) / stepX);
            } else {
                col = Math.round(screenX / stepX);
                row = Math.round((screenY - (col % 2) * (stepY / 2)) / stepY);
            }
        } else {
            col = Math.round(screenX / stepX);
            row = Math.round(screenY / stepY);
        }
        return { col, row };
    }

    function drawMarker(marker) {
        const stepX = state.gridWidth;
        const stepY = state.gridHeight;
        const hexRadius = stepX / 1.5;
        const size = hexRadius * 0.7;

        let x, y;

        // --- Ship: snaps to grid cell like regular markers ---
        if (marker.shape === 'ship') {
            if (state.gridType.includes('hex')) {
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    x = marker.col * stepX + (marker.row % 2) * (stepX / 2);
                    y = marker.row * stepY;
                } else {
                    x = marker.col * stepX;
                    y = marker.row * stepY + (marker.col % 2) * (stepY / 2);
                }
            } else {
                x = marker.col * stepX;
                y = marker.row * stepY;
            }
            x -= state.gridPan.x;
            y -= state.gridPan.y;
            const sh = hexRadius * 0.42;   // nose-to-tail height
            const ww = hexRadius * 0.35;   // half wing-span (widest)
            ctxMarkers.save();
            ctxMarkers.translate(x, y);
            ctxMarkers.shadowBlur = 16;
            ctxMarkers.shadowColor = 'rgba(200,220,255,0.9)';
            ctxMarkers.fillStyle = marker.color;
            // Navigation-arrow silhouette with V-notch tail
            ctxMarkers.beginPath();
            ctxMarkers.moveTo(0,          -sh);          // nose
            ctxMarkers.lineTo(ww,          sh * 0.22);  // right wingtip
            ctxMarkers.lineTo(ww * 0.28,   sh);         // bottom-right tail corner
            ctxMarkers.lineTo(0,           sh * 0.44);  // V-notch centre
            ctxMarkers.lineTo(-ww * 0.28,  sh);         // bottom-left tail corner
            ctxMarkers.lineTo(-ww,         sh * 0.22);  // left wingtip
            ctxMarkers.closePath();
            ctxMarkers.fill();
            ctxMarkers.shadowBlur = 0;
            ctxMarkers.strokeStyle = 'rgba(255,255,255,0.65)';
            ctxMarkers.lineWidth = 1;
            ctxMarkers.stroke();
            if (marker === selectedMarker) {
                ctxMarkers.shadowBlur = 14;
                ctxMarkers.shadowColor = 'rgba(255,255,255,0.75)';
                ctxMarkers.strokeStyle = 'rgba(255,255,255,0.9)';
                ctxMarkers.lineWidth = 1.5;
                ctxMarkers.beginPath();
                ctxMarkers.arc(0, 0, hexRadius * 0.62, 0, Math.PI * 2);
                ctxMarkers.stroke();
                ctxMarkers.shadowBlur = 0;
            }
            ctxMarkers.restore();
            return;
        }

        // Regular marker: snap to grid cell
        if (state.gridType.includes('hex')) {
            const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
            if (isRowOffset) {
                x = marker.col * stepX + (marker.row % 2) * (stepX / 2);
                y = marker.row * stepY;
            } else {
                x = marker.col * stepX;
                y = marker.row * stepY + (marker.col % 2) * (stepY / 2);
            }
        } else {
            x = marker.col * state.gridWidth;
            y = marker.row * state.gridHeight;
        }

        x -= state.gridPan.x;
        y -= state.gridPan.y;

        ctxMarkers.save();
        ctxMarkers.translate(x, y);

        const drawPath = () => {
            switch (marker.shape) {
                case 'circle':
                    ctxMarkers.beginPath();
                    ctxMarkers.arc(0, 0, size * 0.54, 0, Math.PI * 2);
                    break;
                case 'square': {
                    const sq = size * 0.58;
                    const cr = sq * 0.3;
                    ctxMarkers.beginPath();
                    if (ctxMarkers.roundRect) {
                        ctxMarkers.roundRect(-sq, -sq, sq * 2, sq * 2, cr);
                    } else {
                        ctxMarkers.rect(-sq, -sq, sq * 2, sq * 2);
                    }
                    break;
                }
                case 'triangle': {
                    const th = size * 0.72;
                    ctxMarkers.beginPath();
                    ctxMarkers.moveTo(0, -th);
                    ctxMarkers.lineTo(th * 0.866, th * 0.5);
                    ctxMarkers.lineTo(-th * 0.866, th * 0.5);
                    ctxMarkers.closePath();
                    break;
                }
                case 'question': {
                    // Rendered as text — no geometry path
                    ctxMarkers.beginPath();
                    break;
                }
                case 'planet': {
                    // Circle body — ring drawn separately after fill passes
                    ctxMarkers.beginPath();
                    ctxMarkers.arc(0, 0, size * 0.48, 0, Math.PI * 2);
                    break;
                }
                case 'star':
                default: {
                    // 4-pointed compass star
                    const outerR = size * 0.72;
                    const innerR = outerR * 0.26;
                    ctxMarkers.beginPath();
                    for (let i = 0; i < 4; i++) {
                        const a1 = (Math.PI / 2) * i - Math.PI / 2;
                        const a2 = a1 + Math.PI / 4;
                        ctxMarkers.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
                        ctxMarkers.lineTo(Math.cos(a2) * innerR, Math.sin(a2) * innerR);
                    }
                    ctxMarkers.closePath();
                    break;
                }
            }
        };

        // 1 — coloured fill with a soft outer glow
        ctxMarkers.shadowBlur = 18;
        ctxMarkers.shadowColor = marker.color;
        ctxMarkers.fillStyle = marker.color;
        drawPath();
        ctxMarkers.fill();

        // 2 — turn off shadow, add subtle white rim
        ctxMarkers.shadowBlur = 0;
        ctxMarkers.strokeStyle = 'rgba(255,255,255,0.55)';
        ctxMarkers.lineWidth = 1.5;
        drawPath();
        ctxMarkers.stroke();

        // 3 — radial inner highlight (skip for question — rendered with text)
        if (marker.shape !== 'question') {
            const hl = ctxMarkers.createRadialGradient(-size * 0.16, -size * 0.16, 0, 0, 0, size * 0.72);
            hl.addColorStop(0, 'rgba(255,255,255,0.38)');
            hl.addColorStop(0.55, 'rgba(255,255,255,0)');
            ctxMarkers.fillStyle = hl;
            drawPath();
            ctxMarkers.fill();
            // Planet: draw elliptical ring on top
            if (marker.shape === 'planet') {
                const rx = size * 0.82;
                const ry = size * 0.28;
                const angle = -0.42; // ~24 deg tilt
                ctxMarkers.save();
                ctxMarkers.rotate(angle);
                // Behind-planet half (clipped away by clearing body)
                ctxMarkers.shadowBlur = 0;
                ctxMarkers.strokeStyle = 'rgba(255,255,255,0.70)';
                ctxMarkers.lineWidth = 1.8;
                ctxMarkers.beginPath();
                ctxMarkers.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2); // front arc
                ctxMarkers.stroke();
                // Behind arc — dimmer
                ctxMarkers.strokeStyle = 'rgba(255,255,255,0.25)';
                ctxMarkers.setLineDash([3, 3]);
                ctxMarkers.beginPath();
                ctxMarkers.ellipse(0, 0, rx, ry, 0, 0, Math.PI); // back arc
                ctxMarkers.stroke();
                ctxMarkers.setLineDash([]);
                ctxMarkers.restore();
            }
        } else {
            // Question mark — colored with glow, white rim
            const fs = size * 1.6;
            ctxMarkers.font = `bold ${fs}px serif`;
            ctxMarkers.textAlign = 'center';
            ctxMarkers.textBaseline = 'middle';
            ctxMarkers.shadowBlur = 18;
            ctxMarkers.shadowColor = marker.color;
            ctxMarkers.fillStyle = marker.color;
            ctxMarkers.fillText('?', 0, size * 0.05);
            ctxMarkers.shadowBlur = 0;
            ctxMarkers.strokeStyle = 'rgba(255,255,255,0.55)';
            ctxMarkers.lineWidth = 1.2;
            ctxMarkers.strokeText('?', 0, size * 0.05);
        }

        // 4 — selected: glowing white ring
        if (marker === selectedMarker) {
            ctxMarkers.shadowBlur = 18;
            ctxMarkers.shadowColor = 'rgba(255,255,255,0.75)';
            ctxMarkers.strokeStyle = 'rgba(255,255,255,0.92)';
            ctxMarkers.lineWidth = 2;
            ctxMarkers.beginPath();
            ctxMarkers.arc(0, 0, hexRadius * 0.88, 0, Math.PI * 2);
            ctxMarkers.stroke();
            ctxMarkers.shadowBlur = 0;
        }

        ctxMarkers.restore();
    }

    function renderMarkers() {
        ctxMarkers.setTransform(1, 0, 0, 1, 0, 0);
        ctxMarkers.clearRect(0, 0, state.canvasSize.w, state.canvasSize.h);

        // Non-ship markers first
        for (const marker of markers) {
            if (marker.shape !== 'ship') drawMarker(marker);
        }
        if (pendingMarker && pendingMarker.shape !== 'ship') {
            ctxMarkers.save();
            ctxMarkers.globalAlpha = 0.5;
            drawMarker(pendingMarker);
            ctxMarkers.restore();
        }

        // Ships render on top
        for (const marker of markers) {
            if (marker.shape === 'ship') drawMarker(marker);
        }
        if (pendingMarker && pendingMarker.shape === 'ship') {
            ctxMarkers.save();
            ctxMarkers.globalAlpha = 0.5;
            drawMarker(pendingMarker);
            ctxMarkers.restore();
        }
    }

    function renderMinimap() {
        if (!minimapVisible) return;
        const MW = minimapCanvas.width;
        const MH = minimapCanvas.height;
        ctxMinimap.clearRect(0, 0, MW, MH);
        ctxMinimap.fillStyle = 'rgba(10,12,16,0.95)';
        ctxMinimap.fillRect(0, 0, MW, MH);

        const imgEl = document.getElementById('backgroundImg');
        const imgW = parseInt(sceneWidth.value) || 6000;
        const imgH = parseInt(sceneHeight.value) || 4000;

        // Uniform scale to letterbox image inside minimap
        const scale = Math.min(MW / imgW, MH / imgH);
        const scaledW = imgW * scale;
        const scaledH = imgH * scale;
        const imgMX = (MW - scaledW) / 2;  // minimap pixel offset of image top-left
        const imgMY = (MH - scaledH) / 2;

        // Draw the background image
        try { ctxMinimap.drawImage(imgEl, imgMX, imgMY, scaledW, scaledH); } catch (e) {}

        // Dim it slightly so overlays read clearly
        ctxMinimap.fillStyle = 'rgba(0,0,0,0.25)';
        ctxMinimap.fillRect(imgMX, imgMY, scaledW, scaledH);

        // World coords: image is centered at (canvasSize.w/2, canvasSize.h/2)
        // Image top-left in world space:
        const imgWorldLeft = state.canvasSize.w / 2 - imgW / 2;
        const imgWorldTop  = state.canvasSize.h / 2 - imgH / 2;

        function worldToMinimap(wx, wy) {
            return [
                imgMX + (wx - imgWorldLeft) * scale,
                imgMY + (wy - imgWorldTop)  * scale
            ];
        }

        // Draw markers
        const stepX = state.gridWidth;
        const stepY = state.gridHeight;
        for (const m of markers) {
            let wx, wy;
            if (state.gridType.includes('hex')) {
                const isRow = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                wx = isRow ? m.col * stepX + (m.row % 2) * (stepX / 2) : m.col * stepX;
                wy = isRow ? m.row * stepY : m.row * stepY + (m.col % 2) * (stepY / 2);
            } else {
                wx = m.col * stepX;
                wy = m.row * stepY;
            }
            const [mx, my] = worldToMinimap(wx, wy);
            ctxMinimap.beginPath();
            ctxMinimap.arc(mx, my, m.shape === 'ship' ? 3.5 : 2.5, 0, Math.PI * 2);
            ctxMinimap.fillStyle = m.color;
            ctxMinimap.fill();
            ctxMinimap.strokeStyle = 'rgba(255,255,255,0.7)';
            ctxMinimap.lineWidth = 0.8;
            ctxMinimap.stroke();
        }

        // Draw viewport rectangle
        const [vpx, vpy] = worldToMinimap(state.gridPan.x, state.gridPan.y);
        const vpW = state.canvasSize.w * scale;
        const vpH = state.canvasSize.h * scale;
        ctxMinimap.fillStyle = 'rgba(255,255,255,0.07)';
        ctxMinimap.fillRect(vpx, vpy, vpW, vpH);
        ctxMinimap.strokeStyle = 'rgba(255,255,255,0.85)';
        ctxMinimap.lineWidth = 1.5;
        ctxMinimap.strokeRect(vpx, vpy, vpW, vpH);
        updateRadarShipMarker();
    }

    function updateRadarShipMarker() {
        const radarShip = document.getElementById('radarShip');
        if (!radarShip) return;
        if (!minimapVisible) {
            radarShip.style.display = 'none';
            return;
        }

        const ship = (selectedMarker && selectedMarker.shape === 'ship')
            ? selectedMarker
            : markers.find(m => m.shape === 'ship');

        if (!ship) {
            radarShip.style.display = 'none';
            return;
        }

        const MW = minimapCanvas.width;
        const MH = minimapCanvas.height;
        const imgW = parseInt(sceneWidth.value) || 6000;
        const imgH = parseInt(sceneHeight.value) || 4000;
        const scale = Math.min(MW / imgW, MH / imgH);
        const scaledW = imgW * scale;
        const scaledH = imgH * scale;
        const imgMX = (MW - scaledW) / 2;
        const imgMY = (MH - scaledH) / 2;
        const imgWorldLeft = state.canvasSize.w / 2 - imgW / 2;
        const imgWorldTop  = state.canvasSize.h / 2 - imgH / 2;

        const stepX = state.gridWidth;
        const stepY = state.gridHeight;
        let wx, wy;
        if (state.gridType.includes('hex')) {
            const isRow = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
            wx = isRow ? ship.col * stepX + (ship.row % 2) * (stepX / 2) : ship.col * stepX;
            wy = isRow ? ship.row * stepY : ship.row * stepY + (ship.col % 2) * (stepY / 2);
        } else {
            wx = ship.col * stepX;
            wy = ship.row * stepY;
        }

        const cx = imgMX + (wx - imgWorldLeft) * scale;
        const cy = imgMY + (wy - imgWorldTop)  * scale;

        const FRAME_SIZE = 220;
        const CANVAS_SIZE = 210;
        const offset = (FRAME_SIZE - CANVAS_SIZE) / 2;

        const wrapX = offset + cx;
        const wrapY = offset + cy;

        const centerX = FRAME_SIZE / 2;
        const centerY = FRAME_SIZE / 2;
        const radius = CANVAS_SIZE * 0.48;
        const dx = wrapX - centerX;
        const dy = wrapY - centerY;
        if (Math.hypot(dx, dy) > radius) {
            radarShip.style.display = 'none';
            return;
        }

        radarShip.style.display = 'block';
        radarShip.style.left = wrapX + 'px';
        radarShip.style.top = wrapY + 'px';
    }

    function minimapNavigate(clientX, clientY) {
        const rect = minimapCanvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        const MW = minimapCanvas.width;
        const MH = minimapCanvas.height;
        const imgW = parseInt(sceneWidth.value) || 6000;
        const imgH = parseInt(sceneHeight.value) || 4000;
        const scale = Math.min(MW / imgW, MH / imgH);
        const imgMX = (MW - imgW * scale) / 2;
        const imgMY = (MH - imgH * scale) / 2;
        const imgWorldLeft = state.canvasSize.w / 2 - imgW / 2;
        const imgWorldTop  = state.canvasSize.h / 2 - imgH / 2;
        const wx = imgWorldLeft + (mx - imgMX) / scale;
        const wy = imgWorldTop  + (my - imgMY) / scale;
        state.gridPan.x = wx - state.canvasSize.w / 2;
        state.gridPan.y = wy - state.canvasSize.h / 2;
        updateImageTransform();
        render();
        saveState();
    }

    function render() {
        renderGrid();
        renderMarkers();
        renderMinimap();
    }

    // === VIEWPORT HUD UPDATER ===
    function updateViewportHud(opts = {}) {
        if ('hex' in opts) {
            if (opts.hex) {
                vpHexReadout.textContent = `HEX ${opts.hex.col}.${opts.hex.row}`;
            } else {
                vpHexReadout.textContent = '';
            }
        }
        if ('zoom' in opts) {
            vpZoomReadout.textContent = `ZOOM ${opts.zoom.toFixed(2)}x`;
        }
        if ('editMode' in opts) {
            if (opts.editMode) {
                vpEditModePill.textContent = '● EDIT MODE';
                vpEditModePill.classList.add('edit-active');
            } else {
                vpEditModePill.textContent = '▶ VIEW MODE';
                vpEditModePill.classList.remove('edit-active');
            }
        }
    }

    function addOrSelectMarkerAt(x, y) {
        const existing = getMarkerAt(x, y);
        if (existing) {
            pendingMarker = null;
            openEditPanelFor(existing);
            render();
            return;
        }

        pendingMarker = null;

        const stepX = state.gridWidth;
        const stepY = state.gridHeight;
        const screenX = x + state.gridPan.x;
        const screenY = y + state.gridPan.y;
        const shape = markerShapeInput.value;

        let marker;
        if (shape === 'ship') {
            let col, row;
            if (state.gridType.includes('hex')) {
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    row = Math.round(screenY / stepY);
                    col = Math.round((screenX - (row % 2) * (stepX / 2)) / stepX);
                } else {
                    col = Math.round(screenX / stepX);
                    row = Math.round((screenY - (col % 2) * (stepY / 2)) / stepY);
                }
            } else {
                col = Math.round(screenX / stepX);
                row = Math.round(screenY / stepY);
            }
            marker = {
                col,
                row,
                color: '#ffffff',
                shape: 'ship',
                identifier: markerIdInput.value || '',
                details: markerDetailsInput.value || '',
            };
        } else {
            let col, row;
            if (state.gridType.includes('hex')) {
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    row = Math.round(screenY / stepY);
                    col = Math.round((screenX - (row % 2) * (stepX / 2)) / stepX);
                } else {
                    col = Math.round(screenX / stepX);
                    row = Math.round((screenY - (col % 2) * (stepY / 2)) / stepY);
                }
            } else {
                col = Math.round(screenX / stepX);
                row = Math.round(screenY / stepY);
            }
            marker = {
                col,
                row,
                color: markerColorInput.value,
                shape,
                identifier: markerIdInput.value || '',
                details: markerDetailsInput.value || '',
            };
        }
        pendingMarker = marker;
        openEditPanelFor(marker);
        render();
    }

    function updateColorSwatches(color) {
        const norm = color.toLowerCase();
        document.querySelectorAll('.color-swatch').forEach(sw => {
            sw.classList.toggle('active', sw.dataset.color.toLowerCase() === norm);
        });
    }

    function updateShapePicker(shape) {
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.shape === shape);
        });
    }

    function openEditPanelFor(marker) {
        selectedMarker = marker;
        if (!isEditMode) {
            editPanel.style.display = 'none';
            return;
        }

        editPanel.style.display = 'block';
        const markerFields = document.getElementById('markerFields');
        
        if (!marker) {
            markerFields.style.display = 'none';
            return;
        }

        markerFields.style.display = 'block';
        markerIdInput.value = marker.identifier || '';
        markerDetailsInput.value = marker.details || '';
        markerShapeInput.value = marker.shape;
        updateShapePicker(marker.shape);
        markerColorInput.value = marker.color || '#ff3b3b';
        updateColorSwatches(marker.color || '#ff3b3b');
        const colorSection = document.getElementById('markerColorSection');
        if (colorSection) colorSection.style.display = marker.shape === 'ship' ? 'none' : '';
    }

    function saveMarkerChanges() {
        if (!selectedMarker) return;
        selectedMarker.identifier = markerIdInput.value;
        selectedMarker.details = markerDetailsInput.value;
        selectedMarker.shape = markerShapeInput.value;
        if (selectedMarker.shape !== 'ship') {
            selectedMarker.color = markerColorInput.value;
        }
        if (selectedMarker === pendingMarker) {
            markers.push(pendingMarker);
            pendingMarker = null;
        }
        render();
        saveState();
    }

    function removeSelectedMarker() {
        if (!selectedMarker) return;
        if (selectedMarker === pendingMarker) {
            pendingMarker = null;
        } else {
            markers = markers.filter(m => m !== selectedMarker);
        }
        selectedMarker = null;
        openEditPanelFor(null);
        render();
    }

    function clearAllMarkers() {
        if (markers.length === 0) return;
        const overlay = document.getElementById('confirmDeleteOverlay');
        const input = document.getElementById('confirmDeleteInput');
        const error = document.getElementById('confirmDeleteError');
        const msg = document.getElementById('confirmDeleteMsg');
        input.value = '';
        error.textContent = '';
        msg.innerHTML = `This will permanently delete all <strong>${markers.length}</strong> marker(s) and cannot be undone.<br>Type <strong>DELETE</strong> to confirm.`;
        overlay.classList.add('visible');
        input.focus();
    }

    function submitConfirmDelete() {
        const input = document.getElementById('confirmDeleteInput');
        const error = document.getElementById('confirmDeleteError');
        if (input.value !== 'DELETE') {
            error.textContent = 'You must type DELETE in all caps.';
            input.value = '';
            input.focus();
            return;
        }
        document.getElementById('confirmDeleteOverlay').classList.remove('visible');
        markers = [];
        selectedMarker = null;
        openEditPanelFor(null);
        render();
        saveState();
    }

    // === HUD MODAL HELPERS (replace native alert/prompt/confirm) ===
    let _hudModalResolve = null;
    let _hudModalEscHandler = null;

    function _hideHudModal() {
        document.getElementById('hudModalOverlay').classList.remove('visible');
        if (_hudModalEscHandler) {
            document.removeEventListener('keydown', _hudModalEscHandler);
            _hudModalEscHandler = null;
        }
    }

    function _showHudModal({ title, message, mode, defaultValue, placeholder, confirmText, cancelText }) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('hudModalOverlay');
            const titleEl = document.getElementById('hudModalTitle');
            const msgEl = document.getElementById('hudModalMessage');
            const input = document.getElementById('hudModalInput');
            const error = document.getElementById('hudModalError');
            const okBtn = document.getElementById('hudModalConfirm');
            const cancelBtn = document.getElementById('hudModalCancel');

            titleEl.textContent = title || '';
            msgEl.textContent = message || '';
            msgEl.style.display = message ? 'block' : 'none';
            error.textContent = '';

            // Configure based on mode
            if (mode === 'prompt') {
                input.style.display = 'block';
                input.value = defaultValue || '';
                input.placeholder = placeholder || '';
                cancelBtn.style.display = 'block';
                okBtn.textContent = confirmText || 'OK';
                cancelBtn.textContent = cancelText || 'Cancel';
            } else if (mode === 'confirm') {
                input.style.display = 'none';
                cancelBtn.style.display = 'block';
                okBtn.textContent = confirmText || 'Confirm';
                cancelBtn.textContent = cancelText || 'Cancel';
            } else {
                // alert
                input.style.display = 'none';
                cancelBtn.style.display = 'none';
                okBtn.textContent = confirmText || 'OK';
            }

            _hudModalResolve = resolve;

            const onConfirm = () => {
                const value = mode === 'prompt' ? input.value : true;
                cleanup();
                resolve(mode === 'prompt' ? value : (mode === 'confirm' ? true : undefined));
            };
            const onCancel = () => {
                cleanup();
                resolve(mode === 'prompt' ? null : (mode === 'confirm' ? false : undefined));
            };
            const onKey = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
            };
            const onOverlayClick = (e) => {
                if (e.target === overlay) onCancel();
            };
            const cleanup = () => {
                okBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlayClick);
                document.removeEventListener('keydown', onKey);
                _hideHudModal();
            };

            okBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlayClick);
            document.addEventListener('keydown', onKey);
            _hudModalEscHandler = onKey;

            overlay.classList.add('visible');
            if (mode === 'prompt') {
                setTimeout(() => input.focus(), 0);
            } else {
                setTimeout(() => okBtn.focus(), 0);
            }
        });
    }

    function showHudAlert(title, message) {
        return _showHudModal({ title, message, mode: 'alert' });
    }
    function showHudConfirm(title, message, opts = {}) {
        return _showHudModal({ title, message, mode: 'confirm', ...opts });
    }
    function showHudPrompt(title, message, opts = {}) {
        return _showHudModal({ title, message, mode: 'prompt', ...opts });
    }

    function getMarkersAtCell(col, row) {
        return markers.filter(m => m.col === col && m.row === row);
    }

    function showHexInfo(cellMarkers, col, row) {
        infoPanelContent.innerHTML = '';

        // Coordinate header
        const coord = document.createElement('div');
        coord.className = 'hex-coord';
        coord.textContent = `HEX ${col}.${row}`;
        infoPanelContent.appendChild(coord);

        if (cellMarkers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-hex';
            empty.textContent = 'EMPTY HEX';
            infoPanelContent.appendChild(empty);
        } else {
            cellMarkers.forEach((marker) => {
                const entry = document.createElement('div');
                entry.className = 'marker-entry';

                const row = document.createElement('div');
                row.className = 'marker-row';

                const dot = document.createElement('div');
                dot.className = 'marker-dot';
                dot.style.backgroundColor = marker.color;
                dot.style.boxShadow = `0 0 6px ${marker.color}`;
                row.appendChild(dot);

                const name = document.createElement('span');
                name.className = 'marker-name';
                if (marker.identifier) {
                    name.textContent = marker.identifier;
                } else {
                    name.classList.add('empty');
                    name.textContent = 'No identifier';
                }
                row.appendChild(name);

                const shapeLabel = document.createElement('span');
                shapeLabel.className = 'marker-shape';
                shapeLabel.textContent = marker.shape;
                row.appendChild(shapeLabel);

                entry.appendChild(row);

                if (marker.details) {
                    const details = document.createElement('div');
                    details.className = 'marker-details';
                    details.textContent = marker.details;
                    entry.appendChild(details);
                }

                infoPanelContent.appendChild(entry);
            });
        }

        markerInfoPanel.style.display = 'block';
    }

    function showMarkerInfo(marker) {
        showHexInfo([marker], marker.col, marker.row);
    }

    function hideMarkerInfo() {
        markerInfoPanel.style.display = 'none';
    }

    function toggleMode() {
        if (!isEditMode) {
            // Show auth modal instead of prompt()
            const overlay = document.getElementById('authOverlay');
            const input = document.getElementById('authInput');
            const error = document.getElementById('authError');
            input.value = '';
            error.textContent = '';
            overlay.classList.add('visible');
            input.focus();
            return;
        }
        // Leaving edit mode — no auth needed
        isEditMode = false;
        updateViewportHud({ editMode: false });
        document.getElementById('modeToggleLabel').textContent = 'Switch to Edit Mode';
        editPanel.style.display = 'none';
        isCalibrating = false;
        pendingMarker = null;
        tooltip.style.display = 'none';
        render();
    }

    async function submitAuth() {
        const input = document.getElementById('authInput');
        const error = document.getElementById('authError');
        error.textContent = '';
        let storedHash = null;
        if (sb) {
            try {
                const { data, error: fetchErr } = await sb
                    .from('config').select('password_hash').eq('id', 1).single();
                if (!fetchErr && data && data.password_hash) {
                    storedHash = data.password_hash;
                    localStorage.setItem('hexMapPasswordHash', storedHash);
                }
            } catch (e) {
                console.warn('Failed to fetch password hash from Supabase:', e);
            }
        }
        if (!storedHash) {
            storedHash = localStorage.getItem('hexMapPasswordHash');
        }
        if (!storedHash) {
            error.textContent = 'Connection required for first-time setup.';
            input.value = '';
            input.focus();
            return;
        }
        const inputHash = await hashString(input.value);
        if (inputHash !== storedHash) {
            error.textContent = 'Incorrect code. Access denied.';
            input.value = '';
            input.focus();
            return;
        }
        document.getElementById('authOverlay').classList.remove('visible');
        isEditMode = true;
        updateViewportHud({ editMode: true });
        document.getElementById('modeToggleLabel').textContent = 'Switch to View Mode';
        editPanel.style.display = 'block';
        hideMarkerInfo();
        openEditPanelFor(selectedMarker);
        tooltip.style.display = 'none';
        render();
    }

    async function startCalibration() {
        if (!isEditMode) {
            await showHudAlert('Edit Mode Required', 'Enter Edit Mode first.');
            return;
        }
        isCalibrating = true;
        calibrationPoints = [];
        await showHudAlert('Calibration', 'Click 3 known grid positions and enter their col,row values when prompted.');
    }

    async function handleCalibrationClick(e) {
        const rect = canvasMarkers.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const idx = calibrationPoints.length + 1;
        const raw = await showHudPrompt(
            `Calibration Point ${idx}/3`,
            'Enter grid coordinates as col,row',
            { defaultValue: '0,0', placeholder: 'col,row' }
        );
        if (raw === null) return;
        const parts = raw.split(',').map(s => Number(s.trim()));
        if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
            await showHudAlert('Invalid Input', 'Please enter coordinates in the format: col,row');
            return;
        }
        calibrationPoints.push({ x, y, col: parts[0], row: parts[1] });
        if (calibrationPoints.length === 3) {
            finishCalibration();
        }
    }

    function finishCalibration() {
        // Simple average offset calibration
        let sumX = 0, sumY = 0;
        const stepX = state.gridWidth;
        const stepY = state.gridHeight;

        for (const pt of calibrationPoints) {
            let gridX, gridY;

            if (state.gridType.includes('hex')) {
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    gridX = pt.col * stepX + (pt.row % 2) * (stepX / 2);
                    gridY = pt.row * stepY;
                } else {
                    gridX = pt.col * stepX;
                    gridY = pt.row * stepY + (pt.col % 2) * (stepY / 2);
                }
            } else {
                gridX = pt.col * state.gridWidth;
                gridY = pt.row * state.gridHeight;
            }

            gridX *= 1; // No zoom scaling
            gridY *= 1; // No zoom scaling

            sumX += pt.x - state.origin.x - gridX;
            sumY += pt.y - state.origin.y - gridY;
        }

        state.gridPan.x = sumX / calibrationPoints.length;
        state.gridPan.y = sumY / calibrationPoints.length;
        isCalibrating = false;
        calibrationPoints = [];
        render();
        showHudAlert('Calibration', 'Calibration complete.');
    }

    function handlePointerDown(e) {
        if (e.button === 1) {
            // Middle mouse pan
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            canvasMarkers.style.cursor = 'grabbing';
            if (e.pointerId) canvasMarkers.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }

        if (e.button !== 0) return;

        if (isCalibrating) {
            handleCalibrationClick(e);
            return;
        }

        const rect = canvasMarkers.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!isEditMode) {
            const hex = getHexAt(x, y);
            if (hex) {
                const cellMarkers = getMarkersAtCell(hex.col, hex.row);
                showHexInfo(cellMarkers, hex.col, hex.row);
            } else {
                hideMarkerInfo();
            }
            return;
        }

        // In edit mode: ship markers are draggable
        const clicked = getMarkerAt(x, y);
        if (clicked && clicked.shape === 'ship') {
            isDragging = true;
            dragMarker = clicked;
            if (pendingMarker && pendingMarker !== clicked) pendingMarker = null;
            openEditPanelFor(clicked);
            render();
            canvasMarkers.style.cursor = 'grabbing';
            if (e.pointerId) canvasMarkers.setPointerCapture(e.pointerId);
            return;
        }

        addOrSelectMarkerAt(x, y);
    }

    function handlePointerMove(e) {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            panStart = { x: e.clientX, y: e.clientY };
            state.gridPan.x += dx;
            state.gridPan.y += dy;
            updateImageTransform();
            render();
            return;
        }

        if (isDragging && dragMarker) {
            const rect = canvasMarkers.getBoundingClientRect();
            const snapped = getHexAt(e.clientX - rect.left, e.clientY - rect.top);
            dragMarker.col = snapped.col;
            dragMarker.row = snapped.row;
            render();
            return;
        }

        updateHover(e);
    }

    function handlePointerUp(e) {
        if (isPanning) {
            isPanning = false;
            canvasMarkers.style.cursor = 'default';
            if (e.pointerId) canvasMarkers.releasePointerCapture(e.pointerId);
        }
        if (isDragging) {
            isDragging = false;
            dragMarker = null;
            canvasMarkers.style.cursor = 'default';
            if (e.pointerId) canvasMarkers.releasePointerCapture(e.pointerId);
            saveState();
        }
    }

    function handleWheel(e) {
        e.preventDefault();
        const rect = canvasMarkers.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.1 : 0.9;

        // Just update zoom without pan adjustment (grid/image don't scale anyway)
        state.zoom = Math.min(3, Math.max(0.25, state.zoom * factor));

        updateImageTransform();
        render();
        updateViewportHud({ zoom: state.zoom });
    }

    function updateBackgroundOffset() {
        const img = document.getElementById('backgroundImg');
        if (!img) return;
        const offsetX = Number(offsetBgHorizontal.value) || 0;
        const offsetY = Number(offsetBgVertical.value) || 0;
        img.style.marginLeft = offsetX + 'px';
        img.style.marginTop = offsetY + 'px';
        saveState();
    }

    function resetView() {
        state.zoom = 1;
        state.gridPan = { x: 0, y: 0 };
        updateImageTransform();
        render();
    }

    function exportMarkers() {
        const json = JSON.stringify(markers, null, 2);
        importExportArea.value = json;
        navigator.clipboard?.writeText(json).catch(() => {});
    }

    function importMarkers() {
        try {
            const parsed = JSON.parse(importExportArea.value);
            if (!Array.isArray(parsed)) throw new Error('Expected an array');
            markers = parsed.map(m => {
                return {
                    col: Number(m.col) || 0,
                    row: Number(m.row) || 0,
                    color: String(m.color || '#ff3b3b'),
                    shape: String(m.shape || 'star'),
                    identifier: String(m.identifier || m.text || ''),
                    details: String(m.details || ''),
                };
            });
            selectedMarker = null;
            openEditPanelFor(null);
            render();
        } catch (err) {
            showHudAlert('Import Failed', 'Invalid JSON.');
        }
    }

    async function hashString(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function loadFromSupabase() {
        if (!sb) throw new Error('No Supabase client');
        const [configRes, markersRes] = await Promise.all([
            sb.from('config').select('*').eq('id', 1).single(),
            sb.from('markers').select('*')
        ]);
        if (configRes.error) throw configRes.error;
        if (markersRes.error) throw markersRes.error;
        return { config: configRes.data, markers: markersRes.data };
    }

    async function syncToSupabase() {
        if (!sb) return;
        try {
            const { error: configErr } = await sb.from('config').upsert({
                id: 1,
                grid_type: state.gridType,
                grid_width: state.gridWidth,
                grid_height: state.gridHeight,
                grid_style: state.gridStyle,
                grid_thickness: state.gridThickness,
                grid_color: state.gridColor,
                grid_opacity: state.gridOpacity,
                zoom: state.zoom,
                grid_pan_x: state.gridPan.x,
                grid_pan_y: state.gridPan.y,
                scene_width: sceneWidth.value,
                scene_height: sceneHeight.value,
                offset_bg_horizontal: offsetBgHorizontal.value,
                offset_bg_vertical: offsetBgVertical.value,
            });
            if (configErr) throw configErr;
            const { error: delErr } = await sb.from('markers').delete().gt('id', 0);
            if (delErr) throw delErr;
            if (markers.length > 0) {
                const { error: insErr } = await sb.from('markers').insert(
                    markers.map(m => ({
                        col: m.col,
                        row: m.row,
                        color: m.color,
                        shape: m.shape,
                        identifier: m.identifier,
                        details: m.details,
                    }))
                );
                if (insErr) throw insErr;
            }
        } catch (e) {
            console.warn('Supabase sync failed:', e);
        }
    }

    function saveState() {
        try {
            const store = {
                markers,
                settings: {
                    gridType: state.gridType,
                    gridWidth: state.gridWidth,
                    gridHeight: state.gridHeight,
                    gridStyle: state.gridStyle,
                    gridThickness: state.gridThickness,
                    gridColor: state.gridColor,
                    gridOpacity: state.gridOpacity,
                    zoom: state.zoom,
                    gridPan: state.gridPan,
                    sceneWidth: sceneWidth.value,
                    sceneHeight: sceneHeight.value,
                    offsetBgHorizontal: offsetBgHorizontal.value,
                    offsetBgVertical: offsetBgVertical.value,
                },
            };
            localStorage.setItem('hexMapState', JSON.stringify(store));
        } catch (err) {}
        if (sb && isEditMode) syncToSupabase();
    }

    function loadState() {
        try {
            const saved = localStorage.getItem('hexMapState');
            if (!saved) return;
            const parsed = JSON.parse(saved);

            if (parsed.markers) {
                markers = parsed.markers.map(m => ({
                    col: Number(m.col) || 0,
                    row: Number(m.row) || 0,
                    color: String(m.color || '#ff3b3b'),
                    shape: String(m.shape || 'star'),
                    identifier: String(m.identifier || m.text || ''),
                    details: String(m.details || ''),
                }));
            }

            if (parsed.settings) {
                state.gridType = parsed.settings.gridType || state.gridType;
                state.gridWidth = parsed.settings.gridWidth || parsed.settings.gridSize || state.gridWidth;
                state.gridHeight = parsed.settings.gridHeight || parsed.settings.gridSize || state.gridHeight;
                state.gridStyle = parsed.settings.gridStyle || state.gridStyle;
                state.gridThickness = parsed.settings.gridThickness || state.gridThickness;
                state.gridColor = parsed.settings.gridColor || state.gridColor;
                state.gridOpacity = parsed.settings.gridOpacity || state.gridOpacity;
                state.zoom = parsed.settings.zoom || state.zoom;
                state.gridPan = parsed.settings.gridPan || state.gridPan;

                // Update UI
                gridType.value = state.gridType;
                gridWidth.value = state.gridWidth;
                gridHeight.value = state.gridHeight;
                gridStyle.value = state.gridStyle;
                gridThickness.value = state.gridThickness;
                gridColorPicker.value = state.gridColor;
                gridColorHex.value = state.gridColor;
                gridOpacitySlider.value = state.gridOpacity;
                gridOpacityValue.value = state.gridOpacity;
                
                // Restore background and scene settings
                if (parsed.settings.sceneWidth) sceneWidth.value = parsed.settings.sceneWidth;
                if (parsed.settings.sceneHeight) sceneHeight.value = parsed.settings.sceneHeight;
                if (parsed.settings.offsetBgHorizontal !== undefined) offsetBgHorizontal.value = parsed.settings.offsetBgHorizontal;
                if (parsed.settings.offsetBgVertical !== undefined) offsetBgVertical.value = parsed.settings.offsetBgVertical;
                
                // Apply background image dimensions and offsets
                const img = document.getElementById('backgroundImg');
                if (img) {
                    img.style.width = sceneWidth.value + 'px';
                    img.style.height = sceneHeight.value + 'px';
                    updateBackgroundOffset();
                }
            }

            updateImageTransform();
        } catch (err) {
            console.warn('Failed to load state', err);
        }
    }

    // === TAB SWITCHING ===
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });

    function showOfflineNotice() {
        const el = document.getElementById('vpOfflineNotice');
        if (!el) return;
        el.style.display = '';
        el.addEventListener('click', () => { el.style.display = 'none'; }, { once: true });
        setTimeout(() => { el.style.display = 'none'; }, 8000);
    }

    // === EVENT LISTENERS ===
    async function init() {
        window.addEventListener('resize', resizeCanvas);
        canvasMarkers.addEventListener('pointermove', handlePointerMove);
        canvasMarkers.addEventListener('pointerleave', () => {
            tooltip.style.display = 'none';
            hoverHex = null;
            hoverMarker = null;
            updateViewportHud({ hex: null });
            renderGrid();
            renderMarkers();
        });
        canvasMarkers.addEventListener('pointerdown', handlePointerDown);
        canvasMarkers.addEventListener('pointerup', handlePointerUp);
        canvasMarkers.addEventListener('wheel', handleWheel, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && isEditMode && selectedMarker) {
                removeSelectedMarker();
            }
        });

        // Shape picker buttons
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                markerShapeInput.value = btn.dataset.shape;
                updateShapePicker(btn.dataset.shape);
                const colorSection = document.getElementById('markerColorSection');
                if (colorSection) colorSection.style.display = btn.dataset.shape === 'ship' ? 'none' : '';
            });
        });
        updateShapePicker(markerShapeInput.value);

        // Color swatches
        document.querySelectorAll('.color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                markerColorInput.value = sw.dataset.color;
                updateColorSwatches(sw.dataset.color);
            });
        });
        updateColorSwatches(markerColorInput.value);

        // Hamburger menu open/close
        document.getElementById('menuToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('sideMenu').classList.toggle('open');
        });
        document.addEventListener('pointerdown', (e) => {
            const menu = document.getElementById('sideMenu');
            const toggle = document.getElementById('menuToggle');
            if (menu.classList.contains('open') && !menu.contains(e.target) && !toggle.contains(e.target)) {
                menu.classList.remove('open');
            }
        });

        // Mode toggle
        modeToggle.addEventListener('click', toggleMode);

        // Highlight Markers toggle (greyscale map, keep markers in color)
        let highlightMarkersOn = false;
        document.getElementById('highlightMarkersBtn').addEventListener('click', () => {
            highlightMarkersOn = !highlightMarkersOn;
            const filterVal = highlightMarkersOn ? 'grayscale(100%)' : '';
            document.getElementById('backgroundImg').style.filter = filterVal;
            canvasHex.style.filter = filterVal;
            document.getElementById('highlightMarkersBtn').classList.toggle('active', highlightMarkersOn);
        });

        // Center on Ship
        function centerOnShip() {
            const ship = (selectedMarker && selectedMarker.shape === 'ship')
                ? selectedMarker
                : markers.find(m => m.shape === 'ship');
            if (!ship) return;
            const stepX = state.gridWidth;
            const stepY = state.gridHeight;
            let wx, wy;
            if (state.gridType.includes('hex')) {
                const isRowOffset = state.gridType === 'hexRowsOdd' || state.gridType === 'hexRowsEven';
                if (isRowOffset) {
                    wx = ship.col * stepX + (ship.row % 2) * (stepX / 2);
                    wy = ship.row * stepY;
                } else {
                    wx = ship.col * stepX;
                    wy = ship.row * stepY + (ship.col % 2) * (stepY / 2);
                }
            } else {
                wx = ship.col * stepX;
                wy = ship.row * stepY;
            }
            state.gridPan.x = wx - state.canvasSize.w / 2;
            state.gridPan.y = wy - state.canvasSize.h / 2;
            updateImageTransform();
            render();
            saveState();
        }
        document.getElementById('centerOnShipBtn').addEventListener('click', centerOnShip);

        // Minimap toggle
        document.getElementById('toggleMinimapBtn').addEventListener('click', () => {
            minimapVisible = !minimapVisible;
            document.getElementById('minimapWrap').classList.toggle('visible', minimapVisible);
            document.getElementById('toggleMinimapBtn').classList.toggle('active', minimapVisible);
            if (minimapVisible) renderMinimap();
        });
        minimapCanvas.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            minimapCanvas.setPointerCapture(e.pointerId);
            minimapNavigate(e.clientX, e.clientY);
        });
        minimapCanvas.addEventListener('pointermove', (e) => {
            if (e.buttons !== 1) return;
            minimapNavigate(e.clientX, e.clientY);
        });

        document.getElementById('authSubmit').addEventListener('click', submitAuth);
        document.getElementById('authCancel').addEventListener('click', () => {
            document.getElementById('authOverlay').classList.remove('visible');
        });
        document.getElementById('authInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') submitAuth();
            if (e.key === 'Escape') document.getElementById('authOverlay').classList.remove('visible');
        });

        // Info panel close
        document.getElementById('closeInfoPanel').addEventListener('click', hideMarkerInfo);

        // Marker controls
        saveMarkerBtn.addEventListener('click', saveMarkerChanges);
        deleteMarkerBtn.addEventListener('click', removeSelectedMarker);
        clearAllMarkersBtn.addEventListener('click', clearAllMarkers);

        document.getElementById('confirmDeleteSubmit').addEventListener('click', submitConfirmDelete);
        document.getElementById('confirmDeleteCancel').addEventListener('click', () => {
            document.getElementById('confirmDeleteOverlay').classList.remove('visible');
        });
        document.getElementById('confirmDeleteInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') submitConfirmDelete();
            if (e.key === 'Escape') document.getElementById('confirmDeleteOverlay').classList.remove('visible');
        });

        // Grid type
        gridType.addEventListener('change', (e) => {
            state.gridType = e.target.value;
            render();
            saveState();
        });

        // Grid width
        gridWidth.addEventListener('change', (e) => {
            state.gridWidth = Number(e.target.value);
            render();
            saveState();
        });

        // Grid height
        gridHeight.addEventListener('change', (e) => {
            state.gridHeight = Number(e.target.value);
            render();
            saveState();
        });

        // Grid style
        gridStyle.addEventListener('change', (e) => {
            state.gridStyle = e.target.value;
            render();
            saveState();
        });

        // Grid thickness
        gridThickness.addEventListener('change', (e) => {
            state.gridThickness = Number(e.target.value);
            render();
            saveState();
        });

        // Grid color picker
        gridColorPicker.addEventListener('change', (e) => {
            state.gridColor = e.target.value;
            gridColorHex.value = state.gridColor;
            render();
            saveState();
        });

        // Grid color hex input
        gridColorHex.addEventListener('change', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                state.gridColor = e.target.value;
                gridColorPicker.value = state.gridColor;
                render();
                saveState();
            }
        });

        // Grid opacity slider
        gridOpacitySlider.addEventListener('input', (e) => {
            state.gridOpacity = Number(e.target.value);
            gridOpacityValue.value = state.gridOpacity;
            render();
        });

        // Grid opacity value input
        gridOpacityValue.addEventListener('change', (e) => {
            const val = Number(e.target.value);
            if (!isNaN(val) && val >= 0 && val <= 1) {
                state.gridOpacity = val;
                gridOpacitySlider.value = state.gridOpacity;
                render();
                saveState();
            }
        });

        // View controls
        resetViewBtn.addEventListener('click', resetView);
        calibrateBtn.addEventListener('click', startCalibration);

        // Import/Export
        exportBtn.addEventListener('click', exportMarkers);
        importBtn.addEventListener('click', importMarkers);

        // Background image upload
        backgroundImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.getElementById('backgroundImg');
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Scene dimensions (update CSS for canvas positioning)
        sceneWidth.addEventListener('change', () => {
            const img = document.getElementById('backgroundImg');
            if (img) img.style.width = sceneWidth.value + 'px';
            saveState();
        });
        sceneHeight.addEventListener('change', () => {
            const img = document.getElementById('backgroundImg');
            if (img) img.style.height = sceneHeight.value + 'px';
            saveState();
        });
        offsetBgHorizontal.addEventListener('change', updateBackgroundOffset);
        offsetBgVertical.addEventListener('change', updateBackgroundOffset);

        let offline = false;
        try {
            const remote = await loadFromSupabase();
            const store = {
                markers: remote.markers.map(m => ({
                    col: m.col, row: m.row, color: m.color,
                    shape: m.shape, identifier: m.identifier, details: m.details
                })),
                settings: {
                    gridType: remote.config.grid_type,
                    gridWidth: remote.config.grid_width,
                    gridHeight: remote.config.grid_height,
                    gridStyle: remote.config.grid_style,
                    gridThickness: remote.config.grid_thickness,
                    gridColor: remote.config.grid_color,
                    gridOpacity: remote.config.grid_opacity,
                    zoom: remote.config.zoom,
                    gridPan: { x: remote.config.grid_pan_x, y: remote.config.grid_pan_y },
                    sceneWidth: remote.config.scene_width,
                    sceneHeight: remote.config.scene_height,
                    offsetBgHorizontal: remote.config.offset_bg_horizontal,
                    offsetBgVertical: remote.config.offset_bg_vertical,
                }
            };
            localStorage.setItem('hexMapState', JSON.stringify(store));
        } catch (e) {
            console.warn('Supabase load failed, using localStorage:', e);
            offline = true;
        }
        loadState();
        window.addEventListener('beforeunload', saveState);
        resizeCanvas();
        updateViewportHud({ zoom: state.zoom, editMode: false });
        if (offline) showOfflineNotice();
    }

    init();
})();
