let GITHUB_TOKEN;
let REPO_OWNER;
let REPO_NAME;
let currentPath = '';
let allFiles = [];
let originalAllFiles = [];
let uploadQueue = [];

function hexToAscii(hex) {
    const hexWithoutSpaces = hex.replace(/\s/g, '');
    let ascii = '';
    for (let i = 0; i < hexWithoutSpaces.length; i += 2) {
        const byte = parseInt(hexWithoutSpaces.substr(i, 2), 16);
        ascii += String.fromCharCode(byte);
    }
    return ascii;
}

async function getGitHubToken() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            throw new Error('Failed to load config.json');
        }
        const config = await response.json();
        GITHUB_TOKEN = hexToAscii(config.GITHUB_TOKEN);
        REPO_OWNER = config.REPO_OWNER;
        REPO_NAME = config.REPO_NAME;
    } catch (error) {
        alert(`Error loading GitHub token: ${error.message}`);
    }
}

window.addEventListener('load', async function () {
    const nav = document.querySelector('nav');
    const uploadArea = document.querySelector('.upload-area');
    const navHeight = nav.offsetHeight;
    uploadArea.style.marginTop = navHeight + 'px';

    await getGitHubToken();
    await init();
});

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

async function init() {
    await loadFiles(currentPath);
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('fileTypeFilter').addEventListener('change', handleFileTypeFilter);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('browseBtn').addEventListener('click', () => document.getElementById('fileInput').click());

    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);

    document.getElementById('searchInput').addEventListener('input', handleSearch);
}

function handleFileTypeFilter() {
    const selectedType = document.getElementById('fileTypeFilter').value;
    let filteredFiles = originalAllFiles.slice();

    if (selectedType !== 'all') {
        filteredFiles = filteredFiles.filter(item => {
            if (selectedType === 'dir') {
                return item.type === 'dir';
            } else {
                const ext = item.name.split('.').pop().toLowerCase();
                switch (selectedType) {
                    case 'pdf':
                        return ext === 'pdf';
                    case 'image':
                        return ['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext);
                    case 'doc':
                        return ['doc', 'docx'].includes(ext);
                    case 'xls':
                        return ['xls', 'xlsx'].includes(ext);
                    case 'ppt':
                        return ['ppt', 'pptx'].includes(ext);
                    case 'archive':
                        return ['zip', 'rar', '7z'].includes(ext);
                    case 'other':
                        return !['dir', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z'].includes(ext);
                    default:
                        return true;
                }
            }
        });
    }

    allFiles = filteredFiles;
    renderFileList();
}

async function handleFileDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    uploadFiles(files);
}

async function createNewFolder() {
    const folderName = prompt('请输入文件夹名称：');
    if (!folderName) return;

    if (!/^[a-zA-Z0-9_\-\s\u4e00-\u9fa5]+$/.test(folderName)) {
        alert('名称包含非法字符，只能使用中文、字母、数字、下划线和连字符');
        return;
    }

    const exists = allFiles.some(item =>
        item.type === 'dir' && item.name === folderName
    );
    if (exists) {
        alert('该名称已存在');
        return;
    }

    const folderPath = currentPath ?
        `${currentPath}/${folderName}/.gitkeep` :
        `${folderName}/.gitkeep`;

    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${folderPath}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `创建文件夹 ${folderName}`,
                    content: btoa(' ')
                })
            }
        );

        if (response.status === 201) {
            await loadFiles(currentPath);
            alert('文件夹创建成功！');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || '创建失败');
        }
    } catch (error) {
        alert(`错误: ${error.message}`);
    }
}

async function flattenFiles(contents) {
    let files = [];
    for (const item of contents) {
        if (item.name === '.gitkeep') continue;

        if (item.type === 'dir') {
            files.push(item);
        } else {
            const commitResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${item.path}`,
                {
                    headers: {
                        Authorization: `Bearer ${GITHUB_TOKEN}`,
                        Accept: 'application/vnd.github+json'
                    }
                }
            );
            if (commitResponse.ok) {
                const commits = await commitResponse.json();
                item.uploaded_at = commits[0]?.commit?.author?.date;
            }
            files.push(item);
        }
    }
    return files;
}

async function loadFiles(path) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json'
                }
            }
        );

        if (!response.ok) throw new Error('获取文件列表失败');

        const contents = await response.json();
        allFiles = await flattenFiles(contents);

        allFiles.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'dir' ? -1 : 1;
        });

        originalAllFiles = allFiles.slice();
        updatePathDisplay(path);
        renderFileList();
    } catch (error) {
        alert(`加载文件失败: ${error.message}`);
    }
}

async function flattenFiles(contents) {
    let files = [];
    for (const item of contents) {
        if (item.type === 'dir') {
            files.push(item);
        } else {
            const commitResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${item.path}`,
                {
                    headers: {
                        Authorization: `Bearer ${GITHUB_TOKEN}`,
                        Accept: 'application/vnd.github+json'
                    }
                }
            );
            if (commitResponse.ok) {
                const commits = await commitResponse.json();
                item.uploaded_at = commits[0]?.commit?.author?.date;
            }
            files.push(item);
        }
    }
    return files;
}



