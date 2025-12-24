// 1. ダッシュボードの読み込み
async function loadAccounts() {
    const grid = document.getElementById('account-grid');
    if (!grid) return; // 登録画面では実行しない

    const res = await fetch('/accounts');
    const accounts = await res.json();

    if (accounts.length === 0) {
        grid.innerHTML = '<p>アカウントがありません。「追加」から登録してください。</p>';
        return;
    }

    grid.innerHTML = accounts.map(acc => `
        <div class="card" style="cursor: pointer; position: relative;" onclick="location.href='account_detail.html?id=${acc.id}'">
            <button onclick="event.stopPropagation(); editAccount(${acc.id}, '${acc.name}')" 
                    style="position:absolute; top:10px; right:10px; background:none; border:none; cursor:pointer; font-size:20px; color:#666;">
                ⚙️
            </button>
            <h3>${acc.name}</h3>
            <p><span class="label">最終ツイート</span> ${acc.last_tweet}</p>
            <p><span class="label">次回予定</span> ${acc.next_scheduled}</p>
            <button onclick="event.stopPropagation(); testPost(${acc.id})" style="margin-top:10px; cursor:pointer;">Hello Worldテスト</button>
        </div>
    `).join('');
}

// 2. テスト投稿
async function testPost(accountId) {
    const res = await fetch(`/accounts/${accountId}/test-tweet`, { method: 'POST' });
    if (res.ok) alert('ツイート成功！');
    else alert('エラーが発生しました');
}

// アカウント編集
async function editAccount(accountId, accountName) {
    const newName = prompt('アカウント名を変更:', accountName);
    if (!newName || newName === accountName) return;
    
    const apiKey = prompt('API Key (変更しない場合は空白):', '');
    const apiSecret = prompt('API Secret (変更しない場合は空白):', '');
    const accessToken = prompt('Access Token (変更しない場合は空白):', '');
    const accessTokenSecret = prompt('Access Token Secret (変更しない場合は空白):', '');
    
    const data = { name: newName };
    if (apiKey) data.api_key = apiKey;
    if (apiSecret) data.api_secret = apiSecret;
    if (accessToken) data.access_token = accessToken;
    if (accessTokenSecret) data.access_token_secret = accessTokenSecret;
    
    const res = await fetch(`/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (res.ok) {
        alert('アカウント情報を更新しました');
        loadAccounts(); // 再読み込み
    } else {
        alert('更新に失敗しました');
    }
}

// 3. 詳細画面のデータを読み込む
async function loadAccountDetail(id) {
    const res = await fetch(`/accounts/${id}/tweets`);
    const data = await res.json();
    
    document.getElementById('account-name').innerText = `${data.account_name} の投稿管理`;

    // タイムライン表示（予約と履歴を統合）
    renderTimeline(data.tweets);
    
    // 画像読み込み
    loadImages(id);
    
    // 画像アップロード機能の初期化
    setupImageUpload(id);
    
    // 予約時間の最小値を現在時刻に設定
    setMinimumDateTime();
    
    // テキストエリアの文字数カウント
    setupCharCounter();
}

// 予約時間の最小値を現在時刻に設定（過去時間は選択不可）
function setMinimumDateTime() {
    const scheduledAtInput = document.getElementById('scheduled_at');
    if (!scheduledAtInput) return;
    
    // 現在時刻を取得して5分後の時刻を設定（推奨値）
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    
    // datetime-local形式（YYYY-MM-DDTHH:mm）
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    // 最小値を設定（過去は選択不可）
    scheduledAtInput.min = minDateTime;
    scheduledAtInput.value = minDateTime;
}

// テキストエリアの文字数カウント
function setupCharCounter() {
    const contentInput = document.getElementById('content');
    const charCount = document.getElementById('char-count');
    
    if (!contentInput || !charCount) return;
    
    const updateCount = () => {
        const count = contentInput.value.length;
        charCount.textContent = `${count} / 280`;
        charCount.style.color = count > 280 ? '#dc3545' : '#666';
    };
    
    contentInput.addEventListener('input', updateCount);
    updateCount();
}

// グローバル変数で選択画像を管理
let selectedImages = []; // 選択画像の配列（最大4枚）

// 画像一覧の読み込み
async function loadImages(accountId) {
    const res = await fetch(`/accounts/${accountId}/images`);
    const images = await res.json();
    
    const gallery = document.getElementById('image-gallery');
    if (!gallery) return;
    
    gallery.innerHTML = images.map(img => `
        <img src="/uploads/${accountId}/${img}" alt="${img}" class="gallery-img" onclick="selectImage('${accountId}', '${img}', this)">
    `).join('');
}

// 画像アップロード設定
function setupImageUpload(accountId) {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    
    // クリックでファイル選択（複数対応）
    dropZone.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true; // 複数ファイル選択を許可
        input.onchange = (e) => uploadImages(accountId, e.target.files);
        input.click();
    };
    
    // ドラッグ&ドロップ（複数ファイル対応）
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.background = '#e0e0e0';
    };
    
    dropZone.ondragleave = () => {
        dropZone.style.background = '';
    };
    
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            uploadImages(accountId, e.dataTransfer.files);
        }
    };
}

// 複数画像アップロード実行
async function uploadImages(accountId, files) {
    let uploadedCount = 0;
    
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            alert(`${file.name} は画像ファイルではありません`);
            continue;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch(`/accounts/${accountId}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                uploadedCount++;
            }
        } catch (err) {
            alert(`${file.name} のアップロードに失敗しました`);
        }
    }
    
    if (uploadedCount > 0) {
        alert(`${uploadedCount}枚の画像をアップロードしました`);
        loadImages(accountId); // 再読み込み
    }
}

