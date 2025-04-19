// Thêm vào đầu file script.js
const firebaseConfig = {
    apiKey: "AIzaSyBWa0utLTN3oEkENPxwui87_HQsw9VKiSM",
    authDomain: "ai-timini.firebaseapp.com",
    projectId: "ai-timini",
    storageBucket: "ai-timini.appspot.com",
    messagingSenderId: "253638969082",
    appId: "1:253638969082:web:88588b14dd6629e52bab43"
};

// Khởi tạo Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}




// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Cấu hình hệ thống
const deviceIP = "192.168.1.7"; // Địa chỉ IP cố định của thiết bị
const config = {
    port: 81
};

// Biến toàn cục
let websocket = null;
const firebaseRef = database.ref('devices/led1');

// Hiển thị trạng thái kết nối
function showConnectingStatus() {
    const statusElement = document.getElementById('connection-status');
    statusElement.innerHTML = `
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
        Đang kết nối với thiết bị...
    `;
    statusElement.className = 'connection-status';
}

// Hàm gửi lệnh qua Firebase
function sendFirebaseCommand(command) {
    firebaseRef.update({
        command: command,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).catch(error => {
        console.error("Lỗi gửi lệnh Firebase:", error);
        addBotMessage("Lỗi khi gửi lệnh đến Firebase");
    });
}

// Kết nối WebSocket trực tiếp
function connectWebSocket() {
    showConnectingStatus();
    
    if (websocket) websocket.close();

    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socketUrl = `${protocol}${deviceIP}:${config.port}`;

    console.log(`Đang kết nối đến: ${socketUrl}`);
    websocket = new WebSocket(socketUrl);

    // Theo dõi thay đổi từ Firebase
    firebaseRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.command) {
            const command = data.command.toLowerCase();
            if (command === 'on' || command === 'off') {
                sendWebSocketMessage({ type: 'led_control', command: command });
                addBotMessage(`Đã nhận lệnh từ Firebase: ${command}`);
            }
        }
    });

    websocket.onopen = () => {
        console.log('✅ Kết nối WebSocket thành công');
        updateConnectionStatus(true);
        enableControls(true);
        addBotMessage("Đã kết nối với thiết bị Timini");
        sendWebSocketMessage({ type: 'get_status' });
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Nhận dữ liệu:', data);

            if (data.type === 'ai_response') {
                addBotMessage(data.message);
            } else if (data.type === 'led_status') {
                updateLEDState(data.value);
                // Cập nhật trạng thái lên Firebase
                firebaseRef.update({ status: data.value });
            }
        } catch (error) {
            console.error('Lỗi phân tích tin nhắn:', error);
        }
    };

    websocket.onclose = () => {
        console.log('❌ Mất kết nối');
        updateConnectionStatus(false);
        enableControls(false);
        setTimeout(connectWebSocket, 5000); // Tự động kết nối lại sau 5s
    };

    websocket.onerror = (error) => {
        console.error('Lỗi WebSocket:', error);
        updateConnectionStatus(false);
        addBotMessage("Lỗi kết nối với thiết bị. Đang thử lại...");
    };
}

function sendWebSocketMessage(message) {
    if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    } else {
        console.warn('Chưa kết nối WebSocket');
        addBotMessage("Mất kết nối với thiết bị. Đang thử kết nối lại...");
        connectWebSocket();
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
        statusElement.textContent = `✅ Đã kết nối với thiết bị`;
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.innerHTML = `
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
            Đang thử kết nối lại...
        `;
        statusElement.className = 'connection-status';
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
    const ledIndicator = document.getElementById('led-indicator');
    const ledText = document.getElementById('led-text');
    
    if (ledIndicator) ledIndicator.classList.toggle('on', state);
    if (ledText) ledText.textContent = state ? 'Đèn đang BẬT' : 'Đèn đang TẮT';
}

function sendChatMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;
    
    addUserMessage(message);
    sendWebSocketMessage({ type: 'ai_chat', message });
    input.value = '';
}

// Khởi động ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    // Xác thực ẩn danh với Firebase
    firebase.auth().signInAnonymously()
        .then(() => {
            console.log("Đã đăng nhập Firebase thành công");
            connectWebSocket(); // Kết nối ngay khi trang tải xong
        })
        .catch(error => {
            console.error("Lỗi đăng nhập Firebase:", error);
            connectWebSocket(); // Vẫn thử kết nối nếu Firebase lỗi
        });

    // Thiết lập sự kiện cho các nút
    document.getElementById('btn-on')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'on' });
        sendFirebaseCommand('on');
        addUserMessage('bật đèn');
    });

    document.getElementById('btn-off')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'off' });
        sendFirebaseCommand('off');
        addUserMessage('tắt đèn');
    });

    document.getElementById('send-btn')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
});