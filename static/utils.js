// DOM元素
let addBtn = document.getElementById('add-btn');
let newContent = document.getElementById('new-content');
let sentenceList = document.getElementById('sentence-list');
let toast = document.getElementById('toast');

// 所有句子数据

// 所有句子数据
let allSentences = [];

// 轮询间隔（毫秒）
const pollingInterval = 5000;

// 初始化
function init() {
    // 加载句子数据
    loadSentences();
    
    // 开始轮询
    startPolling();
    
    // 绑定事件
    bindEvents();
}

// 轮询ID，用于管理定时器
let pollingId = null;

// 开始轮询数据
function startPolling() {
    // 立即执行一次
    loadSentences();
    
    // 设置定时器定期轮询
    pollingId = setInterval(loadSentences, pollingInterval);
    
    // 添加页面可见性变化监听器
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// 停止轮询
function stopPolling() {
    if (pollingId !== null) {
        clearInterval(pollingId);
        pollingId = null;
    }
}

// 处理页面可见性变化
function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        // 页面不可见时停止轮询
        stopPolling();
    } else if (document.visibilityState === 'visible') {
        // 页面可见时重新启动轮询
        if (pollingId === null) {
            // 立即加载一次数据
            loadSentences();
            // 重新设置轮询
            pollingId = setInterval(loadSentences, pollingInterval);
        }
    }
}

// 加载句子数据
async function loadSentences() {
    try {
        const response = await fetch('/api/sentences');
        if (!response.ok) {
            throw new Error('加载失败');
        }
        
        // 确保allSentences始终是一个数组
        const data = await response.json();
        allSentences = Array.isArray(data) ? data : [];
        renderSentences();
    } catch (error) {
        console.error('加载句子失败:', error);
        // 出错时将allSentences重置为空数组，防止渲染失败
        allSentences = [];
        renderSentences();
        // 仅记录错误，不显示给用户
    }
}



// 渲染句子列表
function renderSentences() {
    if (allSentences.length === 0) {
        sentenceList.innerHTML = `
            <div class="empty-state">
                <h3>暂无数据</h3>
                <p>请添加您的第一个句子</p>
            </div>
        `;
        return;
    }
    
    // 移除所有现有卡片，避免动画冲突
    while (sentenceList.firstChild) {
        sentenceList.removeChild(sentenceList.firstChild);
    }
    
    // 添加句子卡片
    allSentences.forEach(sentence => {
        const card = document.createElement('div');
        card.className = 'sentence-card';
        card.setAttribute('data-id', sentence.id);
        card.innerHTML = `
            <div class="sentence-content">${escapeHtml(sentence.content)}</div>
            <div class="sentence-actions">
                <button class="action-btn delete-btn" data-id="${sentence.id}">删除</button>
            </div>
        `;
        sentenceList.appendChild(card);
    });
    
    // 绑定卡片上的事件
    bindCardEvents();
}

// 渲染句子卡片时不显示分组标签，而是通过切换分组标签来筛选

// 绑定卡片上的事件
function bindCardEvents() {
    // 处理点击事件 - 核心优化版，完全消除页面动荡
    function handleCardTap(e) {
        // 如果点击的是删除按钮，不执行复制操作
        if (e.target.closest('.delete-btn')) {
            return;
        }
                
        const cardElement = this;
        const id = this.getAttribute('data-id');
        const sentence = allSentences.find(s => s.id === parseInt(id));
        
        try {
            // 添加点击视觉反馈效果
            cardElement.classList.add('clicked');
            // 短暂延迟后移除效果
            setTimeout(() => {
                cardElement.classList.remove('clicked');
            }, 200);
            
            // 使用现代的Clipboard API，避免创建DOM元素和焦点操作
            if (navigator.clipboard && window.isSecureContext) {
                // 首选使用现代API
                navigator.clipboard.writeText(sentence.content)
                    .then(() => {
                        // 不再需要更新计数，直接显示成功提示
                        showToast('复制成功！');
                        // 显示功德+1动画
                        showMeritAnimation(cardElement);
                    })
                    .catch(() => {
                        // 降级到备用方法
                        fallbackCopyText(sentence.content);
                    });
            } else {
                // 降级到备用方法
                fallbackCopyText(sentence.content);
            }
            
            // 定义备用复制方法
            function fallbackCopyText(text) {
                // 使用Selection API创建不可见的选择
                const selection = window.getSelection();
                const originalRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                
                // 创建一个隐藏的临时元素
                const tempDiv = document.createElement('div');
                tempDiv.textContent = text;
                tempDiv.style.position = 'fixed';
                tempDiv.style.left = '-9999px';
                tempDiv.style.top = '-9999px';
                tempDiv.style.opacity = '0';
                tempDiv.style.pointerEvents = 'none';
                tempDiv.style.userSelect = 'text';
                tempDiv.style.webkitUserSelect = 'text';
                tempDiv.style.MozUserSelect = 'text';
                tempDiv.style.msUserSelect = 'text';
                document.body.appendChild(tempDiv);
                
                // 创建选择范围但不聚焦
                const range = document.createRange();
                range.selectNodeContents(tempDiv);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // 执行复制
                let success = false;
                try {
                    success = document.execCommand('copy');
                } catch (err) {
                    console.error('复制失败:', err);
                }
                
                // 恢复原始选择
                selection.removeAllRanges();
                if (originalRange) {
                    selection.addRange(originalRange);
                }
                
                // 移除临时元素
                document.body.removeChild(tempDiv);
                
                // 不再需要更新计数，直接显示提示
                showToast(success ? '复制成功！' : '复制失败，请手动复制', success ? '' : 'error');
                // 如果复制成功，显示功德+1动画
                if (success) {
                    showMeritAnimation(cardElement);
                }
            }
            
            // 不再需要更新复制计数，因为我们已经移除了相关显示功能
            function updateCopyCount() {
                // 空函数，保留调用接口的兼容性
            }
            
            // 移除不必要的复制计数更新请求
            
            // 恢复toast提示，但使用优化的方式
            showToast('复制成功！');
        } catch (error) {
            // 恢复错误提示
            showToast('复制失败，请手动复制', 'error');
            console.error('复制失败:', error);
        }
    }
    
    // 句子卡片事件绑定 - 使用优化的绑定方式
    document.querySelectorAll('.sentence-card').forEach(card => {
        // 移除所有可能的旧事件监听器
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        // 只绑定click事件
        newCard.addEventListener('click', handleCardTap);
    });
    
    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            
            if (confirm('确定要删除这个句子吗？')) {
                deleteSentence(id);
            }
        });
    });
}