// 画像選択（複数対応、最大4枚）
function selectImage(accountId, imageName, imgElement) {
    const imageUrl = imgElement.src;
    
    // すでに選択されているか確認
    const index = selectedImages.findIndex(img => img.src === imageUrl);
    
    if (index === -1) {
        // 選択されていない → 追加（ただし4枚まで）
        if (selectedImages.length < 4) {
            selectedImages.push({ src: imageUrl, name: imageName });
            imgElement.classList.add('selected');
        } else {
            alert('最大4枚までです');
            return;
        }
    } else {
        // すでに選択されている → 削除
        selectedImages.splice(index, 1);
        imgElement.classList.remove('selected');
    }
    
    // プレビューを更新
    updateSelectedImagesPreview();
}

// 選択画像のプレビューを更新
function updateSelectedImagesPreview() {
    const preview = document.getElementById('selected-image-preview');
    if (!preview) return;
    
    if (selectedImages.length === 0) {
        preview.innerHTML = '<p style="color:#999; margin:0;">画像を選択してください（最大4枚）</p>';
        document.getElementById('image-count').textContent = '0 / 4';
        return;
    }
    
    // 画像プレビューを4つのスロットに表示
    let html = '<div class="image-preview-multi">';
    
    for (let i = 0; i < 4; i++) {
        if (i < selectedImages.length) {
            html += `
                <div class="image-item">
                    <img src="${selectedImages[i].src}" alt="${selectedImages[i].name}">
                    <button type="button" class="remove-btn" onclick="removeSelectedImage(${i})">×</button>
                </div>
            `;
        } else {
            html += '<div class="image-item" style="background:#f0f0f0; border-radius:4px;"></div>';
        }
    }
    
    html += '</div>';
    preview.innerHTML = html;
    
    // 画像数を表示
    document.getElementById('image-count').textContent = `${selectedImages.length} / 4`;
}

// 選択画像を削除（インデックス指定）
function removeSelectedImage(index) {
    if (index >= 0 && index < selectedImages.length) {
        const imageSrc = selectedImages[index].src;
        selectedImages.splice(index, 1);
        
        // ギャラリー内の対応する画像の選択状態を解除
        document.querySelectorAll('.gallery-img').forEach(img => {
            if (img.src === imageSrc) {
                img.classList.remove('selected');
            }
        });
        
        updateSelectedImagesPreview();
    }
}

// 選択画像をすべて解除
function clearSelectedImage() {
    selectedImages = [];
    document.querySelectorAll('.gallery-img').forEach(i => i.classList.remove('selected'));
    updateSelectedImagesPreview();
}

