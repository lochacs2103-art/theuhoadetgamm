const slider = document.getElementById('freqSlider');
const label = document.getElementById('freqLabel');
const toggleBtn = document.getElementById('toggleBtn');
const idiomList = document.getElementById('idiomList');
const labels = ["Ít (Khắt khe)", "Vừa phải", "Nhiều (Thoải mái)"];

// 1. Khi mở popup lên, load cài đặt đã lưu
chrome.storage.sync.get(['freqSetting', 'dgEnabled'], (result) => {
    const savedFreq = result.freqSetting || 2;
    slider.value = savedFreq;
    label.innerText = labels[savedFreq - 1];
    updateColor(savedFreq);
    toggleBtn.checked = result.dgEnabled !== false;
});

// 2. Sự kiện thanh trượt
slider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    label.innerText = labels[val - 1];
    updateColor(val);
    chrome.storage.sync.set({ freqSetting: val });
});

// 3. Sự kiện bật/tắt
toggleBtn.addEventListener('change', (e) => {
    const isTurnedOn = e.target.checked;
    chrome.storage.sync.set({ dgEnabled: isTurnedOn });
    if (isTurnedOn) {
        fetch("https://api-detgamtheuhoa.onrender.com/")
            .then(() => console.log("🌅 Server local sẵn sàng!"))
            .catch(err => console.log("Lỗi gọi server:", err));
    }
});

function updateColor(val) {
    if (val === 1) label.style.color = "#00b894";
    if (val === 2) label.style.color = "#fdcb6e";
    if (val === 3) label.style.color = "#e17055";
}

// 4. Lấy dữ liệu từ content.js và render danh sách
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length === 0) return;
    
    // Kiểm tra tab có hợp lệ không (không phải chrome://, about://, etc.)
    const tab = tabs[0];
    if (!tab.url || !tab.url.startsWith('http')) {
        idiomList.innerHTML = '<li class="empty-msg">Không hỗ trợ trang này</li>';
        return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "getFoundIdioms" }, function (response) {
        // Bắt lỗi connection (content.js chưa inject)
        if (chrome.runtime.lastError) {
            idiomList.innerHTML = '<li class="empty-msg">Đang tải trang, thử lại sau...</li>';
            return;
        }
        if (!response || !response.idioms) return;

        if (response.idioms.length > 0) {
            idiomList.innerHTML = "";
            response.idioms.forEach(item => {
                const li = document.createElement("li");

                // Phần tính từ đi kèm (nếu có)
                let adjHTML = "";
                if (item.adjectives && item.adjectives.length > 0) {
                    const tags = item.adjectives.map(adj =>
                        `<span class="adj-tag" title="${adj.meaning} | ${adj.english}">🌿 ${adj.word}</span>`
                    ).join("");
                    adjHTML = `<div class="adj-row">${tags}</div>`;
                }

                li.innerHTML = `
                    <strong>${item.idiom}</strong>
                    <span class="phrase-text">"${item.phrase}"</span>
                    ${adjHTML}
                `;
                idiomList.appendChild(li);
            });
        }
    });
});
