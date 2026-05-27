import { getEmbedding } from "../services/ai.service.js";
import { findSimilarIdiom } from "../services/vector.service.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();
// Khởi tạo bộ não mới: Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let isLLMBusy = false; 

// Hàm giám khảo phiên bản Llama 3 70B 
async function verifyMatchWithLLM(webText, idiom, meaning) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Bạn là một chuyên gia ngôn ngữ học và văn học dân gian Việt Nam. Nhiệm vụ của bạn là đối chiếu ý nghĩa ẨN DỤ (nghĩa bóng) của một đoạn văn và một câu ca dao/tục ngữ. 
                    Tuyệt đối KHÔNG đánh giá dựa trên sự trùng lặp từ ngữ (nghĩa đen).
                    Hãy RỘNG LƯỢNG trong việc tìm sự tương đồng — nếu ý nghĩa bóng có liên quan dù chỉ một phần, hãy chấp nhận.

                    Dưới đây là các ví dụ mẫu:

                    [Ví dụ 1 - KHỚP rõ ràng]
                    Đoạn văn: "Dạo này kinh tế khó khăn quá, cuối tuần tôi toàn phải cày thêm mấy job thiết kế, ráng gom góp từng đồng lẻ để cuối năm đủ tiền cưới vợ."
                    Ca dao: "Năng nhặt chặt bị" (Ý nghĩa: Siêng năng tích cóp từng chút một rồi sẽ có được số lượng lớn)
                    Kết quả: {"reasoning": "Đoạn văn nói về tích lũy từng đồng, khớp hoàn toàn với ý nghĩa tích tiểu thành đại.", "match": true, "focusPhrase": "gom góp từng đồng lẻ"}

                    [Ví dụ 2 - KHỚP một phần, vẫn chấp nhận]
                    Đoạn văn: "Anh ấy thất bại nhiều lần nhưng vẫn không bỏ cuộc, tiếp tục cố gắng mỗi ngày."
                    Ca dao: "Có công mài sắt có ngày nên kim" (Ý nghĩa: Kiên trì nỗ lực ắt sẽ thành công)
                    Kết quả: {"reasoning": "Đoạn văn thể hiện tinh thần kiên trì không bỏ cuộc, khớp với ý nghĩa bền bỉ của câu tục ngữ.", "match": true, "focusPhrase": "không bỏ cuộc"}

                    [Ví dụ 3 - KHỚP gián tiếp qua chủ đề]
                    Đoạn văn: "Cô bé mới 10 tuổi đã biết phụ mẹ nấu cơm, quét nhà mỗi buổi sáng."
                    Ca dao: "Có làm thì mới có ăn" (Ý nghĩa: Phải lao động mới có thành quả)
                    Kết quả: {"reasoning": "Đoạn văn nói về đứa trẻ chăm chỉ lao động giúp gia đình, liên quan đến chủ đề lao động của câu tục ngữ.", "match": true, "focusPhrase": "biết phụ mẹ nấu cơm"}

                    [Ví dụ 4 - KHÔNG KHỚP thực sự (hoàn toàn khác chủ đề)]
                    Đoạn văn: "Hôm qua đi biển chơi tự nhiên trời nổi giông bão, sóng đánh cao quá làm lật cả chiếc xuồng nhỏ."
                    Ca dao: "Chớ thấy sóng cả mà ngã tay chèo" (Ý nghĩa: Đừng vì khó khăn mà nản chí)
                    Kết quả: {"reasoning": "Đoạn văn tả cảnh thời tiết thực tế, không mang ý nghĩa ẩn dụ về ý chí hay khó khăn cuộc sống.", "match": false, "focusPhrase": ""}

                    Nguyên tắc quan trọng:
                    - Nếu chủ đề hoặc cảm xúc của đoạn văn CÓ LIÊN QUAN đến ý nghĩa bóng của câu ca dao → CHẤP NHẬN
                    - Chỉ từ chối khi hai bên HOÀN TOÀN không có điểm chung về ý nghĩa

                    Trả về ĐÚNG cấu trúc JSON:
                    {
                        "reasoning": "Giải thích ngắn gọn dưới 50 chữ", 
                        "match": true/false, 
                        "focusPhrase": "Trích 1 cụm 2-8 chữ từ đoạn văn thể hiện ý đó, hoặc rỗng nếu false"
                    }`
                },
                {
                    role: "user",
                    content: `Đoạn văn cần xét: "${webText}"\nCa dao/tục ngữ gợi ý: "${idiom}" (Ý nghĩa: ${meaning})`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1, 
            response_format: { type: "json_object" }, 
        });

        const resultJson = JSON.parse(completion.choices[0]?.message?.content);
        return resultJson;
    } catch (error) {
        console.error("⚠️ Lỗi LLM Giám khảo Groq:", error.message);
        return { match: false, focusPhrase: "" }; 
    }
}

// Hàm trích xuất tính từ từ ĐOẠN VĂN WEB (từ 2 chữ trở lên)
async function extractAdjectivesFromText(webText) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Bạn là chuyên gia ngôn ngữ học tiếng Việt. Tìm các TÍNH TỪ hoặc CỤM TÍNH TỪ đáng chú ý trong đoạn văn tiếng Việt.

                    Ưu tiên theo thứ tự:
                    1. Từ láy có nghĩa tính từ (vd: "lẩm cẩm", "lờ đờ", "rụt rè", "hấp tấp", "lấm lem", "thờ ơ", "bâng khuâng")
                    2. Từ Hán Việt mang nghĩa tính từ (vd: "kiên cường", "dũng cảm", "thông tuệ", "nhu mì", "cần mẫn", "trung trinh", "khiêm tốn")
                    3. Cụm tính từ 2 chữ khó/ít gặp (vd: "nhanh nhẹn", "chậm chạp", "lanh lợi", "thâm trầm", "hào phóng")

                    Quy tắc bắt buộc:
                    - TỐI THIỂU 2 CHỮ — tuyệt đối không lấy tính từ 1 chữ đơn lẻ ("đẹp", "tốt", "xấu", "giỏi"...)
                    - Từ phải XUẤT HIỆN NGUYÊN VẸN trong đoạn văn
                    - Không lấy động từ, danh từ
                    - Tối đa 3 từ, chọn từ đặc sắc nhất
                    - Nếu không có từ đủ tiêu chuẩn, trả về mảng rỗng

                    Ví dụ 1:
                    Đoạn văn: "Chàng nhanh trí tìm được cách nói dối, tuy nhiên hành động đó thật hèn nhát và đáng xấu hổ."
                    Kết quả: {"adjectives": [
                        {"word": "nhanh trí", "meaning": "có trí tuệ nhanh nhạy, phản ứng kịp thời", "english": "quick-witted, sharp-minded"},
                        {"word": "hèn nhát", "meaning": "thiếu dũng cảm, không dám đối mặt với sự thật", "english": "cowardly, spineless"}
                    ]}

                    Ví dụ 2:
                    Đoạn văn: "Người phụ nữ ấy vô cùng kiên nhẫn và nhẫn nại, dù hoàn cảnh khắc nghiệt vẫn bình thản chịu đựng."
                    Kết quả: {"adjectives": [
                        {"word": "kiên nhẫn", "meaning": "có khả năng chịu đựng lâu dài mà không nản lòng", "english": "patient, persevering"},
                        {"word": "nhẫn nại", "meaning": "bền bỉ chịu đựng khó khăn không than vãn", "english": "enduring, forbearing"},
                        {"word": "bình thản", "meaning": "điềm tĩnh, không bị xúc động bởi hoàn cảnh", "english": "calm, composed, unperturbed"}
                    ]}

                    Trả về JSON: {"adjectives": [{"word": "...", "meaning": "...", "english": "..."}]}`
                },
                {
                    role: "user",
                    content: `Đoạn văn: "${webText}"`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const resultJson = JSON.parse(completion.choices[0]?.message?.content);
        // Lọc thêm lần nữa: bỏ từ 1 chữ, bỏ từ không có trong đoạn văn
        const filtered = (resultJson.adjectives || []).filter(adj =>
            adj.word && adj.word.trim().split(/\s+/).length >= 2 && webText.includes(adj.word)
        );
        return filtered;
    } catch (error) {
        console.error("⚠️ Lỗi LLM trích xuất tính từ:", error.message);
        return [];
    }
}