// タイムライン描画（次回投稿を真ん中に配置）
function renderTimeline(tweets) {
    const timeline = document.getElementById('combined-timeline');
    if (!timeline) return;
    
    const now = new Date();
    
    // 投稿済みと未投稿に分類
    const posted = tweets.filter(t => t.is_posted).sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
    const scheduled = tweets.filter(t => !t.is_posted).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    
    // 次回投稿（scheduled の最初）
    const nextTweet = scheduled.length > 0 ? scheduled[0] : null;
    const otherScheduled = scheduled.slice(1);
    
    let html = '';
    
    // 最近の投稿（最大5件）
    if (posted.length > 0) {
        html += '<h4 style="color:#666; font-size:0.9em; margin:15px 0 10px 0;">最近の投稿</h4>';
        posted.slice(0, 5).forEach(t => {
            html += renderTweetItem(t, true);
        });
    }
    
    // 次回投稿（目立つように）
    if (nextTweet) {
        html += '<h4 style="color:#1da1f2; font-size:0.9em; margin:20px 0 10px 0;">📍 次回投稿</h4>';
        html += renderTweetItem(nextTweet, false, true);
    }
    
    // その他の予約
    if (otherScheduled.length > 0) {
        html += '<h4 style="color:#666; font-size:0.9em; margin:20px 0 10px 0;">予約済み</h4>';
        otherScheduled.forEach(t => {
            html += renderTweetItem(t, false);
        });
    }
    
    timeline.innerHTML = html || '<p style="color:#999;">まだ投稿がありません</p>';
}

// ツイートアイテムを描画（画像サムネイル付き）
function renderTweetItem(tweet, isPosted, isNext = false) {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('id');
    
    // 画像サムネイル生成
    let imagesHtml = '';
    try {
        const imageNames = JSON.parse(tweet.image_names || '[]');
        if (imageNames.length > 0) {
            imagesHtml = '<div style="display:flex; gap:4px; margin-top:8px; flex-wrap:wrap;">';
            imageNames.slice(0, 4).forEach(img => {
                imagesHtml += `<img src="/uploads/${accountId}/${img}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #ddd;">`;
            });
            imagesHtml += '</div>';
        }
    } catch (e) {
        // JSON解析失敗時は無視
    }
    
    const date = new Date(tweet.scheduled_at || tweet.posted_at);
    const borderStyle = isNext ? 'border-left: 4px solid #1da1f2;' : '';
    
    return `
        <div class="timeline-item ${isPosted ? 'posted' : 'scheduled'}" style="${borderStyle}">
            <div class="status-badge">${isPosted ? '✓' : '⏰'}</div>
            <p>${tweet.content || '(画像のみ)'}</p>
            ${imagesHtml}
            <small>${date.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
        </div>
    `;
}

// 4. 予約フォームの送信処理
const tweetForm = document.getElementById('tweetForm');
if (tweetForm) {
    tweetForm.onsubmit = async (e) => {
        e.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');

        const content = document.getElementById('content').value.trim();
        const scheduledAtValue = document.getElementById('scheduled_at').value;
        
        // テキストと画像の両方が空でないか確認
        if (!content && selectedImages.length === 0) {
            alert('テキストまたは画像を選択してください');
            return;
        }

        // 予約時刻が現在時刻より前でないかチェック
        const scheduledDate = new Date(scheduledAtValue);
        const now = new Date();
        if (scheduledDate <= now) {
            alert('予約時刻は現在時刻より後に設定してください');
            return;
        }

        // 画像ファイル名を取得（URLから抽出）
        const imageNames = selectedImages.map(img => {
            const parts = img.src.split('/');
            return parts[parts.length - 1]; // ファイル名のみを取得
        });

        const data = {
            content: content,
            image_names: imageNames,
            scheduled_at: scheduledAtValue
        };

        const res = await fetch(`/accounts/${id}/tweets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert('予約しました！');
            selectedImages = [];  // リセット
            location.reload(); // 再読み込みして一覧を更新
        } else {
            const error = await res.json();
            alert(`エラー: ${error.detail}`);
        }
    };
}

// ダッシュボード読み込み（index.htmlで実行）
loadAccounts();
