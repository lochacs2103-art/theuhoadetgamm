const SERVER_URL = "https://api-detgamtheuhoa.onrender.com";

function wakeUpServer() {
    fetch(`${SERVER_URL}/`)
        .then(res => console.log("🌅 Server Render đang thức! Status:", res.status))
        .catch(err => console.log("😴 Server đang ngủ hoặc lỗi mạng:", err.message));
}

chrome.runtime.onStartup.addListener(wakeUpServer);
chrome.runtime.onInstalled.addListener(() => {
    wakeUpServer();
    chrome.alarms.create("keepAwake", { periodInMinutes: 14 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAwake") wakeUpServer();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanText") {
        console.log("📥 Background nhận lệnh quét:", request.text.substring(0, 30));

        fetch(`${SERVER_URL}/api/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                text: request.text, 
                frequency: request.frequency 
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log("🎁 Dữ liệu AI trả về:", data); 
            sendResponse(data); 
        })
        .catch(error => {
            console.error("❌ Lỗi Background Fetch:", error);
            sendResponse({ error: true, message: error.message });
        });

        return true; 
    }
});
