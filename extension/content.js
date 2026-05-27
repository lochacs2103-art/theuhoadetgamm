console.log("🚀 Dệt Gấm Thêu Hoa: Chế độ Nhuộm Đỏ");

// 1. Khởi tạo CSS & Tooltip
const style = document.createElement('style');
style.textContent = `
    .dg-red-hot {
        background-color: #d63031 !important;
        color: white !important;
        padding: 2px 4px !important;
        border-radius: 4px !important;
        cursor: help !important;
        font-weight: bold !important;
        display: inline !important;
        border-bottom: 2px solid #b2bec3 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
    }
    .dg-adj-highlight {
        background-color: #00b894 !important;
        color: white !important;
        padding: 2px 4px !important;
        border-radius: 4px !important;
        cursor: help !important;
        font-weight: bold !important;
        display: inline !important;
        border-bottom: 2px solid #55efc4 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
    }
    /* Tooltip dùng chung — đổi màu viền theo loại */
    .dg-tooltip {
        display: none; position: fixed; z-index: 2147483647;
        background: #1e272e; color: white; padding: 14px 16px;
        border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        max-width: 320px; pointer-events: none; font-size: 13px;
        line-height: 1.6; font-family: 'Segoe UI', sans-serif;
    }
    .dg-tooltip-section { margin-bottom: 10px; }
    .dg-tooltip-section:last-child { margin-bottom: 0; }
    .dg-tooltip-divider {
        border: none; border-top: 1px solid rgba(255,255,255,0.15);
        margin: 10px 0;
    }
    .dg-tooltip-label {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        opacity: 0.6; margin-bottom: 4px;
    }
`;
document.head.appendChild(style);

// Tooltip dùng chung cho cả đỏ và xanh
const tooltip = document.createElement("div");
tooltip.className = "dg-tooltip";
document.body.appendChild(tooltip);

// 2. Xử lý UI (Tooltip bám chuột)
document.addEventListener("mouseover", (e) => {
    // Hover vào chữ đỏ (thành ngữ) — hiện cả thành ngữ + tính từ kèm theo
    const redTarget = e.target.closest(".dg-red-hot");
    if (redTarget) {
        const adjectives = redTarget.dataset.adjectives
            ? JSON.parse(redTarget.dataset.adjectives)
            : [];

        let adjSection = "";
        if (adjectives.length > 0) {
            const adjRows = adjectives.map(adj => `
                <div style="margin-bottom: 6px;">
                    <span style="color:#55efc4; font-weight:bold;">🌿 ${adj.word}</span>
                    <span style="opacity:0.85;"> — ${adj.meaning}</span><br>
                    <span style="color:#81ecec; font-style:italic; font-size:12px;">🇬🇧 ${adj.english}</span>
                </div>
            `).join("");
            adjSection = `
                <hr class="dg-tooltip-divider">
                <div class="dg-tooltip-section">
                    <div class="dg-tooltip-label" style="color:#55efc4;">Tính từ trong đoạn văn</div>
                    ${adjRows}
                </div>
            `;
        }

        tooltip.innerHTML = `
            <div class="dg-tooltip-section">
                <div class="dg-tooltip-label" style="color:#ff7675;">💡 Thành ngữ / Tục ngữ</div>
                <div style="color:#ff7675; font-weight:bold; margin-bottom:4px;">${redTarget.dataset.idiom}</div>
                <div style="opacity:0.9;">${redTarget.dataset.meaning}</div>
            </div>
            ${adjSection}
        `;
        tooltip.style.borderLeft = "5px solid #ff7675";
        tooltip.style.display = "block";
    }

    // Hover vào chữ xanh (tính từ đứng độc lập) — chỉ hiện tính từ
    const adjTarget = e.target.closest(".dg-adj-highlight");
    if (adjTarget && !adjTarget.closest(".dg-red-hot")) {
        tooltip.innerHTML = `
            <div class="dg-tooltip-section">
                <div class="dg-tooltip-label" style="color:#55efc4;">🌿 Tính từ</div>
                <div style="color:#55efc4; font-weight:bold; margin-bottom:4px;">${adjTarget.dataset.word}</div>
                <div style="opacity:0.9; margin-bottom:6px;">📖 ${adjTarget.dataset.meaning}</div>
                <div style="color:#81ecec; font-style:italic;">🇬🇧 ${adjTarget.dataset.english}</div>
            </div>
        `;
        tooltip.style.borderLeft = "5px solid #00b894";
        tooltip.style.display = "block";
    }
});

document.addEventListener("mousemove", (e) => {
    if (tooltip.style.display === "block") {
        // Tránh tooltip bị tràn ra ngoài màn hình
        const x = e.clientX + 15;
        const y = e.clientY + 15;
        tooltip.style.left = (x + 320 > window.innerWidth ? e.clientX - 335 : x) + "px";
        tooltip.style.top = (y + 200 > window.innerHeight ? e.clientY - 220 : y) + "px";
    }
});

document.addEventListener("mouseout", (e) => {
    if (e.target.closest(".dg-red-hot") || e.target.closest(".dg-adj-highlight")) {
        tooltip.style.display = "none";
    }
});

// --- 2. QUẢN LÝ CÀI ĐẶT VÀ LƯU TRỮ ---
let appSettings = { isOn: true, freq: 2 };
let foundIdiomsLog = [];
let foundAdjectivesLog = [];