export const scanText = async (req, res) => {
    try {
        const { text, frequency } = req.body;

        const vector = await getEmbedding(text);
        const topMatches = await findSimilarIdiom(vector);

        console.log(`\n🔍 Đang xét đoạn văn: "${text.substring(0, 40)}..."`);

        if (!topMatches || topMatches.length === 0) {
            return res.json({ matchFound: false });
        }

        let threshold = 0.52; 
        if (frequency === 1) threshold = 0.58; 
        if (frequency === 3) threshold = 0.46; 
        
        for (const match of topMatches) {
            if (match.score < threshold) {
                console.log(`📉 Bỏ qua câu "${match.metadata.text}" vì điểm Vector (${match.score.toFixed(3)}) thấp hơn mức sàn (${threshold}).`);
                continue; 
            }

            console.log(`📊 Đang đề xuất: "${match.metadata.text}" (Điểm Vector: ${match.score.toFixed(3)})`);
            
            while (isLLMBusy) { await sleep(1000); }
            isLLMBusy = true; 

            try {
                console.log("⏳ Đang nhờ Llama 3 70B thẩm định nghĩa bóng...");
                await sleep(1500); 

                const llmResult = await verifyMatchWithLLM(
                    text, 
                    match.metadata.text, 
                    match.metadata.meaning
                );

                if (llmResult.match && llmResult.focusPhrase) {
                    console.log(`✅ DUYỆT THÀNH CÔNG: "${match.metadata.text}"`);
                    console.log(`🎯 Bắn tỉa cụm: "${llmResult.focusPhrase}"`);
                    console.log(`💡 Lý do AI: ${llmResult.reasoning}`);

                    // Trích xuất tính từ từ ĐOẠN VĂN WEB (chắc chắn có trong text)
                    console.log("📝 Đang trích xuất cụm tính từ từ đoạn văn...");
                    const adjectives = await extractAdjectivesFromText(text);
                    if (adjectives.length > 0) {
                        console.log(`🌿 Cụm tính từ: ${adjectives.map(a => `"${a.word}"`).join(", ")}`);
                    }
                    
                    return res.json({ 
                        matchFound: true, 
                        idiom: match.metadata.text, 
                        meaning: match.metadata.meaning,
                        focusPhrase: llmResult.focusPhrase,
                        adjectives
                    });
                } else {
                    console.log(`🚫 TỪ CHỐI: ${llmResult.reasoning || "Không khớp bối cảnh."}`);
                }
            } finally {
                isLLMBusy = false; 
            }
        }

        console.log("❌ Đã xét hết danh sách Top nhưng không có câu nào thực sự khớp nghĩa bóng.");
        return res.json({ matchFound: false });

    } catch (error) {
        console.error("Scan Controller Error:", error);
        res.status(500).json({ error: "Lỗi hệ thống AI" });
    }
};