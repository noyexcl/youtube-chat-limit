document.addEventListener('DOMContentLoaded', function () {
    const enableToggle = document.getElementById('enableToggle');
    const maxCommentsInput = document.getElementById('maxComments');
    const checkIntervalInput = document.getElementById('checkInterval');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // 設定を読み込み
    chrome.storage.sync.get({
        enabled: false,
        maxComments: 100,
        checkInterval: 1000
    }, function (items) {
        enableToggle.classList.toggle('active', items.enabled);
        maxCommentsInput.value = items.maxComments;
        checkIntervalInput.value = items.checkInterval;
    });

    // トグルボタンの処理
    enableToggle.addEventListener('click', function () {
        enableToggle.classList.toggle('active');
    });

    // 保存ボタンの処理
    saveBtn.addEventListener('click', function () {
        // 保存前に入力値を検証
        let maxComments = parseInt(maxCommentsInput.value);
        let checkInterval = parseInt(checkIntervalInput.value);

        // バリデーション
        if (isNaN(maxComments) || maxComments < 10) {
            maxComments = 10;
            maxCommentsInput.value = 10;
        } else if (maxComments > 1000) {
            maxComments = 1000;
            maxCommentsInput.value = 1000;
        }

        if (isNaN(checkInterval) || checkInterval < 500) {
            checkInterval = 500;
            checkIntervalInput.value = 500;
        } else if (checkInterval > 5000) {
            checkInterval = 5000;
            checkIntervalInput.value = 5000;
        }

        const settings = {
            enabled: enableToggle.classList.contains('active'),
            maxComments: maxComments,
            checkInterval: checkInterval
        };

        chrome.storage.sync.set(settings, function () {
            // コンテントスクリプトに設定変更を通知
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0].url.includes('youtube.com/watch')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateSettings',
                        settings: settings
                    });
                }
            });

            // 保存完了メッセージを表示
            status.textContent = '設定を保存しました';
            status.className = 'status success';
            status.style.display = 'block';

            setTimeout(function () {
                status.style.display = 'none';
            }, 2000);
        });
    });

    // 入力値の検証
    maxCommentsInput.addEventListener('blur', function () {
        const value = parseInt(this.value);
        if (isNaN(value) || value < 10) {
            this.value = 10;
        } else if (value > 1000) {
            this.value = 1000;
        }
    });

    maxCommentsInput.addEventListener('input', function () {
        // 入力中は検証しない（空文字や途中の数値を許可）
        const value = this.value;
        if (value === '') return;

        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue > 1000) {
            this.value = 1000;
        }
    });

    checkIntervalInput.addEventListener('blur', function () {
        const value = parseInt(this.value);
        if (isNaN(value) || value < 500) {
            this.value = 500;
        } else if (value > 5000) {
            this.value = 5000;
        }
    });

    checkIntervalInput.addEventListener('input', function () {
        // 入力中は検証しない（空文字や途中の数値を許可）
        const value = this.value;
        if (value === '') return;

        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue > 5000) {
            this.value = 5000;
        }
    });
});