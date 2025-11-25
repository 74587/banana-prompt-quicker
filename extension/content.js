// 默认主题颜色配置
function getDefaultThemeColors(theme = 'light') {
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
        }
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
    }
}

async function getRemoteSelector(platform, type) {
    const CACHE_KEY = 'selector_config'
    const CACHE_DURATION = 2 * 60 * 1000 // 2分钟
    const CONFIG_URL = 'https://raw.githubusercontent.com/glidea/banana-prompt-quicker/main/selectors.json'

    // 1. 尝试从缓存获取
    const cached = await chrome.storage.local.get(CACHE_KEY)
    if (cached[CACHE_KEY]) {
        const { data, timestamp } = cached[CACHE_KEY]
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data[platform]?.[type]
        }
    }

    // 2. 请求远程配置
    try {
        const response = await fetch(CONFIG_URL)
        const config = await response.json()

        // 缓存配置
        await chrome.storage.local.set({
            [CACHE_KEY]: {
                data: config,
                timestamp: Date.now()
            }
        })

        return config[platform]?.[type]
    } catch (error) {
        console.warn('获取远程 selector 失败:', error)
        // 降级:使用过期缓存
        return cached[CACHE_KEY]?.data?.[platform]?.[type]
    }
}

class AIStudioAdapter {
    constructor() {
        this.modal = null
        this._initializingButton = false
    }

    async findPromptInput() {
        let el = document.querySelector('ms-prompt-input-wrapper textarea')
        if (el) {
            return el
        }

        // Fallback.
        const s = await getRemoteSelector('aistudio', 'promptInput')
        return document.querySelector(s)
    }

    async findClosestInsertButton() {
        let el = document.querySelector('ms-run-button button')
        if (el) {
            return el
        }

        // Fallback.
        const s = await getRemoteSelector('aistudio', 'insertButton')
        return document.querySelector(s)
    }

    getCurrentTheme() {
        return document.body.classList.contains('dark-theme') ? 'dark' : 'light'
    }

    getThemeColors() {
        return getDefaultThemeColors(this.getCurrentTheme())
    }

    createButton() {
        const wrapper = document.createElement('div')
        wrapper.className = 'button-wrapper'

        const btn = document.createElement('button')
        btn.id = 'banana-btn'
        btn.className = 'mat-mdc-tooltip-trigger ms-button-borderless ms-button-icon'

        const updateButtonTheme = () => {
            const colors = this.getThemeColors()
            btn.style.cssText = `width: 40px; height: 40px; border-radius: 50%; border: none; background: ${colors.hover}; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 8px; transition: background-color 0.2s;`
        }

        updateButtonTheme()
        btn.title = '快捷提示'
        btn.textContent = '🍌'

        btn.addEventListener('mouseenter', () => {
            const colors = this.getThemeColors()
            btn.style.background = colors.border
        })
        btn.addEventListener('mouseleave', () => {
            const colors = this.getThemeColors()
            btn.style.background = colors.hover
        })

        btn.addEventListener('click', () => {
            if (this.modal) {
                this.modal.show()
            }
        })

        wrapper.appendChild(btn)
        return wrapper
    }

    async initButton() {
        if (document.getElementById('banana-btn')) {
            return true
        }

        if (this._initializingButton) {
            return false
        }

        this._initializingButton = true
        try {
            const runButton = await this.findClosestInsertButton()
            if (!runButton) {
                return false
            }

            const bananaBtn = this.createButton()
            const buttonWrapper = runButton.parentElement

            try {
                buttonWrapper.parentElement.insertBefore(bananaBtn, buttonWrapper)
            } catch (error) {
                console.error('插入香蕉按钮失败:', error)
                buttonWrapper.insertAdjacentElement('beforebegin', bananaBtn)
            }

            return true
        } finally {
            this._initializingButton = false
        }
    }

    async insertPrompt(promptText) {
        const textarea = await this.findPromptInput()
        if (textarea) {
            textarea.value = promptText
            textarea.dispatchEvent(new Event('input', { bubbles: true }))

            textarea.focus()
            const length = promptText.length
            textarea.setSelectionRange(length, length)

            if (this.modal) {
                this.modal.hide()
            }
        }
    }

