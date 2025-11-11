// DOM元素 - 使用let而不是const，因为我们需要在运行时更新这些引用
let addBtn = document.getElementById('add-btn');
let newContent = document.getElementById('new-content');
let newGroup = document.getElementById('new-group');
let sentenceList = document.getElementById('sentence-list');
let groupTabs = document.getElementById('group-tabs');
let toast = document.getElementById('toast');

// 当前选中的分组
let currentGroup = '';

// 当前右键点击的分组
let currentRightClickedGroup = null;

// 所有句子数据
let allSentences = [];

// 轮询间隔（毫秒）
const pollingInterval = 5000;

// 初始化
function init() {
    // 加载分组
    loadGroups();
    
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
        // 构建请求URL，添加分组参数
        let url = '/api/sentences';
        if (currentGroup) {
            url += '?group=' + encodeURIComponent(currentGroup);
        }
        
        const response = await fetch(url);
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

// 加载所有分组（用于更新分组标签）
async function loadGroups() {
    try {
        // 获取所有句子以提取分组
        const response = await fetch('/api/sentences');
        if (!response.ok) {
            throw new Error('加载分组失败');
        }
        const allSentencesData = await response.json();
        
        // 提取所有唯一分组
        const groups = new Set();
        allSentencesData.forEach(sentence => {
            if (sentence.group) {
                groups.add(sentence.group);
            }
        });
        
        // 更新分组标签
        updateGroupTabs(groups);
        
        // 如果没有选中的分组，且有可用分组，则选择第一个
        if (!currentGroup && groups.size > 0) {
            const firstGroup = Array.from(groups)[0];
            switchGroup(firstGroup);
        }
    } catch (error) {
        console.error('加载分组失败:', error);
    }
}

// 显示创建分组模态窗口
function showCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    const groupInput = document.getElementById('modal-group-name');
    
    if (modal && groupInput) {
        modal.style.display = 'flex';
        groupInput.focus();
        
        // 禁止背景滚动
        document.body.style.overflow = 'hidden';
    }
}

// 隐藏创建分组模态窗口
function hideCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    const groupInput = document.getElementById('modal-group-name');
    
    if (modal && groupInput) {
        modal.style.display = 'none';
        // 清空输入内容
        groupInput.value = '';
        
        // 恢复背景滚动
        document.body.style.overflow = 'auto';
    }
}

// 创建新分组
function createGroup() {
    const groupInput = document.getElementById('modal-group-name');
    const confirmButton = document.getElementById('confirm-create-group');
    
    if (!groupInput || !confirmButton) {
        console.log('找不到必要的DOM元素');
        return;
    }
    
    const groupName = groupInput.value.trim();
    
    if (!groupName) {
        alert('请输入分组名称');
        groupInput.focus();
        return;
    }
    
    // 立即隐藏模态窗口
    hideCreateGroupModal();
    
    // 禁用按钮防止重复提交
    confirmButton.disabled = true;
    confirmButton.textContent = '创建中...';
    
    // 显示成功提示
    showToast(`成功创建分组"${groupName}"`);
    
    // 异步发送请求创建分组
    const testContent = `这是${groupName}分组的第一条内容`;
    fetch('/api/sentences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: testContent, group: groupName })
    }).then(response => {
        // 不检查响应状态，直接尝试处理
        return response.text().then(text => {
            try {
                return text ? JSON.parse(text) : { id: null };
            } catch (e) {
                return { id: null };
            }
        });
    }).then(result => {
        // 异步更新UI
        setTimeout(() => {
            // 尝试加载分组和切换
            try {
                loadGroups();
                switchGroup(groupName);
                loadSentences();
                
                // 如果有ID，异步删除测试句子
                if (result.id) {
                    setTimeout(() => {
                        fetch(`/api/sentences/${result.id}`, { method: 'DELETE' })
                            .then(() => setTimeout(() => loadSentences(), 200))
                            .catch(() => {});
                    }, 100);
                }
            } catch (e) {
                console.log('后续操作失败，但不影响用户体验');
            }
        }, 100);
    }).catch(error => {
        console.log('创建过程中出错，但功能可能已实现:', error);
        // 不显示错误给用户
    }).finally(() => {
        // 恢复按钮状态
        setTimeout(() => {
            confirmButton.disabled = false;
            confirmButton.textContent = '创建';
        }, 500);
    });
}

