/**
 * Script sinh thêm ca dao/tục ngữ bằng Groq LLM
 * Chạy: node scripts/generate_more.js
 * Output: ca_dao_extra.json (sẵn sàng để seed lên Pinecone)
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

// Các chủ đề để sinh đa dạng
const TOPICS = [
    "tình yêu đôi lứa, nhớ nhung, chia xa",
    "gia đình, cha mẹ, con cái, hiếu thảo",
    "lao động, chăm chỉ, siêng năng, tích lũy",
    "học hành, tri thức, thầy cô",
    "tình bạn, nghĩa khí, đoàn kết",
    "kinh nghiệm sống, khôn ngoan, thận trọng",
    "quê hương, đất nước, lòng yêu nước",
    "đạo đức, nhân cách, lòng tốt",
    "thời gian, cơ hội, không chần chừ",
    "khó khăn, vượt khó, kiên trì, bền bỉ",
    "tiền bạc, vật chất, tham lam",
    "lời nói, ứng xử, khéo léo",
    "thiên nhiên, mùa vụ, nông nghiệp",
    "sức khỏe, ăn uống, nghỉ ngơi",
    "may mắn, số phận, nỗ lực bản thân",
];

async function generateBatch(topic, startId, count = 30) {
    const prompt = `Hãy tạo ra ${count} câu ca dao hoặc tục ngữ Việt Nam về chủ đề: "${topic}".

Yêu cầu:
- Mỗi câu phải là ca dao/tục ngữ THỰC SỰ tồn tại trong văn học dân gian Việt Nam, hoặc rất gần với phong cách dân gian
- Mỗi câu phải có nghĩa bóng rõ ràng, không chỉ nghĩa đen
- KHÔNG lặp lại các câu quá phổ biến như "Ăn quả nhớ kẻ trồng cây", "Uống nước nhớ nguồn"
- Ưu tiên các câu ít phổ biến hơn nhưng vẫn có giá trị

Trả về JSON với cấu trúc:
{
  "items": [
    {
      "text": "Câu ca dao/tục ngữ",
      "meaning": "Giải thích nghĩa bóng rõ ràng, 2-4 câu"
    }
  ]
}`;

    const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content);
    const items = result.items || [];

    return items.map((item, i) => ({
        id: String(startId + i),
        text: item.text,
        meaning: item.meaning,
    }));
}

async function run() {
    // Đọc file gốc để biết ID cuối cùng
    const rawData = fs.readFileSync(path.join(__dirname, '../ca_dao_1000.json'), 'utf8');
    const existing = JSON.parse(rawData);
    const lastId = Math.max(...existing.map(x => parseInt(x.id) || 0));
    console.log(`📚 Hiện có ${existing.length} câu. ID cuối: ${lastId}`);

    // Kiểm tra file extra đã có chưa để tiếp tục
    const outputPath = path.join(__dirname, '../ca_dao_extra.json');
    let allNew = [];
    if (fs.existsSync(outputPath)) {
        allNew = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        console.log(`📂 Tiếp tục từ file cũ: đã có ${allNew.length} câu mới`);
    }

    let currentId = lastId + 1 + allNew.length;
    let totalGenerated = allNew.length;

    for (const topic of TOPICS) {
        console.log(`\n🎯 Đang sinh chủ đề: "${topic}"...`);
        try {
            const batch = await generateBatch(topic, currentId, 30);
            allNew.push(...batch);
            currentId += batch.length;
            totalGenerated += batch.length;

            // Lưu ngay sau mỗi batch để không mất dữ liệu
            fs.writeFileSync(outputPath, JSON.stringify(allNew, null, 2), 'utf8');
            console.log(`✅ Sinh được ${batch.length} câu. Tổng mới: ${totalGenerated}`);

            // Nghỉ 2 giây giữa các batch tránh rate limit
            await sleep(2000);
        } catch (err) {
            console.error(`❌ Lỗi chủ đề "${topic}":`, err.message);
            if (err.message.includes("429")) {
                console.log("⏳ Rate limit, nghỉ 10 giây...");
                await sleep(10000);
            }
        }
    }

    console.log(`\n🎉 HOÀN TẤT! Đã sinh ${totalGenerated} câu mới.`);
    console.log(`📁 File lưu tại: ca_dao_extra.json`);
    console.log(`\n👉 Bước tiếp theo: chạy "node scripts/seed_extra.js" để đẩy lên Pinecone`);
}

run();
