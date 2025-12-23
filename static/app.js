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
        <div class="card" style="cursor: pointer;" onclick="location.href='account_detail.html?id=${acc.id}'">
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

// 画像一覧の読み込み
async function loadImages(accountId) {
    const res = await fetch(`/accounts/${accountId}/images`);
    const images = await res.json();
    
    const gallery = document.getElementById('image-gallery');
    if (!gallery) return;
    
    gallery.innerHTML = images.map(img => `
        <img src="/uploads/${accountId}/${img}" alt="${img}" onclick="selectImage(this)">
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

// 画像選択
function selectImage(img) {
    document.querySelectorAll('.gallery img').forEach(i => i.classList.remove('selected'));
    img.classList.add('selected');
}

// タイムライン描画
function renderTimeline(tweets) {
    const timeline = document.getElementById('combined-timeline');
    if (!timeline) return; // タイムラインが存在しない場合は終了
    
    // 日付順（新しい順）にソート
    const sorted = tweets.sort((a, b) => {
        const dateA = new Date(b.scheduled_at || b.posted_at);
        const dateB = new Date(a.scheduled_at || a.posted_at);
        return dateB - dateA;
    });

    timeline.innerHTML = sorted.map(t => `
        <div class="timeline-item ${t.is_posted ? 'posted' : 'scheduled'}">
            <div class="status-badge">${t.is_posted ? '✓' : '⏰'}</div>
            <p>${t.content}</p>
            <small>${new Date(t.scheduled_at || t.posted_at).toLocaleString()}</small>
        </div>
    `).join('') || '<p>まだ投稿がありません</p>';
}

// 4. 予約フォームの送信処理
const tweetForm = document.getElementById('tweetForm');
if (tweetForm) {
    tweetForm.onsubmit = async (e) => {
        e.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');

        const data = {
            content: document.getElementById('content').value,
            scheduled_at: document.getElementById('scheduled_at').value
        };

        const res = await fetch(`/accounts/${id}/tweets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert('予約しました！');
            location.reload(); // 再読み込みして一覧を更新
        }
    };
}

// ダッシュボード読み込み（index.htmlで実行）
loadAccounts();
