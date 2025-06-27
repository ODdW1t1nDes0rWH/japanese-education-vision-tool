document.addEventListener('DOMContentLoaded', function() {
    // === 要素の取得 ===
    const form = document.getElementById('japaneseSchoolForm');
    const outputArea = document.getElementById('outputArea');
    const saveButton = document.getElementById('saveButton');
    const promptPreview = document.getElementById('promptPreview');
    const storageKey = 'japaneseSchoolFormData';

    // === Gemini APIを呼び出す関数 ===
    async function callGeminiAPI(prompt) {
        outputArea.textContent = "AIが考え中だよ... しばらくお待ちください。";

        try {
            // Netlify Functionsのエンドポイントを呼び出す
            const response = await fetch("/.netlify/functions/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompt }), // promptをオブジェクトに格納
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`サーバーエラー: ${response.status} ${response.statusText}\n${errorText}`);
            }

            const data = await response.json();

            if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            } else if (data?.error) {
                throw new Error(`APIエラー: ${data.error}`);
            } else {
                console.error("Unknown response format:", data);
                throw new Error("AIから有効な回答が得られませんでした。");
            }
        } catch (err) {
            console.error("API call failed:", err);
            return `エラーが発生しました。\n\n詳細: ${err.message}\n\nブラウザの開発者コンソールで詳細を確認してください。`;
        }
    }

    // === フォームデータを収集し、プロンプト文字列を生成する関数 ===
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

         // 進路指導者の種類と数 (career_adviser[])
         const careerAdviserValues = [];
        if (data['career_adviser']) {
            data['career_adviser'].forEach(adviserType => {
                let displayValue = adviserType;
                let numValue = null;
                let textValue = null;

                let baseId = '';
                const checkboxElement = form.querySelector(`input[name="career_adviser[]"][value="${adviserType}"]`);
                if (checkboxElement) {
                    baseId = checkboxElement.id;
                }

                if (baseId) {
                    if (baseId === 'career_adviser_teacher') {
                        numValue = form.elements['career_adviser_teacher_num']?.value.trim();
                    }
                    if (baseId === 'career_adviser_specialist') {
                        numValue = form.elements['career_adviser_specialist_num']?.value.trim();
                    }
                    if (baseId === 'career_adviser_consultant') {
                        textValue = form.elements['career_adviser_consultant_text']?.value.trim();
                    }
                    if (baseId === 'career_adviser_foreignlang') {
                        textValue = form.elements['career_adviser_foreignlang_text']?.value.trim();
                    }
                    if (baseId === 'career_adviser_other_chk') {
                        textValue = form.elements['career_adviser_other_text']?.value.trim();
                        numValue = form.elements['career_adviser_other_num']?.value.trim();
                        if (textValue) displayValue = `${adviserType}（${textValue}）`;
                    }
                }

                let formattedValue = displayValue;
                const parts = [];
                if (numValue && parseInt(numValue, 10) > 0) parts.push(`${numValue}名`);
                if (textValue && baseId !== 'career_adviser_other_chk' && baseId !== 'career_adviser_consultant' && baseId !== 'career_adviser_foreignlang') parts.push(textValue);
                if (baseId === 'career_adviser_consultant' || baseId === 'career_adviser_foreignlang') {
                    if (textValue) parts.push(textValue);
                }
                if (parts.length > 0) {
                    formattedValue += `（${parts.join('、')}）`;
                } else if (baseId === 'career_adviser_other_chk' && (numValue === null || numValue === '' || parseInt(numValue, 10) === 0) && (textValue === null || textValue === '')) {
                    return;
                }
                careerAdviserValues.push(formattedValue);
            });
            delete data['career_adviser'];
            if (careerAdviserValues.length > 0) {
                data['career_adviser_summary'] = careerAdviserValues;
            }
        }

        // 課外授業の実施内容 (extra_class[])
        const extraClassValues = [];
        if (data['extra_class']) {
            data['extra_class'].forEach(activity => {
                let displayValue = activity;
                let textValue = null;
                let baseId = '';
                const checkboxElement = form.querySelector(`input[name="extra_class[]"][value="${activity}"]`);
                if (checkboxElement) {
                    baseId = checkboxElement.id;
                }
                if (baseId) {
                    if (baseId === 'extra_other_chk') {
                        textValue = form.elements['extra_other_text']?.value.trim();
                        if (textValue) displayValue = `${activity}（${textValue}）`;
                    }
                }
                let formattedValue = displayValue;
                if (textValue && baseId !== 'extra_other_chk') {
                    formattedValue += `（補足：${textValue}）`;
                }
                if (baseId === 'extra_other_chk' && (!textValue || textValue === '')) {
                    return;
                }
                extraClassValues.push(formattedValue);
            });
            delete data['extra_class'];
            if (extraClassValues.length > 0) {
                data['extra_class_summary'] = extraClassValues;
            }
        }

        // displayNameMapの修正
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
            'career_adviser_summary': '進路指導者の種類と数', // 特殊処理済みのキー
            'extra_class_summary': '課外授業の実施内容' // 特殊処理済みのキー
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



    // === LocalStorageへの保存・読み込み ===
    function saveFormData() {
        const formData = {};
        const elements = form.elements;
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (!el.id || el.type === 'submit' || el.type === 'button') continue;
            if (el.type === 'checkbox' || el.type === 'radio') {
                formData[el.id] = el.checked;
            } else {
                formData[el.id] = el.value;
            }
        }
        localStorage.setItem(storageKey, JSON.stringify(formData));
        // console.log("Form data saved to localStorage.");
        generatePrompt(form); // 変更があるたびにプレビューを更新
    }

    function loadFormData() {
        const savedData = localStorage.getItem(storageKey);
        if (!savedData) return;
        try {
            const data = JSON.parse(savedData);
            for (const id in data) {
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox' || el.type === 'radio') {
                        el.checked = data[id];
                    } else {
                        el.value = data[id];
                    }
                }
            }
            console.log("Form data loaded from localStorage.");
            generatePrompt(form);
        } catch (e) {
            console.error("Failed to parse localStorage data:", e);
        }
    }

    // === イベントリスナーの設定 ===
    form.addEventListener('submit', async function(event) {
        event.preventDefault(); // フォームのデフォルト送信をキャンセル

        const confirmation = confirm("入力内容に基づいてAIにアドバイスを求めますか？");
        if (!confirmation) {
            console.log("AI処理をキャンセルしました。");
            return;
        }

        const promptText = generatePrompt(form);
        const aiReply = await callGeminiAPI(promptText);
        outputArea.textContent = aiReply;
    });

    if (saveButton) {
        saveButton.addEventListener('click', () => {
             saveFormData();
             alert("入力内容を一時保存しました。");
        });
    }

    form.addEventListener('change', saveFormData);
    form.addEventListener('input', saveFormData);

    // === 初期化処理 ===
    loadFormData();
});
