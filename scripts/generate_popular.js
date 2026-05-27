/**
 * Sinh 500 câu thành ngữ/tục ngữ quen thuộc, phổ biến
 * Chạy: node scripts/generate_popular.js
 * Output: ca_dao_popular.json
 */

import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Đọc tất cả câu đã có để tránh trùng
const existing1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../ca_dao_1000.json'), 'utf8'));
const extraPath = path.join(__dirname, '../ca_dao_extra.json');
const existing2 = fs.existsSync(extraPath) ? JSON.parse(fs.readFileSync(extraPath, 'utf8')) : [];
const existingTexts = new Set([...existing1, ...existing2].map(x => x.text?.trim().toLowerCase()));
console.log(`📚 Đã có ${existingTexts.size} câu, sẽ tránh trùng lặp.`);

const BATCHES = [
    { topic: "thành ngữ về sự chăm chỉ, cần cù, siêng năng, lao động", count: 35 },
    { topic: "tục ngữ về tình yêu thương, lòng nhân ái, giúp đỡ người khác", count: 35 },
    { topic: "thành ngữ về sự khôn ngoan, mưu trí, kinh nghiệm sống", count: 35 },
    { topic: "tục ngữ về gia đình, cha mẹ, con cái, anh em, vợ chồng", count: 35 },
    { topic: "thành ngữ về lòng kiên trì, nhẫn nại, vượt khó khăn", count: 35 },
    { topic: "tục ngữ về học hành, tri thức, thầy cô, sự học", count: 35 },
    { topic: "thành ngữ về tình bạn, nghĩa khí, đoàn kết, tương trợ", count: 35 },
    { topic: "tục ngữ về lời nói, cách ứng xử, giao tiếp, khéo léo", count: 35 },
    { topic: "thành ngữ về tiền bạc, giàu nghèo, vật chất, tham lam", count: 30 },
    { topic: "tục ngữ về thời gian, cơ hội, sự chần chừ, quyết đoán", count: 30 },
    { topic: "thành ngữ về đạo đức, nhân cách, lòng tốt, sự trung thực", count: 30 },
    { topic: "tục ngữ về sức khỏe, ăn uống, nghỉ ngơi, thân thể", count: 30 },
    { topic: "thành ngữ về quê hương, đất nước, lòng yêu nước, tự hào dân tộc", count: 30 },
    { topic: "tục ngữ về thiên nhiên, mùa vụ, thời tiết, nông nghiệp", count: 30 },
    { topic: "thành ngữ về số phận, may mắn, nỗ lực, tự lực cánh sinh", count: 25 },
];

const outputPath = path.join(__dirname, '../ca_dao_popular.json');
let allNew = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : [];
const doneTopics = allNew.length > 0 ? Math.floor(allNew.length / 33) : 0;
console.log(`📂 Tiếp tục: đã có ${allNew.length} câu mới\n`);

// Tính startId từ tất cả file đã có
const lastId = Math.max(
    ...existing1.map(x => parseInt(x.id) || 0),
    ...existing2.map(x => parseInt(x.id?.replace('extra-', '')) || 0),
    ...allNew.map(x => parseInt(x.id?.replace('popular-', '')) || 0),
    0
);

let currentId = lastId + 1 + allNew.length;
let totalGenerated = allNew.length;

for (let i = 0; i < BATCHES.length; i++) {
    const { topic, count } = BATCHES[i];
    console.log(`\n🎯 [${i+1}/${BATCHES.length}] Chủ đề: "${topic}" (${count} câu)...`);

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Bạn là chuyên gia văn học dân gian Việt Nam. Hãy liệt kê các câu thành ngữ và tục ngữ Việt Nam PHỔ BIẾN, QUEN THUỘC về chủ đề được yêu cầu.

                    Yêu cầu quan trọng:
                    - ƯU TIÊN các câu thành ngữ/tục ngữ QUEN THUỘC, được nhiều người biết đến
                    - Mỗi câu phải có nghĩa bóng rõ ràng, sâu sắc
                    - Giải thích nghĩa bóng đầy đủ, chính xác (3-5 câu)
                    - KHÔNG lấy ca dao tình yêu lãng mạn, chỉ lấy tục ngữ/thành ngữ có bài học
                    - KHÔNG trùng với các câu siêu phổ biến: "Ăn quả nhớ kẻ trồng cây", "Uống nước nhớ nguồn", "Có công mài sắt có ngày nên kim"

                    Trả về JSON:
                    {
                        "items": [
                            {"text": "Câu thành ngữ/tục ngữ", "meaning": "Giải thích nghĩa bóng đầy đủ 3-5 câu"}
                        ]
                    }`
                },
                {
                    role: "user",
                    content: `Liệt kê ${count} câu thành ngữ/tục ngữ Việt Nam phổ biến về chủ đề: "${topic}"`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });

        const result = JSON.parse(completion.choices[0]?.message?.content);
        const items = (result.items || []).filter(item => {
            if (!item.text || !item.meaning) return false;
            // Lọc trùng với dữ liệu đã có
            return !existingTexts.has(item.text.trim().toLowerCase());
        });

        const newItems = items.map((item, idx) => ({
            id: `popular-${currentId + idx}`,
            text: item.text.trim(),
            meaning: item.meaning.trim(),
        }));

        allNew.push(...newItems);
        currentId += newItems.length;
        totalGenerated += newItems.length;

        // Thêm vào set để tránh trùng trong các batch tiếp theo
        newItems.forEach(x => existingTexts.add(x.text.toLowerCase()));

        fs.writeFileSync(outputPath, JSON.stringify(allNew, null, 2), 'utf8');
        console.log(`✅ Sinh được ${newItems.length} câu. Tổng: ${totalGenerated}`);

        await sleep(2500);
    } catch (err) {
        console.error(`❌ Lỗi:`, err.message);
        if (err.message.includes("429")) {
            console.log("⏳ Rate limit, nghỉ 15 giây...");
            await sleep(15000);
            i--; // thử lại
        }
    }
}

console.log(`\n🎉 HOÀN TẤT! Tổng ${totalGenerated} câu mới.`);
console.log(`📁 File: ca_dao_popular.json`);
console.log(`\n👉 Chạy tiếp: node scripts/seed_popular.js`);