    waitForElements() {
        const checkInterval = setInterval(async () => {
            const input = await this.findPromptInput()
            if (input) {
                const success = await this.initButton()
                if (success) {
                    clearInterval(checkInterval)
                }
            }
        }, 1000)
    }

    startObserver() {
        const observer = new MutationObserver(() => {
            const existingBtn = document.getElementById('banana-btn')

            if (!existingBtn) {
                this.initButton()
            }
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true
        })
    }
}

class GeminiAdapter {
    constructor() {
        this.modal = null
        this._initializingButton = false
    }

    async findPromptInput() {
        let el = document.querySelector('div.ql-editor[contenteditable="true"]')
        if (el) {
            return el
        }

        // Fallback.
        const selector = await getRemoteSelector('gemini', 'promptInput')
        return document.querySelector(selector)
    }

    async findClosestInsertButton() {
        let el = document.querySelector('button.toolbox-drawer-item-deselect-button:has(img.img-icon)')
        if (el) {
            return el
        }

        // Fallback.
        const s = await getRemoteSelector('gemini', 'insertButton')
        return document.querySelector(s)
    }

    getCurrentTheme() {
        return document.body.classList.contains('dark-theme') ||
            document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    }

    getThemeColors() {
        return getDefaultThemeColors(this.getCurrentTheme())
    }

    createButton() {
        const isMobile = window.innerWidth <= 768

        const btn = document.createElement('button')
        btn.id = 'banana-btn'
        btn.className = 'mat-mdc-button mat-mdc-button-base mat-unthemed'

        const updateButtonTheme = () => {
            const colors = this.getThemeColors()
            const mobile = window.innerWidth <= 768
            btn.style.cssText = `
                height: 40px;
                ${mobile ? 'width: 40px;' : ''}
                border-radius: ${mobile ? '50%' : '20px'};
                border: none;
                background: transparent;
                color: ${colors.text};
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-family: 'Google Sans', Roboto, Arial, sans-serif;
                margin-left: 4px;
                transition: background-color 0.2s;
                padding: ${mobile ? '0' : '0 16px'};
                gap: ${mobile ? '0' : '8px'};
            `
        }

        updateButtonTheme()
        btn.title = '快捷提示'
        btn.innerHTML = isMobile
            ? '<span style="font-size: 18px;">🍌</span>'
            : '<span style="font-size: 16px;">🍌</span><span>Prompts</span>'

        btn.addEventListener('mouseenter', () => {
            const colors = this.getThemeColors()
            btn.style.background = colors.hover
        })
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent'
        })

        btn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (this.modal) {
                this.modal.show()
            }
        })

        return btn
    }

    async initButton() {
        if (document.getElementById('banana-btn')) {
            return true
        }

        if (this._initializingButton) {
            return false
        }

        this._initializingButton = true
        try {
            const imageBtn = await this.findClosestInsertButton()
            if (!imageBtn) {
                return false
            }

            const bananaBtn = this.createButton()
            try {
                imageBtn.insertAdjacentElement('afterend', bananaBtn)
            } catch (error) {
                console.error('插入香蕉按钮失败:', error)
                return false
            }

            return true
        } finally {
            this._initializingButton = false
        }
    }

    async insertPrompt(promptText) {
        const textarea = await this.findPromptInput()
        if (textarea) {
            const lines = promptText.split('\n')
            const htmlContent = lines.map(line => {
                const escaped = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                return `<p>${escaped || '<br>'}</p>`
            }).join('')

            textarea.innerHTML = htmlContent
            textarea.dispatchEvent(new Event('input', { bubbles: true }))

            // 聚焦并将光标定位到文字末尾
            textarea.focus()
            const range = document.createRange()
            const sel = window.getSelection()
            range.selectNodeContents(textarea)
            range.collapse(false) // false 表示折叠到末尾
            sel.removeAllRanges()
            sel.addRange(range)

            if (this.modal) {
                this.modal.hide()
            }
        }
    }

    waitForElements() {
    }

    startObserver() {
        const observer = new MutationObserver(async () => {
            const existingBtn = document.getElementById('banana-btn')
            const imageBtn = await this.findClosestInsertButton()

            if (imageBtn) {
                if (!existingBtn) {
                    await this.initButton()
                }
            } else {
                if (existingBtn) {
                    existingBtn.remove()
                }
            }
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true
        })
    }
}