chrome.storage.sync.get(['dgEnabled', 'freqSetting'], (res) => {
    if (res.dgEnabled !== undefined) appSettings.isOn = res.dgEnabled;
    if (res.freqSetting !== undefined) appSettings.freq = res.freqSetting;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.dgEnabled) appSettings.isOn = changes.dgEnabled.newValue;
        if (changes.freqSetting) appSettings.freq = changes.freqSetting.newValue;
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "getFoundIdioms") {
        sendResponse({ idioms: foundIdiomsLog, adjectives: foundAdjectivesLog });
    }
});

// --- 3. QUẢN LÝ HÀNG ĐỢI ---
let requestQueue = [];
let isProcessing = false;

async function processQueue() {
    if (!appSettings.isOn) { requestQueue = []; isProcessing = false; return; }
    if (isProcessing || requestQueue.length === 0) return;
    isProcessing = true;

    while (requestQueue.length > 0) {
        if (!appSettings.isOn) break;
        const { el, text } = requestQueue.shift();

        await new Promise(resolve => {
            chrome.runtime.sendMessage(
                { action: "scanText", text: text, frequency: appSettings.freq },
                (res) => {
                    if (res && res.matchFound) {
                        console.log(`🎯 Khớp: "${res.idiom}" | Cụm: "${res.focusPhrase}"`);
                        const adjectives = res.adjectives || [];

                        foundIdiomsLog.push({
                            idiom: res.idiom,
                            meaning: res.meaning,
                            phrase: res.focusPhrase,
                            adjectives
                        });

                        // Tô xanh TRƯỚC (để đỏ không đè lên xanh)
                        const usedWords = [];
                        if (adjectives.length > 0) {
                            adjectives.forEach(adj => {
                                // Bỏ qua tính từ nằm trong focusPhrase (tránh trùng màu)
                                if (res.focusPhrase && res.focusPhrase.includes(adj.word)) return;
                                const alreadyLogged = foundAdjectivesLog.some(a => a.word === adj.word);
                                if (!alreadyLogged) foundAdjectivesLog.push(adj);
                                const applied = applyAdjectiveHighlight(el, adj);
                                if (applied) usedWords.push(adj.word);
                            });
                        }

                        // Tô đỏ SAU, đính kèm danh sách tính từ vào data attribute
                        applyFocusRed(el, res.idiom, res.meaning, res.focusPhrase, adjectives);
                    }
                    resolve();
                }
            );
        });

        await new Promise(r => setTimeout(r, 7000));
    }
    isProcessing = false;
}

// 4. LOGIC QUÉT VĂN BẢN
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            if (el.innerText.trim().length > 50 && !el.dataset.scanned && appSettings.isOn) {
                el.dataset.scanned = 'true';
                requestQueue.push({ el, text: el.innerText.trim() });
                processQueue();
            }
        }
    });
}, { threshold: 0.1 });

setTimeout(() => {
    document.querySelectorAll('p, h2, h3, h4, li, blockquote, td, figcaption').forEach(el => observer.observe(el));
}, 1500);

// 5. HÀM NHUỘM ĐỎ — nhận thêm adjectives để đính vào data attribute
function applyFocusRed(element, idiom, meaning, focusPhrase, adjectives = []) {
    const originalHTML = element.innerHTML;
    let targetText = "";

    if (focusPhrase && focusPhrase.length > 0 && originalHTML.includes(focusPhrase)) {
        targetText = focusPhrase;
    } else {
        const textOnWeb = element.innerText;
        const sentences = textOnWeb.split(/([.!?\n])/g).filter(s => s.trim().length > 10);
        targetText = sentences.length > 0 ? sentences[0].trim() : textOnWeb.substring(0, 30).trim();
    }

    // Encode adjectives thành JSON để lưu vào data attribute
    const adjJson = JSON.stringify(adjectives).replace(/"/g, '&quot;');

    if (targetText && originalHTML.includes(targetText)) {
        const redSpan = `<span class="dg-red-hot"
            data-idiom="${idiom.replace(/"/g, '&quot;')}"
            data-meaning="${meaning.replace(/"/g, '&quot;')}"
            data-adjectives="${adjJson}">${targetText}</span>`;
        element.innerHTML = originalHTML.replace(targetText, redSpan);
    } else {
        element.classList.add("dg-red-hot");
        element.dataset.idiom = idiom;
        element.dataset.meaning = meaning;
        element.dataset.adjectives = JSON.stringify(adjectives);
    }
}

// 6. HÀM TÔ XANH LÁ — trả về true nếu tô thành công
function applyAdjectiveHighlight(element, adj) {
    const { word, meaning, english } = adj;

    const plainText = element.innerText || element.textContent || "";
    if (!plainText.includes(word)) return false;

    let currentHTML = element.innerHTML;
    if (currentHTML.includes(`data-word="${word.replace(/"/g, '&quot;')}"`)) return false;

    const idx = currentHTML.indexOf(word);
    if (idx === -1) return false;

    // Kiểm tra không nằm trong thẻ HTML
    const before = currentHTML.substring(0, idx);
    const openTags = (before.match(/</g) || []).length;
    const closeTags = (before.match(/>/g) || []).length;
    if (openTags !== closeTags) return false;

    const greenSpan = `<span class="dg-adj-highlight"
        data-word="${word.replace(/"/g, '&quot;')}"
        data-meaning="${meaning.replace(/"/g, '&quot;')}"
        data-english="${english.replace(/"/g, '&quot;')}">${word}</span>`;
    element.innerHTML = currentHTML.substring(0, idx) + greenSpan + currentHTML.substring(idx + word.length);
    return true;
}
