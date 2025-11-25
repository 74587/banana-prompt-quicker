// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'banana-prompt',
        title: '🍌 Insert Banana Prompts',
        contexts: ['editable']  // 只在可编辑区域（输入框、文本框等）显示
    })
})

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'banana-prompt') {
        // 向当前标签页的 content script 发送消息
        chrome.tabs.sendMessage(tab.id, { action: 'openModal' })
    }
})