// 绑定事件 - 简化版本，确保添加句子功能正常工作
function bindEvents() {
    // 检查并绑定添加按钮的点击事件
    const btn = document.getElementById('add-btn');
    if (btn) {
        btn.addEventListener('click', function() {
            addSentence();
        });
    }
    
    // 检查并绑定输入框的回车事件
    const input = document.getElementById('new-content');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                addSentence();
            }
        });
    }
    
    // 添加全局ESC键监听
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // ESC键可以用于未来的模态窗口或弹窗
        }
    });
}

async function addSentence() {
    // 验证输入
    if (!newContent.value.trim()) {
        showToast('请输入内容', 'error');
        return;
    }
    
    // 禁用按钮防止重复提交
    addBtn.disabled = true;
    addBtn.textContent = '添加中...';
    
    try {
        // 准备数据
        const data = {
            content: newContent.value.trim()
        };
        
        // 发送POST请求
        const response = await fetch('/api/sentences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('添加失败');
        }
        
        // 清空输入框
        newContent.value = '';
        
        // 刷新句子列表
        await loadSentences();
        
        // 显示成功提示
        showToast('添加成功');
        
    } catch (error) {
        console.error('添加句子失败:', error);
        showToast('添加失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        addBtn.disabled = false;
        addBtn.textContent = '添加话术';
    }
}

// 删除句子
async function deleteSentence(id) {
    try {
        const response = await fetch(`/api/sentences/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('删除失败');
        }
        
        showToast('删除成功！');
        
        // 重新加载句子
        loadSentences();
    } catch (error) {
        showToast('删除失败，请重试', 'error');
        console.error('删除句子失败:', error);
    }
}

// 显示提示框 - 完全优化版，确保绝对不会导致页面动荡
function showToast(message, type = 'success') {
    // 确保toast元素存在
    if (!toast) return;
    
    // 移除任何可能的定时器，避免冲突
    if (toast._timeoutId) {
        clearTimeout(toast._timeoutId);
    }
    
    // 预先计算所有样式，减少重排
    const bgColor = type === 'error' ? 'rgba(235, 87, 87, 0.9)' : 'rgba(0, 0, 0, 0.8)';
    
    // 使用requestAnimationFrame确保DOM更新的最佳时机
    requestAnimationFrame(() => {
        // 一次性设置所有样式和内容
        toast.textContent = message;
        toast.style.backgroundColor = bgColor;
        toast.style.opacity = '1';
        // 确保定位稳定
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.zIndex = '10000';
        toast.style.pointerEvents = 'none';
        toast.style.boxSizing = 'border-box';
        toast.style.minWidth = '100px';
        toast.style.maxWidth = '80%';
        toast.style.textAlign = 'center';
    });
    
    // 延迟隐藏，使用requestAnimationFrame优化
    toast._timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
            if (toast) {
                toast.style.opacity = '0';
            }
        });
    }, 1500);
}

// 显示功德+1动画
function showMeritAnimation(element) {
    // 创建功德+1元素
    const meritElement = document.createElement('div');
    meritElement.className = 'merit-animation';
    meritElement.textContent = '功德+1';
    
    // 设置初始位置 - 相对于点击的元素
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2; // 元素中心点
    const y = rect.top;
    
    // 只保留基本位置样式
    meritElement.style.position = 'fixed';
    meritElement.style.left = x + 'px';
    meritElement.style.top = y + 'px';
    meritElement.style.pointerEvents = 'none';
    meritElement.style.zIndex = '1000';
    
    // 添加到页面，CSS动画会自动触发
    document.body.appendChild(meritElement);
    
    // 动画结束后移除元素
    setTimeout(() => {
        if (meritElement.parentNode) {
            document.body.removeChild(meritElement);
        }
    }, 1000);
}

// HTML转义
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);