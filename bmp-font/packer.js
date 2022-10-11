let canvas = document.getElementById('view');
let ctx = canvas.getContext('2d');
canvas.width = 512;
canvas.height = 512;

let chars = [];
let spaces = [];

function generateChar(char, font, grow, smooth) {
    grow = grow || 1;
    
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    
    ctx.font = font;
    ctx.textAlign = 'left';
    
    const mt = ctx.measureText(char);
    const w = mt.width + 24;
    const h = (mt.fontBoundingBoxAscent ?
        mt.fontBoundingBoxAscent + mt.fontBoundingBoxDescent :
        mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent) + 24;
    
    canvas.width = Math.floor(w);
    canvas.height = Math.floor(h);

    if (canvas.width * canvas.height <= 0) {
        return null;
    }
    
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = smooth || false;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.fillText(char, 12, 12);

    let data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    function loop(count, callback, reverse) {
        const fromV = reverse ? count - 1 : 0;
        const step = reverse ? -1 : 1;
        for (let i = fromV; (reverse ? (i >= 0) : (i < count)); i += step) {
            if (callback(i)) break;
        }
    }

    function searchX(reverse) {
        let found = -1;
        loop(canvas.width, (x) => {
            loop(canvas.height, (y) => {
                if (data[(x + y * canvas.width) * 4] > 0) {
                    found = x;
                    return true;
                }
                return false;
            });
            return (found >= 0);
        }, reverse);
        return found;
    }

    function searchY(reverse) {
        let found = -1;
        loop(canvas.height, (y) => {
            loop(canvas.width, (x) => {
                if (data[(x + y * canvas.width) * 4] > 0) {
                    found = y;
                    return true;
                }
                return false;
            });
            return (found >= 0);
        }, reverse);
        return found;
    }

    let top = searchY(false) - grow;
    let bottom = searchY(true) + grow * 2;
    let left = searchX(false) - grow;
    let right = searchX(true) + grow * 2;

    let cropCanvas = document.createElement('canvas');
    let cropCtx = cropCanvas.getContext('2d');
    cropCanvas.width = Math.floor(right - left);
    cropCanvas.height = Math.floor(bottom - top);
    cropCtx.imageSmoothingEnabled = smooth || false;

    cropCtx.drawImage(canvas, left, top, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);

    cropCanvas.character = char;
    cropCanvas.advanceX = mt.actualBoundingBoxRight;
    cropCanvas.advanceY = mt.actualBoundingBoxDescent;

    return cropCanvas;
}

function createRect(img, mono) {
    let rec = { x: 0, y: 0, w: !mono ? img.width : img.monoWidth, h: img.height, img: img };

    for (let i = spaces.length - 1; i >= 0; i--) {
        const space = spaces[i];
        if (rec.w > space.w || rec.h > space.h) continue;

        rec.x = space.x;
        rec.y = space.y;

        chars.push(rec);

        if (rec.w === space.w && rec.h === space.h) {
            const last = spaces.pop();
            if (i < spaces.length) spaces[i] = last;
        } else if (rec.w === space.w) {
            space.y += rec.h;
            space.h -= rec.h;
        } else if (rec.h === space.h) {
            space.x += rec.w;
            space.w -= rec.w;
        } else {
            // divide
            createSpace(space.x + rec.w, space.y, space.w - rec.w, rec.h);
            space.y += rec.h;
            space.h -= rec.h;
        }

        break;
    }
}

function createSpace(x, y, w, h) {
    spaces.push({ x: x, y: y, w: w, h: h });
}

function fit(srcWidth, srcHeight, maxWidth, maxHeight) {
    var ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return { w: srcWidth * ratio, h: srcHeight * ratio };
}

