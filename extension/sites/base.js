class BaseSite {
    constructor() {
        this.modal = null;
        this._buttonInserting = false;
        this._pollTimer = null;
        this._mutationTimer = null;
        this.lastFocusedElement = document.addEventListener('focusin', (e) => {
            if (this.isEditableElement(e.target)) {
                this.lastFocusedElement = e.target;
            }
        });
    }

    getCurrentTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getThemeColors() {
        const theme = this.getCurrentTheme();
        if (theme === 'dark') {
            return {
                background: '#141414',
                surface: '#1c1c1e',
                border: '#38383a',
                text: '#f5f5f7',
                textSecondary: '#98989d',
                primary: '#0a84ff',
                hover: '#2c2c2e',
                inputBg: '#1c1c1e',
                inputBorder: '#38383a',
                shadow: 'rgba(0,0,0,0.5)'
            };
        }
        return {
            background: '#ffffff',
            surface: '#f5f5f7',
            border: '#d2d2d7',
            text: '#1d1d1f',
            textSecondary: '#6e6e73',
            primary: '#007aff',
            hover: '#e8e8ed',
            inputBg: '#ffffff',
            inputBorder: '#d2d2d7',
            shadow: 'rgba(0,0,0,0.1)'
        };
    }

    async getRemoteSelector(platform, type) {
        if (window.ConfigManager) {
            const c = await window.ConfigManager.get();
            return c?.selectors?.[platform]?.[type];
        }
        return null;
    }

    async findElement(platform, type, localSelector) {
        let el = window.DOM.querySelectorShadowDom(localSelector);
        if (el) return el;

        // Fallback
        console.log('Not found el for ' + localSelector + '. Fallback to remote selector');
        const s = await this.getRemoteSelector(platform, type);
        return window.DOM.querySelectorShadowDom(s);
    }

    async findPromptInput() {
        if (this.lastFocusedElement && this.isEditableElement(this.lastFocusedElement)) {
            return this.lastFocusedElement;
        }

        const active = document.activeElement;
        if (this.isEditableElement(active)) {
            return active;
        }
        return null;
    }

    async findTargetButton() { return null; }

    insertButton(btn, target) {
        if (document.getElementById('banana-btn')) return true;
        target.insertAdjacentElement('afterend', btn)
    }

    async _insertButtonIfNotExists() {
        if (window.DOM.querySelectorShadowDom('#banana-btn')) return true;

        try {
            const target = await this.findTargetButton();
            if (!target) return false;

            // Double check: ensure button doesn't exist globally (Shadow DOM or Document)
            if (window.DOM.querySelectorShadowDom('#banana-btn')) return true;

            const btn = this.createButton();
            if (!btn) return false;

            this.insertButton(btn, target);
            return true;

        } catch (e) {
            console.error('Failed to init button:', e);
            return false;
        }
    }

    async _ensureButton() {
        if (this._buttonInserting) return;
        this._buttonInserting = true;

        if (window.DOM.querySelectorShadowDom('#banana-btn')) {
            this._buttonInserting = false;
            return;
        }

        if (this._pollTimer) clearInterval(this._pollTimer);

        // Try immediately
        const success = await this._insertButtonIfNotExists();
        if (success) {
            this._buttonInserting = false;
            return;
        }

        let attempts = 0;
        const maxAttempts = 20;
        this._pollTimer = setInterval(async () => {
            attempts++;
            const success = await this._insertButtonIfNotExists();
            if (success || attempts >= maxAttempts) {
                clearInterval(this._pollTimer);
                this._pollTimer = null;
                this._buttonInserting = false;
            }
        }, 200);
    }

    async ensureButtonByWatch() {
        // Init
        this._handleMutation();

        // Handle changed.
        const observer = new MutationObserver(() => {
            this._debouncedHandleMutation();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Handle navigation.
        const handler = () => this._handleMutation();
        window.addEventListener('popstate', handler);
        window.addEventListener('pushstate', handler);
        window.addEventListener('replacestate', handler);
    }

    _debouncedHandleMutation() {
        if (this._mutationTimer) clearTimeout(this._mutationTimer);
        this._mutationTimer = setTimeout(() => {
            this._handleMutation();
        }, 50);
    }

    async _handleMutation() {
        const btn = window.DOM.querySelectorShadowDom('#banana-btn');
        const target = await this.findTargetButton();

        if (btn && !target) {
            // Target is gone, remove button
            btn.remove();
        }

        if (!btn && target) {
            this._ensureButton();
        }
    }

    createButton() {
        const btn = window.DOM.create('button', {
            id: 'banana-btn',
            className: 'mat-mdc-tooltip-trigger ms-button-borderless ms-button-icon',
            title: '快捷提示',
            textContent: '🍌',
            onmouseenter: (e) => {
                e.currentTarget.style.background = this.getThemeColors().border;
            },
            onmouseleave: (e) => {
                e.currentTarget.style.background = this.getThemeColors().hover;
            },
            onclick: () => {
                if (this.modal) this.modal.show();
            }
        });

        const updateButtonTheme = () => {
            const colors = this.getThemeColors();
            btn.style.cssText = `width: 40px; height: 40px; border-radius: 50%; border: none; background: ${colors.hover}; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 8px; transition: background-color 0.2s;`;
        };

        updateButtonTheme();

        return window.DOM.create('div', {
            className: 'button-wrapper'
        }, [btn]);
    }

    isEditableElement(el) {
        if (!el) return false;
        return el.tagName === 'TEXTAREA' ||
            (el.tagName === 'INPUT' && ['text', 'search', 'email', 'url'].includes(el.type)) ||
            el.isContentEditable;
    }

    async insertPrompt(promptData) {
        const promptText = typeof promptData === 'string' ? promptData : promptData.prompt;
        const referenceImages = typeof promptData === 'object' ? promptData.referenceImages : null;

        const el = await this.findPromptInput();
        if (!el || !this.isEditableElement(el)) {
            return;
        }

        // Clear existing content
        if (el.isContentEditable) {
            el.innerHTML = '';
        } else {
            el.value = '';
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));

        if (referenceImages && referenceImages.length > 0) {
            await this.insertImages(referenceImages);
            await new Promise(r => setTimeout(r, 800));
        }

        if (el.isContentEditable) {
            const selection = window.getSelection();
            let inserted = false;

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (el.contains(range.commonAncestorContainer)) {
                    range.deleteContents();

                    const lines = promptText.split('\n');
                    const fragment = document.createDocumentFragment();

                    lines.forEach((line, index) => {
                        fragment.appendChild(document.createTextNode(line));
                        if (index < lines.length - 1) {
                            fragment.appendChild(document.createElement('br'));
                        }
                    });

                    range.insertNode(fragment);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    inserted = true;
                }
            }

            if (!inserted) {
                const htmlContent = promptText.split('\n').map(line => {
                    const escaped = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    return `<p>${escaped || '<br>'}</p>`;
                }).join('');
                el.innerHTML += htmlContent;

                // Move cursor to end
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const currentValue = el.value;

            const newValue = currentValue.substring(0, start) + promptText + currentValue.substring(end);
            el.value = newValue;

            const newCursorPos = start + promptText.length;
            el.setSelectionRange(newCursorPos, newCursorPos);

            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.focus();
        }

        if (this.modal) {
            this.modal.hide();
        }
    }

    async insertImages(images) {
        const target = await this.findPromptInput();
        if (!target) return;

        const files = [];
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const filename = `image${i + 1}.jpg`;
            try {
                let file;
                if (img.startsWith('http')) {
                    file = await window.Utils.urlToFile(img, filename);
                } else {
                    file = window.Utils.base64ToFile(img, filename);
                }
                files.push(file);
            } catch (e) {
                console.error('Banana: Failed to process image:', e);
            }
        }
        if (files.length === 0) return;

        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });

        target.dispatchEvent(pasteEvent);
    }
};
