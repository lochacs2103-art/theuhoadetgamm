import { hf } from "../config/huggingface.config.js";

export const getEmbedding = async (text) => {
    try {
        const embedding = await hf.featureExtraction(
            {
                // Đảm bảo model tiếng Việt khớp với lúc đẩy lên Pinecone
                model: "keepitreal/vietnamese-sbert", 
                inputs: text,
            },
            { 
                provider: "hf-inference" 
            }
        );
        return embedding;
    } catch (error) {
        console.error("Lỗi tạo Vector:", error);
        throw error;
    }
};