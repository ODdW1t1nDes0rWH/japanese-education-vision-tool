// フォームの送信を処理し、AIに送るプロンプトを生成・送信するJavaScriptコード

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('japaneseSchoolForm');
    const outputArea = document.getElementById('outputArea'); // 回答を表示する要素

    // APIキーをYOUR_API_KEYに置き換えてください
    const GEMINI_API_KEY = 'YOUR_API_KEY';

    // Gemini APIにリクエストを送信する関数
    async function callGemini(prompt) {
        if (GEMINI_API_KEY === 'YOUR_API_KEY' || !GEMINI_API_KEY) {
            console.error("APIキーが設定されていません。'YOUR_API_KEY'を有効なキーに置き換えてください。");
            return "エラー：APIキーが設定されていません。";
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                 const errorBody = await response.text();
                 console.error("API Error Response:", response.status, errorBody);
                 return `APIエラーが発生しました (Status: ${response.status})`;
            }

            const data = await response.json();
            console.log("Gemini API response:", data);

            // 応答からテキスト部分を抽出
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || "AIからお返事がなかったよ。別の質問で試してみてね。";

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return "API呼び出し中にエラーが発生しました。ネットワーク接続やAPIキーを確認してください。";
        }
    }

    // フォームデータを収集し、プロンプト文字列を生成する関数
    function generatePrompt(form) {
        let prompt = "以下の日本語学校設立に関するアンケート回答に基づいて、日本語学校の理念・目的・目標などを出力してください。【出力してほしい内容】1学校の理念（100文字前後）具体的なキーワードを必ず含め、シンプルかつ印象的に記述。2学校の目的「誰が」「何を」「どうするか」の三要素を含め、教育機関としての社会的・教育的な存在意義を詳細に記述。3学校の目標（定量的な目標3つ）各目標は2～3行ずつ。「○○する力」などの形式で記載。できる限り測定可能な動詞や数値を使って具体的に。4教育課程の概要上記の目標を実現するために必要な教育課程を構造的に説明（例：会話重視・ビジネス日本語・特定技能対策など）。5学校の特色（詳細に複数段落）教育内容、学校運営、支援体制、地域や企業との連携など、他校との差別化が見えるように。6修了要件育てたい学生像に到達したかどうかを数値で測定する仕組みを記述（例：JLPT N2、出席率90%、課題提出率など必ず具体的であること）。7必要な生活指導者の数と対応言語学生の出身国・生活上の支援内容に基づいて、必要な人数・言語サポートを記載。8進路指導者の数と種類（担当業務）就職や進学サポートに必要な職種・人数・具体的な対応内容を記述（例：企業連携対応者・進学相談担当など）。9課外授業の内容・頻度・外部連携学生像や地域性に応じて、望ましい課外授業を設計。例：月1回の地域訪問、週1の就職準備ワークショップなど。\n\n";
        prompt += "--- アンケート回答 ---\n";

        // フォーム内のすべての入力要素を取得
        const elements = form.elements;
        const data = {};

        // データをname属性ごとに整理
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const name = element.name;
            const value = (element.value || '').trim();
            const id = element.id;

            // name属性がない、または送信ボタンなどはスキップ
            if (!name || element.type === 'submit' || element.type === 'button' || element.disabled) {
                continue;
            }

            // チェックボックスとラジオボタン
            if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) {
                continue; // チェックされていないものはスキップ
            }

            // name属性が配列形式の場合 (例: intent[])
            if (name.endsWith('[]')) {
                const baseName = name.slice(0, -2);
                if (!data[baseName]) {
                    data[baseName] = [];
                }

                 // 「その他」のチェックボックスとテキスト入力の関連を処理
                 if (value === "その他" || value === "その他（記述）") {
                     const otherTextElement = document.getElementById(`${id.replace('_chk', '')}_text`);
                     if (otherTextElement && otherTextElement.value.trim()) {
                         data[baseName].push(`${value}（${otherTextElement.value.trim()}）`);
                     } else {
                          // テキスト入力がない、または空の場合はチェックボックスの値のみ
                          data[baseName].push(value);
                     }
                 } else {
                    // 通常のチェックボックスの値を追加
                    data[baseName].push(value);
                 }

            } else {
                // 配列形式でないその他の入力要素 (text, number, textarea, radio)
                // 特定の関連がある入力（チェックボックスに紐づく数字やテキスト）は後でまとめて処理するため、ここではスキップする
                 if (id.endsWith('_text') || id.endsWith('_num')) {
                     continue;
                 }

                 // ラジオボタンは既にチェックされているものだけを見ている
                data[name] = value;
            }
        }

        // 特殊なケース（チェックボックスと数字/テキストがペアになっているもの）を処理
        // 教員の指導経験 (teacher_instruction[])
        const teacherInstructionValues = [];
         if (data['teacher_instruction']) { // ベースとなるチェックボックスが選択されているか確認
             data['teacher_instruction'].forEach(instruction => {
                 let displayValue = instruction;
                 let numValue = null;
                 let textValue = null;

                 // 紐づく数値入力やテキスト入力を探す
                 // idに基づいて対応する要素を見つける（HTML構造に依存）
                 let baseId = '';
                 const checkboxElement = form.querySelector(`input[name="teacher_instruction[]"][value="${instruction}"]`);
                 if (checkboxElement) {
                     baseId = checkboxElement.id;
                 }

                 if (baseId) {
                     if (baseId === 'teacher_inst_univ_chk') numValue = form.elements['teacher_instruction_num_univ']?.value.trim();
                     if (baseId === 'teacher_inst_senshu_chk') numValue = form.elements['teacher_instruction_num_senshu']?.value.trim();
                     if (baseId === 'teacher_inst_job_gijin_chk') numValue = form.elements['teacher_instruction_num_gijin']?.value.trim();
                     if (baseId === 'teacher_inst_job_tokutei_chk') numValue = form.elements['teacher_instruction_num_tokutei']?.value.trim();
                     if (baseId === 'teacher_inst_beginner_chk') numValue = form.elements['teacher_instruction_num_beginner']?.value.trim();
                     // if (baseId === 'teacher_inst_multinational_chk') numValue = null; // HTMLに人数入力欄がない
                     if (baseId === 'teacher_inst_kanji_chk') numValue = form.elements['teacher_instruction_num_kanji']?.value.trim();
                     if (baseId === 'teacher_inst_nonkanji_chk') numValue = form.elements['teacher_instruction_num_nonkanji']?.value.trim();
                     if (baseId === 'teacher_inst_other_chk') {
                         textValue = form.elements['teacher_instruction_other_text']?.value.trim();
                         numValue = form.elements['teacher_instruction_num_other']?.value.trim();
                         if (textValue) displayValue = `${instruction}（${textValue}）`; // 「その他（経験内容）」のように表示
                     }
                 }


                 if (numValue && parseInt(numValue, 10) > 0) {
                      teacherInstructionValues.push(`${displayValue}（${numValue}名）`);
                 } else if (textValue && baseId === 'teacher_inst_other_chk' && data['teacher_instruction'].includes(instruction)) {
                     // 「その他」でテキストだけ入力されている場合も考慮
                      teacherInstructionValues.push(displayValue);
                 } else if (!numValue && !textValue && data['teacher_instruction'].includes(instruction)) {
                      // 人数入力欄がない項目や、人数が0/未入力でもチェックが入っていれば項目名のみ追加
                      // 例: 多国籍クラス対応
                     // ただし、「その他」の場合はテキストまたは数値がないと項目名だけでは情報が不十分なのでスキップ
                     if (baseId !== 'teacher_inst_other_chk') {
                         teacherInstructionValues.push(displayValue);
                     }
                 }
             });
             delete data['teacher_instruction']; // 元の配列は不要になる
             if (teacherInstructionValues.length > 0) {
                 data['teacher_instruction_summary'] = teacherInstructionValues; // まとめ結果を新しいキーで格納
             }
         }


         // 母語対応可能な言語・対応人数 (lang_support[])
         const langSupportValues = [];
         if (data['lang_support']) {
             data['lang_support'].forEach(lang => {
                 let displayValue = lang;
                 let numValue = null;
                 let textValue = null;

                 let baseId = '';
                 const checkboxElement = form.querySelector(`input[name="lang_support[]"][value="${lang}"]`);
                  if (checkboxElement) {
                     baseId = checkboxElement.id;
                 }

                 if (baseId) {
                     if (baseId === 'lang_support_nepali_chk') numValue = form.elements['lang_support_num_nepali']?.value.trim();
                     if (baseId === 'lang_support_vietnamese_chk') numValue = form.elements['lang_support_num_vietnamese']?.value.trim();
                     if (baseId === 'lang_support_chinese_chk') numValue = form.elements['lang_support_num_chinese']?.value.trim();
                     if (baseId === 'lang_support_myanmar_chk') numValue = form.elements['lang_support_num_myanmar']?.value.trim();
                     if (baseId === 'lang_support_srilanka_chk') numValue = form.elements['lang_support_num_srilanka']?.value.trim();
                     if (baseId === 'lang_support_mongolian_chk') numValue = form.elements['lang_support_num_mongolian']?.value.trim();
                     if (baseId === 'lang_support_bangladesh_chk') numValue = form.elements['lang_support_num_bangladesh']?.value.trim();
                     if (baseId === 'lang_support_english_chk') numValue = form.elements['lang_support_num_english']?.value.trim();
                      if (baseId === 'lang_support_other_chk') {
                         textValue = form.elements['lang_support_other_text']?.value.trim();
                         numValue = form.elements['lang_support_num_other']?.value.trim();
                         if (textValue) displayValue = `${lang}（${textValue}）`; // 「その他（記述）（言語名）」のように表示
                      }
                 }

                 if (numValue && parseInt(numValue, 10) > 0) {
                      langSupportValues.push(`${displayValue}（${numValue}名）`);
                 } else if (textValue && baseId === 'lang_support_other_chk' && data['lang_support'].includes(lang)) {
                     // 「その他」でテキストだけ入力されている場合
                     langSupportValues.push(displayValue);
                 } else if (!numValue && !textValue && data['lang_support'].includes(lang)) {
                      // 人数入力欄がない項目や、人数が0/未入力でもチェックが入っていれば項目名のみ追加
                      if (baseId !== 'lang_support_other_chk') {
                           langSupportValues.push(displayValue);
                      }
                 }
             });
             delete data['lang_support'];
              if (langSupportValues.length > 0) {
                 data['lang_support_summary'] = langSupportValues;
              }
         }

         // 進路指導者の種類と数 (career_advisor[])
         const careerAdvisorValues = [];
         if (data['career_advisor']) {
             data['career_advisor'].forEach(advisorType => {
                 let displayValue = advisorType;
                 let numValue = null;
                 let textValue = null;

                 let baseId = '';
                 const checkboxElement = form.querySelector(`input[name="career_advisor[]"][value="${advisorType}"]`);
                  if (checkboxElement) {
                     baseId = checkboxElement.id;
                 }

                 if (baseId) {
                     if (baseId === 'career_advisor_teacher_chk') {
                         numValue = form.elements['career_advisor_num_teacher']?.value.trim();
                         textValue = form.elements['career_advisor_text_teacher']?.value.trim();
                     }
                     if (baseId === 'career_advisor_specialist_chk') {
                         numValue = form.elements['career_advisor_num_specialist']?.value.trim();
                         textValue = form.elements['career_advisor_text_specialist']?.value.trim();
                     }
                     if (baseId === 'career_advisor_cc_chk') {
                         textValue = form.elements['career_advisor_text_cc']?.value.trim();
                     }
                      if (baseId === 'career_advisor_lang_chk') {
                         textValue = form.elements['career_advisor_text_lang']?.value.trim();
                      }
                     if (baseId === 'career_advisor_other_chk') {
                         textValue = form.elements['career_advisor_other_text']?.value.trim();
                         numValue = form.elements['career_advisor_num_other']?.value.trim();
                         if (textValue) displayValue = `${advisorType}（${textValue}）`; // 「その他（種類）」のように表示
                     }
                 }

                 let formattedValue = displayValue;
                 const parts = [];
                 if (numValue && parseInt(numValue, 10) > 0) parts.push(`${numValue}名`);
                 if (textValue) parts.push(textValue);

                 if (parts.length > 0) {
                    formattedValue += `（${parts.join('、')}）`;
                 } else if (baseId === 'career_advisor_other_chk' && (numValue === null || numValue === '' || parseInt(numValue, 10) === 0) && (textValue === null || textValue === '')) {
                     // 「その他」で何も入力されていない場合はスキップ
                     return;
                 }

                  careerAdvisorValues.push(formattedValue);
             });
             delete data['career_advisor'];
              if (careerAdvisorValues.length > 0) {
                 data['career_advisor_summary'] = careerAdvisorValues;
              }
         }


         // 課外授業の実施内容 (extracurricular[])
         const extracurricularValues = [];
         if (data['extracurricular']) {
             data['extracurricular'].forEach(activity => {
                 let displayValue = activity;
                 let textValue = null;

                 let baseId = '';
                 const checkboxElement = form.querySelector(`input[name="extracurricular[]"][value="${activity}"]`);
                  if (checkboxElement) {
                     baseId = checkboxElement.id;
                 }

                  if (baseId) {
                     if (baseId === 'extracurricular_fieldtrip_chk') textValue = form.elements['extracurricular_text_fieldtrip']?.value.trim();
                     if (baseId === 'extracurricular_volunteer_chk') textValue = form.elements['extracurricular_text_volunteer']?.value.trim();
                     if (baseId === 'extracurricular_culture_chk') textValue = form.elements['extracurricular_text_culture']?.value.trim();
                     if (baseId === 'extracurricular_company_visit_chk') textValue = form.elements['extracurricular_text_company_visit']?.value.trim();
                     if (baseId === 'extracurricular_event_chk') textValue = form.elements['extracurricular_text_event']?.value.trim();
                     if (baseId === 'extracurricular_local_exchange_chk') textValue = form.elements['extracurricular_text_local_exchange']?.value.trim();
                      if (baseId === 'extracurricular_other_chk') {
                         textValue = form.elements['extracurricular_other_text']?.value.trim();
                         if (textValue) displayValue = `${activity}（${textValue}）`; // 「その他（内容）」のように表示
                      }
                  }

                 let formattedValue = displayValue;
                 if (textValue && baseId !== 'extracurricular_other_chk') {
                     // 「その他」以外の項目で補足テキストがある場合
                      formattedValue += `（補足：${textValue}）`;
                 }

                 // 「その他」でテキストがない場合はスキップ
                 if (baseId === 'extracurricular_other_chk' && (textValue === null || textValue === '')) {
                     return;
                 }

                 extracurricularValues.push(formattedValue);
             });
             delete data['extracurricular'];
              if (extracurricularValues.length > 0) {
                 data['extracurricular_summary'] = extracurricularValues;
              }
         }

         // 独自のチェックボックス+テキスト処理（uniqueness[]）
         const uniquenessValues = [];
         if (data['uniqueness']) {
             data['uniqueness'].forEach(uniqueItem => {
                 let displayValue = uniqueItem;
                 let textValue = null;

                 let baseId = '';
                 const checkboxElement = form.querySelector(`input[name="uniqueness[]"][value="${uniqueItem}"]`);
                  if (checkboxElement) {
                     baseId = checkboxElement.id;
                 }

                 if (baseId) {
                     // 対応するテキスト入力のIDを探す（IDのサフィックス '_chk' を '_text' に置き換える）
                     const textId = baseId.replace('_chk', '_text');
                     const textElement = document.getElementById(textId);
                     if (textElement) {
                          textValue = textElement.value.trim();
                     }
                 }

                 let formattedValue = displayValue;
                 if (textValue) {
                    // 「その他」の場合は「その他（入力内容）」、「その他」以外の場合は「項目名（補足：入力内容）」
                    if (uniqueItem === "その他") {
                         formattedValue = `${uniqueItem}（${textValue}）`;
                    } else {
                         formattedValue += `（補足：${textValue}）`;
                    }
                 } else if (uniqueItem === "その他" && (!textValue || textValue === '')) {
                     // 「その他」がチェックされているがテキスト入力がない場合はスキップ
                     return;
                 }

                 uniquenessValues.push(formattedValue);
             });
             delete data['uniqueness'];
              if (uniquenessValues.length > 0) {
                 data['uniqueness_summary'] = uniquenessValues;
              }
         }


        // プロンプトに整形して追加するための表示名マップ
        const displayNameMap = {
            // セクション1
            'intent': '設立しようと思ったきっかけ',
            'background': '設立に至った背景',
            'role': '日本語学校が社会に果たすべき役割',
            'support': '外国人へどのような支援・サポート',
            'why_nihongo': '他の教育機関ではなくなぜ日本語学校なのか',
            // セクション2
            'age': '学生の年齢層',
            'mother_tongue': '学生の母語',
            'education': '学生の学歴',
            'country': '学生の出身国',
            'career_path': '卒業後の進路',
            'japanese_level': '入学時の日本語能力',
            // セクション3
            'student_skills': '育てたい学生に求めるスキル',
            'target_japanese_level': '育てたい学生の日本語力の目安',
            'target_comm_level': '育てたい学生のコミュニケーション力の目安',
            'target_autonomy_level': '育てたい学生の自律性のレベル',
            'target_culture_level': '育てたい学生の文化理解のレベル',
             // セクション4
             'uniqueness_summary': '学校の独自性', // 特殊処理済みのキー
            // セクション5
            'teachers_fulltime': '常勤教員数',
            'teachers_parttime': '非常勤教員数',
            'teacher_exp_under1': '教員経験年数1年未満',
            'teacher_exp_1to3': '教員経験年数1〜3年',
            'teacher_exp_3to5': '教員経験年数3〜5年',
            'teacher_exp_over5': '教員経験年数5年以上',
            'teacher_instruction_summary': '教員の指導経験', // 特殊処理済みのキー
            'support_staff_fulltime': '専任生活指導担当者数',
            'support_staff_parttime': '兼任生活指導担当者数',
            'lang_support_summary': '母語対応可能な言語・対応人数', // 特殊処理済みのキー
            'career_advisor_summary': '進路指導者の種類と数', // 特殊処理済みのキー
            'extracurricular_summary': '課外授業の実施内容' // 特殊処理済みのキー
            // 自由記述など、HTMLに特定の要素がない場合はここに追加しない
        };

        // 整形したデータオブジェクトをプロンプト文字列に変換
        for (const name in displayNameMap) {
            const display = displayNameMap[name];
            const value = data[name];

            if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
                // 値がない項目はスキップ
                continue;
            }

            if (Array.isArray(value)) {
                prompt += `- ${display}：${value.join('、')}\n`;
            } else {
                 // 数値入力には「名」を付ける（name属性で判定）
                 if (['teachers_fulltime', 'teachers_parttime', 'teacher_exp_under1', 'teacher_exp_1to3', 'teacher_exp_3to5', 'teacher_exp_over5', 'support_staff_fulltime', 'support_staff_parttime'].includes(name)) {
                      if (value.trim() !== '' && parseInt(value, 10) >= 0) { // 数字が入力されているか確認
                          prompt += `- ${display}：${value}名\n`;
                      } else {
                           // 入力がないまたは無効な数字はスキップ
                      }
                 } else {
                     // その他の単一値項目（テキスト、ラジオなど）
                      prompt += `- ${display}：${value}\n`;
                 }
            }
        }

        prompt += "\n--- 回答ここまで ---\n";
        prompt += "\n上記の情報を踏まえ、この日本語学校の特徴や強みを把握し、日本語学校の理念・目的・目標などを出力してください。必要な人員等は入力情報にこだわらず理念や目的達成のために必要な体制を出力してください。";
        
        const preview = document.getElementById("promptPreview");
        if (preview) {
        preview.innerText = prompt;
        }

        console.log("Generated Prompt:", prompt);
        return prompt;
    }


    // フォーム送信時のイベントリスナー
    form.addEventListener('submit', async function(event) {
        event.preventDefault(); // フォームのデフォルト送信をキャンセル

        // ユーザーにAPI実行の確認を求める
        const confirmation = confirm("入力内容に基づいてAIにアドバイスを求めますか？（AI利用には費用が発生する場合があります）");
         if (!confirmation) {
             console.log("AI処理をキャンセルしました。");
             return; // キャンセルされたら処理を中断
         }


        // 出力エリアをクリアし、ローディングメッセージを表示
        outputArea.innerHTML = '';
        outputArea.textContent = "AIが考え中だよ... しばらくお待ちください。";

        // プロンプト生成
        const prompt = generatePrompt(form);

        // Gemini APIを呼び出し
        const aiReply = await callGemini(prompt);

        // 結果を表示
        outputArea.textContent = aiReply;
    });
});
fetch('/.netlify/functions/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'こんにちは' })
})
  .then(res => res.json())
  .then(data => {
    console.log('Geminiの返答:', data);
  });

async function callGeminiAPI(prompt) {
  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error('Gemini API 呼び出しに失敗しました');
    }

    const data = await response.json();

    // Geminiの返答を整形して表示
    const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '返答がありませんでした';
    document.getElementById('gemini-response').textContent = geminiResponse;
  } catch (error) {
    console.error(error);
    document.getElementById('gemini-response').textContent = 'エラーが発生しました: ' + error.message;
  }
}
