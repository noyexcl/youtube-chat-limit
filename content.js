const prefix = 'YouTube Live Chat Limiter - ';

class YouTubeChatLimiter {
    constructor() {
        this.enabled = false;
        this.maxComments = 50;
        this.checkInterval = 1000;
        this.intervalId = null;
        this.chat_iframe = null;
        this.items = null;

        this.init();
    }

    async init() {
        console.log(prefix + 'Load settings...');
        await this.loadSettings();

        chrome.runtime.onMessage.addListener(
            this.updateSettings.bind(this)
        );

        window.addEventListener('yt-navigate-finish', () => {
            console.log(prefix + 'Page navigation detected');
            this.chat_iframe = null;
            this.items = null;
        });

        if (this.enabled) {
            this.intervalId = setInterval(this.monitorComments.bind(this), this.checkInterval);
        }
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                enabled: false,
                maxComments: 50,
                checkInterval: 1000
            }, (items) => {
                this.enabled = items.enabled;
                this.maxComments = items.maxComments;
                this.checkInterval = items.checkInterval;
                resolve();
            });
        });
    }

    updateSettings(request, sender, sendResponse) {
        if (request.action === 'updateSettings') {
            console.log(prefix + 'Update settings');
            this.enabled = request.settings.enabled;
            this.maxComments = request.settings.maxComments;
            this.checkInterval = request.settings.checkInterval;

            console.log(prefix + 'Restart monitoring');

            if (this.intervalId !== null) {
                clearInterval(this.intervalId);
            }

            this.chat_iframe = null;
            this.items = null;

            if (this.enabled) {
                this.intervalId = setInterval(this.monitorComments.bind(this), this.checkInterval);
            }
        }
    }

    monitorComments() {
        if (this.chat_iframe === null) {
            this.chat_iframe = document.querySelector('#chatframe');

            if (this.chat_iframe !== null) {
                console.log(prefix + 'chat_iframe found');
            } else {
                return;
            }
        }

        if (this.items === null) {
            this.items = this.chat_iframe.contentDocument.querySelector('#items.yt-live-chat-item-list-renderer');

            if (this.items !== null) {
                console.log(prefix + 'items found');
                console.log(prefix + 'Start monitoring');
            } else {
                return;
            }
        }

        if (this.items.children.length > this.maxComments) {
            let remove_count = this.items.children.length - this.maxComments;

            for (let i = 0; i < remove_count; i++) {
                if (this.items.children[i] !== undefined) {
                    this.items.children[i].remove();
                }
            }
        }
    }
}

// ページが読み込まれたら初期化
if (document.readyState === 'loading') {
    console.log(prefix + 'still loading');
    document.addEventListener('DOMContentLoaded', () => {
        new YouTubeChatLimiter();
    });
} else {
    new YouTubeChatLimiter();
}