function redraw(mono) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r of chars) {
        let x = r.x, y = r.y;
        let w = r.img.width, h = r.img.height;
        if (mono) {
            let sz = fit(r.img.width, r.img.height, r.img.monoWidth, r.img.height);
            x = r.x + (r.img.monoWidth / 2 - sz.w / 2);
        }
        ctx.drawImage(r.img, x, y, w, h);
    }

    // draw visualizations
    for (let r of chars) {
        let char = r.img;
        ctx.strokeStyle = 'cyan';
        ctx.beginPath();
        ctx.rect(r.x, r.y, char.advanceX, r.h);
        ctx.stroke();

        ctx.strokeStyle = 'magenta';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + (r.h - char.advanceY));
        ctx.lineTo(r.x + r.w, r.y + (r.h - char.advanceY));
        ctx.stroke();
    }

    ctx.strokeStyle = 'yellow';
    for (let r of chars) {
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.stroke();
    }
}

ctx.font = '36px user_font';

function generateFont(charsetGenerator, grow, mono, smooth) {
    spaces = [];
    chars = [];

    createSpace(0, 0, canvas.width, Infinity);

    let alpha = charsetGenerator();
    let genrects = [];
    for (let i = 0; i < alpha.length; i++) {
        const ms = generateChar(alpha[i], ctx.font, grow, smooth);
        if (ms === null) continue;
        if (ms.width * ms.height <= 0) continue;
        genrects.push(ms);
    }

    if (mono) {
        let maxW = 0;
        for (let ms of genrects) {
            maxW = Math.max(maxW, ms.width);
        }

        for (let ms of genrects) {
            ms.monoWidth = maxW;
            ms.advanceX = maxW;
        }
    }
    
    // sort by h
    genrects.sort((a, b) => b.height - a.height);

    for (let rc of genrects) {
        createRect(rc, mono);
    }

    redraw(mono);
}

function dom(id) {
    return document.getElementById(id);
}

async function updatePreview() {
    const fFile = dom('fFile').files[0];
    if (fFile) {
        const data = await fFile.arrayBuffer();
        loadedFont = new FontFace('user_font', data);
        await loadedFont.load();
        document.fonts.add(loadedFont);
        dom('fPreview').style.font = '40px user_font';
    } else {
        dom('fPreview').style.font = '40px serif';
    }
}

let loadedFont;
async function regenerate() {
    await updatePreview();

    const fSize = dom('fSize').value;
    const fMargin = parseInt(dom('fMargin').value);
    const fWidth = parseInt(dom('fWidth').value);
    const fHeight = parseInt(dom('fHeight').value);
    const fMonospaced = dom('fMonospaced').checked;
    const fSmooth = dom('fSmooth').checked;

    canvas.width = fWidth;
    canvas.height = fHeight;
    ctx.font = fSize + 'px user_font';

    ctx.imageSmoothingEnabled = fSmooth;

    generateFont(asciiGenerator, fMargin, fMonospaced, fSmooth);
}

function generateJSONInfo() {
    const jsonInfo = [];
    for (let rec of chars) {
        jsonInfo.push({
            char: rec.img.character,
            charCode: rec.img.character.charCodeAt(0),
            advance: rec.img.advanceX,
            descent: rec.img.advanceY,
            bounds: [ rec.x, rec.y, rec.w, rec.h ],
            boundsNormalized: [ rec.x / canvas.width, rec.y / canvas.height, rec.w / canvas.width, rec.h / canvas.height ],
        })
    }
    return jsonInfo;
}

function download() {
    { // Download Image
        const dl = document.createElement('a');
        dl.setAttribute('download', 'bitmap-font.png');

        const durl = canvas.toDataURL('image/png');
        let url = durl.replace(/^data:image\/png/, 'data:application/octet-stream');
        dl.href = url;
        dl.click();
    }

    { // Download JSON information
        const jsonInfo = generateJSONInfo();

        const dl = document.createElement('a');
        dl.setAttribute('download', 'bitmap-font-data.json');

        const data = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(jsonInfo));
        dl.href = data;
        dl.click();
    }
}

function asciiGenerator() {
    return `!"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ`
        .split('');
}

regenerate();
