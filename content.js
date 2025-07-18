// YouTube Live Chat Limiter - Content Script

class YouTubeChatLimiter {
    constructor() {
        this.enabled = false;
        this.maxComments = 100;
        this.checkInterval = 1000;
        this.intervalId = null;
        this.chatContainer = null;
        this.chatDocument = null;
        this.alternativeCount = 0;
        this.init();
    }

    async init() {
        // 設定を読み込み
        await this.loadSettings();

        // チャットコンテナを待機
        this.waitForChatContainer();

        // メッセージリスナーを設定
        this.setupMessageListener();

        console.log('YouTube Chat Limiter initialized');
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                enabled: false,
                maxComments: 100,
                checkInterval: 1000
            }, (items) => {
                this.enabled = items.enabled;
                this.maxComments = items.maxComments;
                this.checkInterval = items.checkInterval;
                resolve();
            });
        });
    }

    waitForChatContainer() {
        const checkForChat = () => {
            // ライブチャットのiframeを探す
            const chatFrame = document.querySelector('iframe[src*="live_chat"]');
            if (chatFrame) {
                this.setupChatObserver(chatFrame);
                return;
            }

            // チャットフレーム要素を探す
            const chatFrameElement = document.querySelector('ytd-live-chat-frame#chat');
            if (chatFrameElement) {
                const iframe = chatFrameElement.querySelector('iframe');
                if (iframe) {
                    this.setupChatObserver(iframe);
                    return;
                }
            }

            // 直接チャットコンテナを探す（埋め込みの場合）
            const chatContainer = document.querySelector('#chat-messages, #items.yt-live-chat-item-list-renderer');
            if (chatContainer) {
                this.chatContainer = chatContainer;
                this.startLimiting();
                return;
            }

            // まだ見つからない場合は少し待って再試行
            setTimeout(checkForChat, 1000);
        };

        checkForChat();
    }

    setupChatObserver(chatFrame) {
        // iframeが読み込まれるまで待機
        const waitForIframeLoad = () => {
            try {
                const chatDoc = chatFrame.contentDocument || chatFrame.contentWindow.document;
                if (!chatDoc || chatDoc.readyState !== 'complete') {
                    setTimeout(waitForIframeLoad, 500);
                    return;
                }

                // チャットコンテナを探す
                const findChatContainer = () => {
                    const selectors = [
                        '#items.yt-live-chat-item-list-renderer',
                        '#chat-messages',
                        '.yt-live-chat-item-list-renderer',
                        '#items'
                    ];

                    for (const selector of selectors) {
                        const container = chatDoc.querySelector(selector);
                        if (container) {
                            this.chatContainer = container;
                            this.chatDocument = chatDoc;
                            this.startLimiting();
                            console.log('Chat container found:', selector);
                            return;
                        }
                    }

                    // 見つからない場合は少し待って再試行
                    setTimeout(findChatContainer, 1000);
                };

                findChatContainer();
            } catch (e) {
                console.log('Cannot access chat iframe (CORS), using alternative method');
                this.setupAlternativeMethod();
            }
        };

        if (chatFrame.contentDocument) {
            waitForIframeLoad();
        } else {
            chatFrame.addEventListener('load', waitForIframeLoad);
        }
    }

    setupAlternativeMethod() {
        // iframeにアクセスできない場合の代替方法
        // より頻繁にDOMを監視してチャットの変化を検知
        let lastCount = 0;

        const checkChatUpdates = () => {
            // 親ドキュメントからiframe内のチャット数を推定
            const chatFrame = document.querySelector('iframe[src*="live_chat"]');
            if (chatFrame) {
                try {
                    const chatDoc = chatFrame.contentDocument || chatFrame.contentWindow.document;
                    if (chatDoc) {
                        const selectors = [
                            'yt-live-chat-text-message-renderer',
                            'yt-live-chat-paid-message-renderer',
                            'yt-live-chat-membership-item-renderer'
                        ];

                        let totalCount = 0;
                        selectors.forEach(selector => {
                            const items = chatDoc.querySelectorAll(selector);
                            totalCount += items.length;
                        });

                        if (totalCount !== lastCount) {
                            lastCount = totalCount;
                            this.alternativeCount = totalCount;

                            if (this.enabled && totalCount > this.maxComments) {
                                this.limitChatFromParent();
                            }
                        }
                    }
                } catch (e) {
                    // アクセスできない場合はカウントを推定
                    this.alternativeCount = this.estimateChatCount();
                }
            }
        };

        // 定期的にチェック
        setInterval(checkChatUpdates, this.checkInterval);

        // DOMの変更も監視
        const observer = new MutationObserver(() => {
            if (this.enabled) {
                checkChatUpdates();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    estimateChatCount() {
        // チャットフレームの高さやスクロール位置から推定
        const chatFrame = document.querySelector('iframe[src*="live_chat"]');
        if (chatFrame) {
            const frameHeight = chatFrame.offsetHeight;
            const estimatedMessages = Math.floor(frameHeight / 30); // 1メッセージあたり約30px
            return Math.max(0, estimatedMessages);
        }
        return 0;
    }

    startLimiting() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        if (this.enabled) {
            this.intervalId = setInterval(() => {
                this.limitChat();
            }, this.checkInterval);
        }
    }

    limitChat() {
        if (!this.chatContainer) return;

        // チャットアイテムを取得
        const chatItems = this.getChatItems();

        if (chatItems.length > this.maxComments) {
            const itemsToRemove = chatItems.length - this.maxComments;

            // 古いアイテムから削除
            for (let i = 0; i < itemsToRemove; i++) {
                if (chatItems[i] && chatItems[i].parentNode) {
                    chatItems[i].remove();
                }
            }

            console.log(`Removed ${itemsToRemove} old chat messages`);
        }
    }

    limitChatFromParent() {
        // 親フレームからチャットを制限する場合
        const chatFrame = document.querySelector('iframe[src*="live_chat"]');
        if (chatFrame) {
            try {
                const chatDoc = chatFrame.contentDocument || chatFrame.contentWindow.document;
                const chatItems = chatDoc.querySelectorAll('yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer');

                if (chatItems.length > this.maxComments) {
                    const itemsToRemove = chatItems.length - this.maxComments;

                    for (let i = 0; i < itemsToRemove; i++) {
                        if (chatItems[i] && chatItems[i].parentNode) {
                            chatItems[i].remove();
                        }
                    }
                }
            } catch (e) {
                // アクセスできない場合はスキップ
            }
        }
    }

    getChatItems() {
        if (!this.chatContainer) return [];

        const doc = this.chatDocument || document;

        // YouTubeライブチャットの様々なメッセージタイプを検索
        const selectors = [
            'yt-live-chat-text-message-renderer',
            'yt-live-chat-paid-message-renderer',
            'yt-live-chat-membership-item-renderer',
            'yt-live-chat-paid-sticker-renderer',
            'yt-live-chat-legacy-paid-message-renderer',
            'yt-live-chat-viewer-engagement-message-renderer',
            'yt-live-chat-mode-change-message-renderer',
            '.chat-line__message',
            '.message'
        ];

        let allItems = [];

        for (const selector of selectors) {
            const items = this.chatContainer.querySelectorAll(selector);
            if (items.length > 0) {
                allItems = allItems.concat(Array.from(items));
            }
        }

        // 重複を除去（同じ要素が複数のセレクターにマッチする場合）
        const uniqueItems = [...new Set(allItems)];

        console.log(`Found ${uniqueItems.length} chat items`);
        return uniqueItems;
    }

    getCurrentCount() {
        const count = this.getChatItems().length;
        console.log(`Current chat count: ${count}`);
        return count;
    }

    updateSettings(settings) {
        this.enabled = settings.enabled;
        this.maxComments = settings.maxComments;
        this.checkInterval = settings.checkInterval;

        // インターバルを再設定
        this.startLimiting();

        console.log('Settings updated:', settings);
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateSettings') {
                this.updateSettings(request.settings);
                sendResponse({ success: true });
            } else if (request.action === 'getCurrentCount') {
                let count = this.getCurrentCount();

                // 代替方法を使用している場合
                if (count === 0 && this.alternativeCount !== undefined) {
                    count = this.alternativeCount;
                }

                // さらに詳細な検索を試行
                if (count === 0) {
                    count = this.getDetailedChatCount();
                }

                sendResponse({ count: count });
            }
            return true; // 非同期レスポンスのため
        });
    }

    getDetailedChatCount() {
        // より詳細なチャット数取得を試行
        const chatFrame = document.querySelector('iframe[src*="live_chat"]');
        if (chatFrame) {
            try {
                const chatDoc = chatFrame.contentDocument || chatFrame.contentWindow.document;
                if (chatDoc) {
                    // 全ての可能なセレクターを試す
                    const allSelectors = [
                        'yt-live-chat-text-message-renderer',
                        'yt-live-chat-paid-message-renderer',
                        'yt-live-chat-membership-item-renderer',
                        'yt-live-chat-paid-sticker-renderer',
                        'yt-live-chat-legacy-paid-message-renderer',
                        'yt-live-chat-viewer-engagement-message-renderer',
                        '[class*="message"]',
                        '[id*="message"]'
                    ];

                    let maxCount = 0;
                    allSelectors.forEach(selector => {
                        const items = chatDoc.querySelectorAll(selector);
                        maxCount = Math.max(maxCount, items.length);
                    });

                    return maxCount;
                }
            } catch (e) {
                console.log('Cannot access chat iframe for detailed count');
            }
        }

        return 0;
    }
}

// ページが読み込まれたら初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new YouTubeChatLimiter();
    });
} else {
    new YouTubeChatLimiter();
}