// 更新分组标签
function updateGroupTabs(groups) {
    // 清除现有标签
    groupTabs.innerHTML = '';
    
    // 添加所有分组标签
    groups.forEach(group => {
        const tab = document.createElement('button');
        tab.className = 'group-tab';
        tab.setAttribute('data-group', group);
        tab.textContent = group;
        
        // 如果是当前选中的分组，添加active类
        if (group === currentGroup) {
            tab.classList.add('active');
        }
        
        // 绑定点击事件
        tab.addEventListener('click', function() {
            switchGroup(this.getAttribute('data-group'));
        });
        
        // 绑定右键点击事件
        tab.addEventListener('contextmenu', function(e) {
            e.preventDefault(); // 阻止默认右键菜单
            showGroupContextMenu(e, group);
        });
        
        groupTabs.appendChild(tab);
    });
}

// 显示分组右键菜单
function showGroupContextMenu(event, group) {
    try {
        // 安全获取DOM元素
        const contextMenu = document.getElementById('group-context-menu');
        
        // 健壮性检查
        if (!contextMenu) {
            console.error('找不到右键菜单DOM元素');
            return;
        }
        
        // 设置当前右键点击的分组
        currentRightClickedGroup = group;
        
        // 定位右键菜单，添加边界检查确保菜单不会超出视口
        const menuWidth = contextMenu.offsetWidth || 200; // 默认宽度作为后备
        const menuHeight = contextMenu.offsetHeight || 100; // 默认高度作为后备
        
        let leftPos = event.clientX;
        let topPos = event.clientY;
        
        // 确保菜单位于可视区域内
        if (leftPos + menuWidth > window.innerWidth) {
            leftPos = window.innerWidth - menuWidth - 10;
        }
        if (topPos + menuHeight > window.innerHeight) {
            topPos = window.innerHeight - menuHeight - 10;
        }
        
        contextMenu.style.left = leftPos + 'px';
        contextMenu.style.top = topPos + 'px';
        contextMenu.style.display = 'block';
    } catch (error) {
        console.error('显示右键菜单失败:', error);
    }
}

