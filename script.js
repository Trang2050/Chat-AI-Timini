// Cấu hình hệ thống
const deviceIP = "192.168.1.4"
const config = {
    port: 81
};

// Biến toàn cục
let websocket = null;
let currentDeviceIP = null;

// Hiển thị modal nhập IP
function showIPModal() {
    const modal = document.getElementById('ip-input-modal');
    const savedIP = localStorage.getItem('deviceIP');
    if (savedIP) {
        document.getElementById('device-ip-input').value = savedIP;
    }
    modal.style.display = 'flex';
}

function hideIPModal() {
    document.getElementById('ip-input-modal').style.display = 'none';
}

function connectWebSocket(ip) {
    if (websocket) websocket.close();

    currentDeviceIP = ip;
    localStorage.setItem('deviceIP', ip);

    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname) || ip === 'localhost';
    const socketUrl = isLocal ? `${protocol}${ip}:${config.port}` : `wss://your-websocket-proxy.com?device=${encodeURIComponent(ip)}`;

    console.log(`Đang kết nối đến: ${socketUrl}`);
    websocket = new WebSocket(socketUrl);

    websocket.onopen = () => {
        console.log('✅ Kết nối WebSocket thành công');
        updateConnectionStatus(true);
        enableControls(true);
        addBotMessage(`Đã kết nối với thiết bị Timini tại ${ip}`);
        sendWebSocketMessage({ type: 'get_status' });
        hideIPModal();
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Nhận dữ liệu:', data);

            if (data.type === 'ai_response') {
                addBotMessage(data.message);
            } else if (data.type === 'led_status') {
                updateLEDState(data.value);
            }
        } catch (error) {
            console.error('Lỗi phân tích tin nhắn:', error);
        }
    };

    websocket.onclose = () => {
        console.log('❌ Mất kết nối');
        updateConnectionStatus(false);
        enableControls(false);
        setTimeout(() => {
            if (currentDeviceIP) connectWebSocket(currentDeviceIP);
        }, 5000);
    };

    websocket.onerror = (error) => {
        console.error('Lỗi WebSocket:', error);
        updateConnectionStatus(false);
        addBotMessage("Không thể kết nối với thiết bị. Vui lòng kiểm tra lại địa chỉ IP.");
    };
}

function sendWebSocketMessage(message) {
    if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    } else {
        console.warn('Chưa kết nối WebSocket');
        addBotMessage("Mất kết nối với thiết bị. Đang thử kết nối lại...");
        if (currentDeviceIP) {
            connectWebSocket(currentDeviceIP);
        } else {
            showIPModal();
        }
    }
}

function enableControls(enabled) {
    ['btn-on', 'btn-off', 'user-input', 'send-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    if (connected) {
        statusElement.textContent = `✅ Đã kết nối với ${currentDeviceIP}`;
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.textContent = '❌ Mất kết nối, đang thử kết nối lại...';
        statusElement.className = 'connection-status disconnected';
    }
}

function addUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'message user-message';
    msg.textContent = message;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'message bot-message';
    msg.textContent = message;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateLEDState(state) {
    document.getElementById('led-indicator')?.classList.toggle('on', state);
    document.getElementById('led-text').textContent = state ? 'Đèn đang BẬT' : 'Đèn đang TẮT';
}

function sendChatMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;
    addUserMessage(message);
    sendWebSocketMessage({ type: 'ai_chat', message });
    input.value = '';
}

// Khởi động
document.addEventListener('DOMContentLoaded', () => {
    showIPModal();

    document.getElementById('connect-btn')?.addEventListener('click', () => {
        const ip = document.getElementById('device-ip-input').value.trim();
        if (ip) connectWebSocket(ip);
        else alert('Vui lòng nhập địa chỉ IP');
    });

    document.getElementById('local-connect-btn')?.addEventListener('click', () => {
        connectWebSocket('localhost');
    });

    document.getElementById('btn-change-ip')?.addEventListener('click', showIPModal);
    document.getElementById('btn-on')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'on' });
        addUserMessage('bật đèn');
    });

    document.getElementById('btn-off')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'off' });
        addUserMessage('tắt đèn');
    });

    document.getElementById('send-btn')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
});