function renderFileList() {
    const list = [];

    list.push(`
        <div class="list-item">
            <div style="min-width: 32px;"></div>
            <div class="file-name" style="flex: 2; text-align: left; color: #222; font-weight: 600; min-width: 200px">文件名</div>
            <div class="file-info" style="display: flex; gap: 1rem; width: 35%; margin-right: 128px;">
                <span class="file-format" style="text-align: left; color: #222; font-weight: 600;">文件格式</span>
                <span class="file-size" style="text-align: left; color: #222; font-weight: 600;">文件大小</span>
                <span class="file-date" style="text-align: left; color: #222; font-weight: 600;">上传时间</span>
            </div>
            <div class="file-actions" style="display: flex; gap: 0.5rem; margin-left: auto;"></div>
        </div>
    `);

    if (currentPath) {
        list.push(`
            <div class="list-item">
                <i class="file-icon fas fa-folder-open"></i>
                <div class="file-name" onclick="navigateBack()" style="cursor:pointer;">..(返回上级)</div>
                <div class="file-info">
                    <span class="file-format"> - </span>
                    <span class="file-size"> - </span>
                    <span class="file-date"> - </span>
                </div>
                <div class="file-actions" style="width: 122px"></div>
            </div>
        `);
    }

    uploadQueue.forEach(task => {
        list.push(`
            <div class="list-item uploading" data-task-id="${task.id}">
                <i class="file-icon fas ${task.status === 'uploading' ? 'fa-spinner fa-spin' : 'fa-pause'}"></i>
                <div class="file-name">${task.file.name}</div>
                <div class="upload-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress}%"></div>
                    </div>
                    <span class="progress-percent">${task.progress}%</span>
                </div>
                <div class="upload-actions">
                    ${task.status === 'uploading' ?
                `<button onclick="pauseUpload('${task.id}')"><i class="fas fa-pause"></i></button>` :
                `<button onclick="resumeUpload('${task.id}')"><i class="fas fa-play"></i></button>`
            }
                    <button onclick="cancelUpload('${task.id}')"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `);
    });

    allFiles.forEach(item => {
        if (item.type === 'dir') {
            list.push(`
                <div class="list-item">
                    <i class="file-icon fas fa-folder" onclick="navigateTo('${item.path}')"></i>
                    <div class="file-name">
                        <span onclick="navigateTo('${item.path}')">${item.name}</span>
                    </div>
                    <div class="file-info">
                        <span class="file-format"> - </span>
                        <span class="file-size"> - </span>
                        <span class="file-date"> - </span>
                    </div>
                    <div class="file-actions">
                        <div style="width: 56px;"></div>
                        <button onclick="deleteItem('${item.path}', '${item.sha}')">删除</button>
                    </div>
                </div>
            `);
        } else {
            list.push(`
                <div class="list-item">
                    <i class="file-icon fas ${getFileIcon(item.name)}" onclick="previewFile('${item.path}')"></i>
                    <div class="file-name">
                        <span onclick="previewFile('${item.path}')">${item.name}</span>
                    </div>
                    <div class="file-info">
                        <span class="file-format">${getFileFormat(item.name)}</span>
                        <span class="file-size">${formatSize(item.size)}</span>
                        <span class="file-date">${formatDate(item.uploaded_at || item.updated_at)}</span>
                    </div>
                    <div class="file-actions">
                        <button onclick="downloadFile('${item.path}')">下载</button>
                        <button onclick="deleteItem('${item.path}', '${item.sha}')">删除</button>
                    </div>
                </div>
            `);
        }
    });

    document.getElementById('fileList').innerHTML = list.join('');
}

function uploadFiles(files) {
    files.forEach(file => {
        const task = {
            id: generateId(),
            file: file,
            xhr: null,
            progress: 0,
            status: 'uploading',
            path: currentPath ? `${currentPath}/${file.name}` : file.name
        };
        uploadQueue.push(task);
        startUpload(task);
    });
    renderFileList();
}

function startUpload(task) {
    readFileAsBase64(task.file).then(content => {
        const xhr = new XMLHttpRequest();
        task.xhr = xhr;

        xhr.open('PUT', `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${task.path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${GITHUB_TOKEN}`);
        xhr.setRequestHeader('Accept', 'application/vnd.github+json');
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                task.progress = Math.round((e.loaded / e.total) * 100);
                renderFileList();
            }
        });

        xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                alert(`${task.file.name} 上传成功！`);
                removeFromQueue(task.id);
                await loadFiles(currentPath);
            } else {
                task.status = 'error';
                alert(`上传失败: ${xhr.statusText}`);
                renderFileList();
            }
        };

        xhr.onerror = () => {
            task.status = 'error';
            alert('上传过程中发生网络错误');
            renderFileList();
        };

        xhr.send(JSON.stringify({
            message: `Add ${task.file.name}`,
            content: content.split(',')[1]
        }));
    });
}

