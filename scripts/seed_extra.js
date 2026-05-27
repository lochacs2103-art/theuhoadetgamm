/**
 * Script seed file ca_dao_extra.json lên Pinecone
 * Chạy: node scripts/seed_extra.js
 */

import { InferenceClient } from "@huggingface/inference";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const hf = new InferenceClient(process.env.HF_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index("det-gam-theu-hoa-v2");

const extraPath = path.join(__dirname, '../ca_dao_extra.json');
if (!fs.existsSync(extraPath)) {
    console.error("❌ Chưa có file ca_dao_extra.json. Chạy generate_more.js trước!");
    process.exit(1);
}

const dataSet = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// File checkpoint để tiếp tục nếu bị ngắt giữa chừng
const checkpointPath = path.join(__dirname, '../seed_extra_checkpoint.json');
let startFrom = 0;
if (fs.existsSync(checkpointPath)) {
    startFrom = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')).lastIndex || 0;
    console.log(`🔄 Tiếp tục từ câu số ${startFrom}...`);
}

async function runSeed() {
    console.log(`⏳ Bắt đầu seed ${dataSet.length} câu mới lên Pinecone...`);
    console.log(`📌 Index: det-gam-theu-hoa-v2\n`);

    let vectorsBatch = [];
    const BATCH_SIZE = 50;

    for (let i = startFrom; i < dataSet.length; i++) {
        const item = dataSet[i];

        if (!item?.text || !item?.meaning) {
            console.log(`⚠️ Bỏ qua dòng ${i} thiếu data`);
            continue;
        }

        try {
            const textToEmbed = `${item.text}: ${item.meaning}`;
            const embedding = await hf.featureExtraction(
                { model: "keepitreal/vietnamese-sbert", inputs: textToEmbed },
                { provider: "hf-inference" }
            );

            const vectorValues = Array.isArray(embedding) ? embedding : Object.values(embedding);

            vectorsBatch.push({
                id: `extra-${item.id}`,
                values: vectorValues,
                metadata: { text: item.text, meaning: item.meaning }
            });

            console.log(`✅ [${i + 1}/${dataSet.length}] ${item.text.substring(0, 40)}`);
            await sleep(1000);

            if (vectorsBatch.length === BATCH_SIZE || i === dataSet.length - 1) {
                console.log(`🚀 Đẩy ${vectorsBatch.length} vectors lên Pinecone...`);
                await index.upsert(vectorsBatch);
                console.log(`☁️ Batch thành công!\n`);
                vectorsBatch = [];

                // Lưu checkpoint
                fs.writeFileSync(checkpointPath, JSON.stringify({ lastIndex: i + 1 }));
            }

        } catch (error) {
            console.error(`❌ Lỗi tại "${item.text}":`, error.message);
            if (error.message.includes("429")) {
                console.log("⏳ Rate limit, nghỉ 5 giây...");
                await sleep(5000);
                i--; // Thử lại câu này
            }
        }
    }

    // Xóa checkpoint khi hoàn tất
    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
    console.log("🎉 HOÀN TẤT! Tất cả câu mới đã lên Pinecone.");
}

runSeed();