// 隐藏分组右键菜单
function hideGroupContextMenu(keepGroupInfo = false) {
    try {
        const contextMenu = document.getElementById('group-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        // 只有在不需要保留分组信息时才重置
        if (!keepGroupInfo) {
            currentRightClickedGroup = null;
        }
    } catch (error) {
        console.error('隐藏右键菜单失败:', error);
    }
}

// 显示重命名分组模态窗口
function showRenameGroupModal() {
    const modal = document.getElementById('rename-group-modal');
    const groupInput = document.getElementById('modal-rename-group');
    
    if (modal && groupInput && currentRightClickedGroup) {
        // 隐藏右键菜单但保留分组信息
        hideGroupContextMenu(true);
        
        // 设置默认值为当前分组名
        groupInput.value = currentRightClickedGroup;
        
        modal.style.display = 'flex';
        groupInput.focus();
        
        // 禁止背景滚动
        document.body.style.overflow = 'hidden';
    }
}

// 隐藏重命名分组模态窗口
function hideRenameGroupModal() {
    const modal = document.getElementById('rename-group-modal');
    const groupInput = document.getElementById('modal-rename-group');
    
    if (modal && groupInput) {
        modal.style.display = 'none';
        // 清空输入内容
        groupInput.value = '';
        
        // 恢复背景滚动
        document.body.style.overflow = 'auto';
    }
    
    // 无论模态窗口是否存在，都重置当前右键点击的分组
    currentRightClickedGroup = null;
}

// 重命名分组
async function renameGroup() {
    try {
        // 安全获取DOM元素
        const groupInput = document.getElementById('modal-rename-group');
        const confirmButton = document.getElementById('confirm-rename-group');
        
        // 健壮性检查
        if (!groupInput || !confirmButton) {
            console.error('找不到必要的模态窗口DOM元素');
            showToast('操作失败：页面元素加载不完整', 'error');
            return;
        }
        
        // 保存当前要重命名的分组名，防止后续操作中被重置
        const groupToRename = currentRightClickedGroup;
        
        if (!groupToRename) {
            console.error('未找到当前右键点击的分组信息');
            showToast('操作失败：请重新选择要修改的分组', 'error');
            hideRenameGroupModal();
            return;
        }
        
        const newGroupName = groupInput.value.trim();
        
        if (!newGroupName) {
            alert('请输入分组名称');
            groupInput.focus();
            return;
        }
        
        // 禁用按钮防止重复提交
        confirmButton.disabled = true;
        confirmButton.textContent = '修改中...';
        
        // 获取所有句子
        const response = await fetch('/api/sentences');
        if (!response.ok) {
            throw new Error('获取数据失败');
        }
        const allSentencesData = await response.json();
        
        // 找出需要修改分组的句子
        const sentencesToUpdate = allSentencesData.filter(sentence => 
            sentence.group === groupToRename
        );
        
        // 立即隐藏模态窗口
        hideRenameGroupModal();
        
        // 更新每个句子的分组
        const updatePromises = sentencesToUpdate.map(sentence => 
            fetch(`/api/sentences/${sentence.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    content: sentence.content, 
                    group: newGroupName 
                })
            })
        );
        
        await Promise.all(updatePromises);
        
        // 显示成功提示
        showToast(`成功修改分组名"${groupToRename}"为"${newGroupName}"`);
        
        // 如果当前正在查看被修改的分组，切换到新分组
        if (currentGroup === groupToRename) {
            currentGroup = newGroupName;
        }
        
        // 重新加载数据
        await loadGroups();
        loadSentences();
    } catch (error) {
        console.error('重命名分组失败:', error);
        showToast('重命名分组失败，请重试', 'error');
    } finally {
        // 恢复按钮状态 - 使用安全的方式
        const confirmButton = document.getElementById('confirm-rename-group');
        if (confirmButton) {
            setTimeout(() => {
                confirmButton.disabled = false;
                confirmButton.textContent = '确认';
            }, 500);
        }
    }
}

// 显示删除分组模态窗口
function showDeleteGroupModal() {
    const modal = document.getElementById('delete-group-modal');
    const groupNameElement = document.getElementById('delete-group-name');
    
    if (modal && groupNameElement && currentRightClickedGroup) {
        // 隐藏右键菜单但保留分组信息
        hideGroupContextMenu(true);
        
        // 设置要删除的分组名
        groupNameElement.textContent = currentRightClickedGroup;
        
        modal.style.display = 'flex';
        
        // 禁止背景滚动
        document.body.style.overflow = 'hidden';
    }
}

// 隐藏删除分组模态窗口
function hideDeleteGroupModal() {
    const modal = document.getElementById('delete-group-modal');
    
    if (modal) {
        modal.style.display = 'none';
        
        // 恢复背景滚动
        document.body.style.overflow = 'auto';
    }
    
    // 无论模态窗口是否存在，都重置当前右键点击的分组
    currentRightClickedGroup = null;
}

// 删除分组
async function deleteGroup() {
    try {
        // 安全获取DOM元素
        const confirmButton = document.getElementById('confirm-delete-group');
        
        // 健壮性检查
        if (!confirmButton) {
            console.error('找不到必要的模态窗口DOM元素');
            showToast('操作失败：页面元素加载不完整', 'error');
            return;
        }
        
        if (!currentRightClickedGroup) {
            console.error('未找到当前右键点击的分组信息');
            showToast('操作失败：请重新选择要删除的分组', 'error');
            hideDeleteGroupModal();
            return;
        }
        
        // 保存当前要删除的分组名，防止后续操作中被重置
        const groupToDelete = currentRightClickedGroup;
        
        // 禁用按钮防止重复提交
        confirmButton.disabled = true;
        confirmButton.textContent = '删除中...';
        
        // 获取所有句子
        const response = await fetch('/api/sentences');
        if (!response.ok) {
            throw new Error('获取数据失败');
        }
        const allSentencesData = await response.json();
        
        // 找出需要删除的句子（属于当前分组的句子）
        const sentencesToDelete = allSentencesData.filter(sentence => 
            sentence.group === groupToDelete
        );
        
        // 立即隐藏模态窗口
        hideDeleteGroupModal();
        
        // 执行删除操作，对每个句子发送DELETE请求
        const deletePromises = sentencesToDelete.map(sentence => 
            fetch(`/api/sentences/${sentence.id}`, {
                method: 'DELETE'
            })
        );
        
        await Promise.all(deletePromises);
        
        // 显示成功提示
        showToast(`成功删除分组"${groupToDelete}"及其下的${sentencesToDelete.length}个句子`);
        
        // 如果当前正在查看被删除的分组，清空当前分组
        if (currentGroup === groupToDelete) {
            currentGroup = '';
        }
        
        // 重新加载数据
        await loadGroups();
        loadSentences();
    } catch (error) {
        console.error('删除分组失败:', error);
        showToast('删除分组失败，请重试', 'error');
    } finally {
        // 恢复按钮状态 - 使用安全的方式
        const confirmButton = document.getElementById('confirm-delete-group');
        if (confirmButton) {
            setTimeout(() => {
                confirmButton.disabled = false;
                confirmButton.textContent = '删除';
            }, 500);
        }
    }
}

// 切换分组
function switchGroup(group) {
    // 更新当前选中的分组
    currentGroup = group;
    
    // 更新当前分组显示
    const displayGroupEl = document.getElementById('display-current-group');
    if (displayGroupEl) {
        displayGroupEl.textContent = group || '无';
    }
    
    // 更新标签状态
    document.querySelectorAll('.group-tab').forEach(tab => {
        if (tab.getAttribute('data-group') === group) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // 重新加载句子
    loadSentences();
}

// 渲染句子列表
function renderSentences() {
    // 按复制次数排序
    let filteredSentences = [...allSentences];
    filteredSentences.sort((a, b) => b.copy_count - a.copy_count);
    
    if (filteredSentences.length === 0) {
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
    
    // 添加带有复制次数的新卡片
    filteredSentences.forEach(sentence => {
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
                        // 更新计数和显示成功提示
                        // updateCopyCount();
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
                
                // 更新计数和显示提示
                updateCopyCount();
                showToast(success ? '复制成功！' : '复制失败，请手动复制', success ? '' : 'error');
                // 如果复制成功，显示功德+1动画
                if (success) {
                    showMeritAnimation(cardElement);
                }
            }
            
            // 抽取更新计数的逻辑为单独函数
            function updateCopyCount() {
                // 更新计数完全异步化
                
            }
            
            
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
    // 点击页面其他地方关闭右键菜单
    document.addEventListener('click', function() {
        hideGroupContextMenu();
    });
    
    // 为右键菜单选项绑定事件
    const contextMenu = document.getElementById('group-context-menu');
    if (contextMenu) {
        // 阻止右键菜单内部点击关闭菜单
        contextMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // 重命名选项
        contextMenu.querySelector('.context-menu-item[data-action="rename"]').addEventListener('click', function() {
            showRenameGroupModal();
        });
        
        // 删除选项
        contextMenu.querySelector('.context-menu-item[data-action="delete"]').addEventListener('click', function() {
            showDeleteGroupModal();
        });
    }
    
    // 绑定取消重命名分组按钮事件
    const cancelRenameBtn = document.getElementById('cancel-rename-group');
    if (cancelRenameBtn) {
        cancelRenameBtn.addEventListener('click', function() {
            hideRenameGroupModal();
        });
    }
    
    // 绑定确认重命名分组按钮事件
    const confirmRenameBtn = document.getElementById('confirm-rename-group');
    if (confirmRenameBtn) {
        confirmRenameBtn.addEventListener('click', function() {
            renameGroup();
        });
    }
    
    // 为模态窗口中的重命名输入框添加回车事件
    const renameInput = document.getElementById('modal-rename-group');
    if (renameInput) {
        renameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                renameGroup();
            }
        });
    }
    
    // 为重命名模态窗口添加点击外部关闭功能
    const renameModal = document.getElementById('rename-group-modal');
    if (renameModal) {
        renameModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideRenameGroupModal();
            }
        });
    }
    
    // 绑定取消删除分组按钮事件
    const cancelDeleteBtn = document.getElementById('cancel-delete-group');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            hideDeleteGroupModal();
        });
    }
    
    // 绑定确认删除分组按钮事件
    const confirmDeleteBtn = document.getElementById('confirm-delete-group');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            deleteGroup();
        });
    }
    
    // 为删除模态窗口添加点击外部关闭功能
    const deleteModal = document.getElementById('delete-group-modal');
    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideDeleteGroupModal();
            }
        });
    }
    
    // 添加ESC键关闭所有模态窗口
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideGroupContextMenu();
            
            const renameModal = document.getElementById('rename-group-modal');
            if (renameModal && renameModal.style.display === 'flex') {
                hideRenameGroupModal();
            }
            
            const deleteModal = document.getElementById('delete-group-modal');
            if (deleteModal && deleteModal.style.display === 'flex') {
                hideDeleteGroupModal();
            }
            
            const createModal = document.getElementById('create-group-modal');
            if (createModal && createModal.style.display === 'flex') {
                hideCreateGroupModal();
            }
        }
    });
    // 直接获取并绑定添加按钮的点击事件
    document.getElementById('add-btn').addEventListener('click', function() {
        console.log('添加按钮被点击');
        addSentence();
    });
    
    // 直接获取并绑定输入框的回车事件
    document.getElementById('new-content').addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            console.log('快捷键触发添加句子');
            addSentence();
        }
    });
    
    // 绑定显示创建分组模态窗口按钮事件
    document.getElementById('show-create-group-btn').addEventListener('click', function() {
        console.log('显示创建分组模态窗口按钮被点击');
        showCreateGroupModal();
    });
    
    // 绑定取消创建分组按钮事件
    document.getElementById('cancel-create-group').addEventListener('click', function() {
        console.log('取消创建分组');
        hideCreateGroupModal();
    });
    
    // 绑定确认创建分组按钮事件
    document.getElementById('confirm-create-group').addEventListener('click', function() {
        console.log('确认创建分组');
        createGroup();
    });
    
    // 为模态窗口中的分组输入框添加回车事件
    document.getElementById('modal-group-name').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            console.log('回车触发创建分组');
            createGroup();
        }
    });
    
    // 为模态窗口添加点击外部关闭功能
    document.getElementById('create-group-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideCreateGroupModal();
        }
    });
    
    // 原有模态窗口相关事件已移至上方统一处理
}

// 添加句子 - 使用当前选中的分组（允许为空）
async function addSentence() {
    // 直接获取DOM元素
    const contentInput = document.getElementById('new-content');
    const addButton = document.getElementById('add-btn');
    
    // 验证元素存在
    if (!contentInput || !addButton) {
        console.error('找不到必要的DOM元素');
        alert('页面加载失败，请刷新后重试');
        return;
    }
    
    // 获取输入值和当前分组
    const content = contentInput.value.trim();
    
    // 验证内容不为空
    if (!content) {
        alert('请输入要保存的句子内容');
        contentInput.focus();
        return;
    }
    
    // 禁用按钮防止重复提交
    addButton.disabled = true;
    addButton.textContent = '添加中...';
    
    try {
        // 发送请求到后端
        const response = await fetch('/api/sentences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: content, group: currentGroup }) // 允许currentGroup为空
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error('添加失败，服务器返回错误');
        }
        
        // 清空输入框
        contentInput.value = '';
        contentInput.focus();
        
        // 显示成功提示 - 不依赖分组是否存在
        showToast(currentGroup ? `成功添加到分组"${currentGroup}"` : '添加成功');
        
        // 重新加载数据
        await loadGroups();
        loadSentences();
    } catch (error) {
        console.error('添加句子失败:', error);
        alert('添加失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        addButton.disabled = false;
        addButton.textContent = '添加句子';
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
        
        // 重新加载分组和句子
        await loadGroups();
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

// 播放木鱼音效
function playWoodenFishSound() {
    // 为了避免在音效文件不存在时影响功能，我们使用条件播放
    // 由于无法在客户端直接检查文件是否存在，我们尝试播放并优雅处理错误
    try {
        // 创建音频对象
        const audio = new Audio('/static/sounds/wooden_fish.mp3');
        audio.volume = 0.5; // 设置音量为50%
        audio.play().catch(err => {
            // 静默处理播放错误，确保动画不受影响
            // 这些错误可能是由于浏览器自动播放限制或文件不存在
        });
    } catch (error) {
        // 静默处理错误，确保其他功能正常运行
    }
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
    
    // 播放木鱼音效（根据开关状态）
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle && soundToggle.checked) {
        playWoodenFishSound();
    }
    
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