function pauseUpload(taskId) {
    const task = uploadQueue.find(t => t.id === taskId);
    if (task && task.xhr) {
        task.xhr.abort();
        task.status = 'paused';
        renderFileList();
    }
}

function resumeUpload(taskId) {
    const task = uploadQueue.find(t => t.id === taskId);
    if (task && task.status === 'paused') {
        task.status = 'uploading';
        startUpload(task);
        renderFileList();
    }
}

function cancelUpload(taskId) {
    const index = uploadQueue.findIndex(t => t.id === taskId);
    if (index !== -1) {
        const task = uploadQueue[index];
        if (task.xhr) task.xhr.abort();
        uploadQueue.splice(index, 1);
        renderFileList();
    }
}

function removeFromQueue(taskId) {
    const index = uploadQueue.findIndex(t => t.id === taskId);
    if (index !== -1) uploadQueue.splice(index, 1);
}

function readFileAsBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word',
        xls: 'fa-file-excel', xlsx: 'fa-file-excel', ppt: 'fa-file-powerpoint',
        pptx: 'fa-file-powerpoint', zip: 'fa-file-archive',
        png: 'fa-file-image', jpg: 'fa-file-image', jpeg: 'fa-file-image'
    };
    return icons[ext] || 'fa-file';
}

function getFileFormat(filename) {
    return filename.split('.').pop().toLowerCase() || '未知';
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes, unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function navigateTo(path) {
    currentPath = path;
    loadFiles(path);
}

function navigateBack() {
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    loadFiles(currentPath);
}

function updatePathDisplay(path) {
    document.getElementById('currentPath').textContent = `当前路径：/${path}`;
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave() {
    uploadArea.classList.remove('dragover');
}

function handleSearch() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const selectedType = document.getElementById('fileTypeFilter').value;

    let filteredFiles = originalAllFiles.slice();

    if (selectedType !== 'all') {
        filteredFiles = filteredFiles.filter(item => {
            if (selectedType === 'dir') {
                return item.type === 'dir';
            } else {
                const ext = item.name.split('.').pop().toLowerCase();
                switch (selectedType) {
                    case 'pdf':
                        return ext === 'pdf';
                    case 'image':
                        return ['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext);
                    case 'doc':
                        return ['doc', 'docx'].includes(ext);
                    case 'xls':
                        return ['xls', 'xlsx'].includes(ext);
                    case 'ppt':
                        return ['ppt', 'pptx'].includes(ext);
                    case 'archive':
                        return ['zip', 'rar', '7z'].includes(ext);
                    case 'other':
                        return !['dir', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z'].includes(ext);
                    default:
                        return true;
                }
            }
        });
    }

    if (keyword) {
        filteredFiles = filteredFiles.filter(item => item.name.toLowerCase().includes(keyword));
    }

    allFiles = filteredFiles;
    renderFileList();
}

async function downloadFile(path) {
    try {
        const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('文件不存在');

        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = path.split('/').pop();
        link.click();
        alert('文件下载已开始！');
    } catch (error) {
        alert(`下载失败: ${error.message}`);
    }
}

// 添加密码验证相关变量
let passwordVerified = false;
let passwordVerifiedTime = 0;

// 修改 deleteItem 函数
async function deleteItem(path, sha) {
    if (!confirm(`确定要删除 ${path.split('/').pop()} 吗？`)) return;

    // 检查是否需要验证密码
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    if (!passwordVerified || now - passwordVerifiedTime > thirtyMinutes) {
        const password = prompt('请输入删除密码：');
        if (password !== '123456') {
            alert('密码错误或已取消，删除操作未执行。');
            return;
        }
        passwordVerified = true;
        passwordVerifiedTime = now;
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json'
                }
            }
        );

        if (response.ok) {
            const contents = await response.json();
            if (Array.isArray(contents)) {
                for (const item of contents) {
                    await deleteItem(item.path, item.sha);
                }
            }

            const deleteResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${GITHUB_TOKEN}`,
                        Accept: 'application/vnd.github+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete ${path}`,
                        sha: sha
                    })
                }
            );

            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                throw new Error(errorData.message || '删除失败');
            }
        } else {
            const deleteResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${GITHUB_TOKEN}`,
                        Accept: 'application/vnd.github+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete ${path}`,
                        sha: sha
                    })
                }
            );

            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                throw new Error(errorData.message || '删除失败');
            }
        }

        await loadFiles(currentPath);
        alert('删除成功！');
    } catch (error) {
        alert(`删除失败: ${error.message}`);
    }
}

function previewFile(path) {
    const ext = path.split('.').pop().toLowerCase();
    const supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];

    if (supportedFormats.includes(ext)) {
        window.open(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}`, '_blank');
    } else {
        alert('不支持预览此文件类型，请下载后打开。');
    }
}


