/**
 * Seed ca_dao_popular.json lên Pinecone
 * Chạy: node scripts/seed_popular.js
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

const popularPath = path.join(__dirname, '../ca_dao_popular.json');
if (!fs.existsSync(popularPath)) {
    console.error("❌ Chưa có file ca_dao_popular.json. Chạy generate_popular.js trước!");
    process.exit(1);
}

const dataSet = JSON.parse(fs.readFileSync(popularPath, 'utf8'));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const checkpointPath = path.join(__dirname, '../seed_popular_checkpoint.json');
let startFrom = 0;
if (fs.existsSync(checkpointPath)) {
    startFrom = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')).lastIndex || 0;
    console.log(`🔄 Tiếp tục từ câu số ${startFrom}...`);
}

async function runSeed() {
    console.log(`⏳ Seed ${dataSet.length} câu phổ biến lên Pinecone...`);
    console.log(`📌 Index: det-gam-theu-hoa-v2\n`);

    let vectorsBatch = [];
    const BATCH_SIZE = 50;

    for (let i = startFrom; i < dataSet.length; i++) {
        const item = dataSet[i];
        if (!item?.text || !item?.meaning) { console.log(`⚠️ Bỏ qua dòng ${i}`); continue; }

        try {
            const textToEmbed = `${item.text}: ${item.meaning}`;
            const embedding = await hf.featureExtraction(
                { model: "keepitreal/vietnamese-sbert", inputs: textToEmbed },
                { provider: "hf-inference" }
            );
            const vectorValues = Array.isArray(embedding) ? embedding : Object.values(embedding);

            vectorsBatch.push({
                id: item.id || `popular-${i}`,
                values: vectorValues,
                metadata: { text: item.text, meaning: item.meaning }
            });

            console.log(`✅ [${i + 1}/${dataSet.length}] ${item.text.substring(0, 50)}`);
            await sleep(1000);

            if (vectorsBatch.length === BATCH_SIZE || i === dataSet.length - 1) {
                console.log(`🚀 Đẩy ${vectorsBatch.length} vectors lên Pinecone...`);
                await index.upsert(vectorsBatch);
                console.log(`☁️ Batch OK!\n`);
                vectorsBatch = [];
                fs.writeFileSync(checkpointPath, JSON.stringify({ lastIndex: i + 1 }));
            }
        } catch (error) {
            console.error(`❌ Lỗi: ${error.message}`);
            if (error.message.includes("429")) {
                console.log("⏳ Rate limit, nghỉ 5 giây...");
                await sleep(5000);
                i--;
            }
        }
    }

    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
    console.log("🎉 HOÀN TẤT! Tất cả câu phổ biến đã lên Pinecone.");
}

runSeed();
