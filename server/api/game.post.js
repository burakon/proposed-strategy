import * as dotenv from "dotenv";
dotenv.config();
import {
    Configuration,
    OpenAIApi
} from "openai";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);

    const openaiConfig = new Configuration({
        apiKey: process.env.OPENAI_API_KEY
    });
    const openaiClient = new OpenAIApi(openaiConfig);

    if (!body.item && !body.move) {
        throw createError({
            statusCode: 400,
            message: "アイテムか行動のどちらかは入力してください",
        })
    }

    // 入力がされなかったときの初期値を設定
    const item = body.item || "なし";
    const move = body.move || "何もしない";

    // itemが10文字以上だった場合はエラー
    if (Array.from(item).length > 10) {
        throw createError({
            statusCode: 400,
            message: "アイテムは10文字以内で入力してください",
        })
    }
    // moveが100文字以上だった場合はエラー
    if (Array.from(move).length > 100) {
        throw createError({
            statusCode: 400,
            message: "行動は100文字以内で入力してください",
        })
    }

    const openaiResponse = await openaiClient.createChatCompletion({
        model: "gpt-3.5-turbo", // LLM gpt-3.5-turbo か gpt-4 を指定
        max_tokens: 500, // 最大トークン数
        temperature: 1, // レスポンスの多様性を調整する
        messages: [{
                role: "system",
                content: `プレイヤーは恋人です。
                交際した期間は短く、これから別れるか交際継続するか結婚するかどうか悩んでいます。
                恋人の告白文言によって、別れるか交際継続を了承するか結婚するかどうか判断する必要があります。
                恋人及び自分がどのような容姿・人物であるかはプレイヤーの入力に委ねられます。
                
                自分は圧倒的な魅力を持っています。自分はとても冷徹ですが、少しだけ人情味のある性格をしています。
                恋人の行動によって、自分と幸せになる・結婚が実現した場合など、交際継続を了承した場合にはゲームクリア。
                恋人の行動によって恋人と破局、それに準ずる状態になった場合はゲームオーバーとしてください。
                
                結果は以下のフォーマットで返答してください。
                
                【自分の行動】
                ここに自分の行動・リアクションを記載
                
                【結果】
                クリアorゲームオーバー
                
                【エピローグ】
                結果が出た後の物語についてを記載`,
            },
            {
                role: "user",
                content: `【用意したアイテム】
${item}

【告白文言】
${move}`,
            },
        ],
    });

    const aiResponseText = openaiResponse.data.choices[0].message?.content;
    // 返却値の確認
    // console.log(openaiResponse.data.choices[0].message?.content);

    if (!aiResponseText) {
        throw createError({
            statusCode: 500,
            message: "恋人がリアクションしませんでした。もう一度挑戦してみてください。",
        })
    }

    // 【魔王の行動】〜【結果】の間にある文字列を取得
    const erlkingMove = aiResponseText.match(/【自分の行動】([\s\S]*?)【結果】/);

    if (erlkingMove && erlkingMove[1] === null) {
        throw createError({
            statusCode: 500,
            message: "恋人の行動が不明でした。もう一度挑戦してみてください。",
        })
    }
    // 改行文字を削除
    erlkingMove[1] = erlkingMove[1].replace(/\r?\n/g, "");

    // 【結果】〜【エピローグ】の間にある文字列を取得
    const result = aiResponseText.match(/【結果】([\s\S]*?)【エピローグ】/);
    if (result && result[1] === null) {
        throw createError({
            statusCode: 500,
            message: "結果が不明でした。もう一度挑戦してみてください。",
        })
    }
    // resultの中に「オーバー」が含まれていればゲームオーバー、含まれていればクリアとして文字列を作成する
    // ※ ゲームクリア・ゲームオーバーの判定がブレる場合がある
    const resultText = result[1].includes("オーバー") ? "ゲームオーバー" : "ゲームクリア";

    // 【エピローグ】〜最後までの間にある文字列を取得
    const epilogue = aiResponseText.match(/【エピローグ】([\s\S]*)/);
    if (epilogue && epilogue[1] === null) {
        throw createError({
            statusCode: 500,
            message: "行動のその後が不明でした。もう一度挑戦してみてください。",
        })
    }
    // 改行文字を削除
    epilogue[1] = epilogue[1].replace(/\r?\n/g, "");

    const payload = {
        erlkingMove: erlkingMove[1],
        result: resultText,
        epilogue: epilogue[1],
        item,
        move
    };
    console.log(payload);
    return payload;

});