// 通用适配器，用于任意网站
class UniversalAdapter {
    constructor() {
        this.modal = null
        this.lastFocusedElement = null
        this.trackFocusedElement()
    }

    // 跟踪最后聚焦的可编辑元素
    trackFocusedElement() {
        document.addEventListener('focusin', (e) => {
            if (this.isEditableElement(e.target)) {
                this.lastFocusedElement = e.target
            }
        })
    }

    isEditableElement(el) {
        if (!el) return false
        return el.tagName === 'TEXTAREA' ||
            (el.tagName === 'INPUT' && ['text', 'search', 'email', 'url'].includes(el.type)) ||
            el.isContentEditable
    }

    async findPromptInput() {
        // 优先使用最后聚焦的元素
        if (this.lastFocusedElement && this.isEditableElement(this.lastFocusedElement)) {
            return this.lastFocusedElement
        }
        // fallback 到当前激活元素
        const active = document.activeElement
        if (this.isEditableElement(active)) {
            return active
        }
        return null
    }

    async insertPrompt(promptText) {
        const el = await this.findPromptInput()
        if (!el || !this.isEditableElement(el)) {
            alert('🍌 请先点击输入框，然后再右键选择 Banana Prompts')
            return
        }

        if (el.isContentEditable) {
            // contenteditable 处理 - 在光标位置插入
            const selection = window.getSelection()
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                range.deleteContents()

                const lines = promptText.split('\n')
                const fragment = document.createDocumentFragment()

                lines.forEach((line, index) => {
                    const textNode = document.createTextNode(line)
                    fragment.appendChild(textNode)
                    if (index < lines.length - 1) {
                        fragment.appendChild(document.createElement('br'))
                    }
                })

                range.insertNode(fragment)
                range.collapse(false)
                selection.removeAllRanges()
                selection.addRange(range)
            } else {
                // 如果没有选区，追加到末尾
                const htmlContent = promptText.split('\n').map(line => {
                    const escaped = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                    return `<p>${escaped || '<br>'}</p>`
                }).join('')
                el.innerHTML += htmlContent
            }
            el.dispatchEvent(new Event('input', { bubbles: true }))
        } else {
            // textarea/input 处理 - 在光标位置插入
            const start = el.selectionStart
            const end = el.selectionEnd
            const currentValue = el.value

            const newValue = currentValue.substring(0, start) + promptText + currentValue.substring(end)
            el.value = newValue

            // 设置光标位置到插入内容之后
            const newCursorPos = start + promptText.length
            el.setSelectionRange(newCursorPos, newCursorPos)

            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.focus()
        }

        if (this.modal) {
            this.modal.hide()
        }
    }

    getCurrentTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    getThemeColors() {
        return getDefaultThemeColors(this.getCurrentTheme())
    }

    // 通用适配器不需要按钮
    initButton() { return false }
    waitForElements() { }
    startObserver() { }
}

function init() {
    const hostname = window.location.hostname
    let adapter

    if (hostname.includes('aistudio')) {
        adapter = new AIStudioAdapter()
    } else if (hostname.includes('gemini')) {
        adapter = new GeminiAdapter()
    } else {
        // 其他网站使用通用适配器
        adapter = new UniversalAdapter()
    }

    const modal = new BananaModal(adapter)
    adapter.modal = modal

    // 只在特定平台初始化按钮和观察器
    if (hostname.includes('aistudio') || hostname.includes('gemini')) {
        adapter.waitForElements()
        adapter.startObserver()

        const handleNavigationChange = () => {
            setTimeout(() => {
                adapter.initButton()
            }, 1000)
        }
        window.addEventListener('popstate', handleNavigationChange)
        window.addEventListener('pushstate', handleNavigationChange)
        window.addEventListener('replacestate', handleNavigationChange)
    }

    // 监听来自 background 的消息（右键菜单点击）
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'openModal') {
            if (modal) {
                modal.show()
            }
        }
    })
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init()
} else {
    window.addEventListener('load', init)
}